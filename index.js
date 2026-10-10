const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const config = require('./config');

ffmpeg.setFfmpegPath(ffmpegPath);

const { handleDownloadCommands } = require('./lib/downloader');
const { handleGroupCommands } = require('./lib/group');
const { handleOwnerCommands } = require('./lib/owner');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('✅ MongoDB Database Connected!'))
    .catch((err) => console.log('⚠️ Database Connection Warning:', err.message));

function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor((seconds % (3600 * 24)) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    return (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") + s + "s";
}

// Gemini AI Reply Generator
async function getGeminiReply(userPrompt, senderName) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const systemPrompt = `You are Sara, a friendly Sri Lankan WhatsApp AI bot. User's name is ${senderName}. Reply in friendly Sinhala/Singlish. Keep responses under 3 lines.`;
        const result = await model.generateContent([systemPrompt, userPrompt]);
        return result.response.text();
    } catch (e) {
        console.error('Gemini API Error:', e.message);
        return null;
    }
}

// True WhatsApp Voice Note (PTT) Converter & Sender
async function sendVoiceNote(sock, jid, audioPath, quotedMsg) {
    if (!fs.existsSync(audioPath)) return;

    const outputPath = path.join(__dirname, `temp_${Date.now()}.opus`);

    ffmpeg(audioPath)
        .toFormat('ogg')
        .audioCodec('libopus')
        .on('end', async () => {
            try {
                await sock.sendMessage(jid, {
                    audio: fs.readFileSync(outputPath),
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: quotedMsg });

                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (err) {
                console.error('Error sending Voice Note:', err);
            }
        })
        .on('error', (err) => {
            console.error('FFmpeg Conversion Error:', err);
        })
        .save(outputPath);
}

async function startSaraBot() {
    // GitHub එකෙන් clone වෙන session folder එක හරහා creds.json එක Read කරයි
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // creds.json එක ඇතුළේ valid session එකක් තිබේ නම් pairing code ඉල්ලීම bypass වේ
    if (!sock.authState.creds.registered) {
        let phoneNumber = config.OWNER_NUMBER.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n===========================================`);
            console.log(`📱 SARA MD PAIRING CODE: ${code}`);
            console.log(`===========================================\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting Sara Bot...');
                startSaraBot();
            } else {
                console.log('❌ Connection Closed. Logged out.');
            }
        } else if (connection === 'open') {
            console.log('🚀 Sara MD Bot Active & Ready using creds.json from GitHub session folder!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
            const lowerText = text.toLowerCase();
            const senderName = msg.pushName || 'Bro';
            const senderNumber = msg.key.participant || msg.key.remoteJid;

            // Voice Note Keywords
            if (config.VOICES.keywords[lowerText]) {
                return await sendVoiceNote(sock, jid, config.VOICES.keywords[lowerText], msg);
            }

            // Command Processing
            if (text.startsWith(config.PREFIX)) {
                const args = text.slice(config.PREFIX.length).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const query = args.join(' ');

                const isOwner = senderNumber.includes(config.OWNER_NUMBER);

                let groupMetadata = null;
                let isAdmins = false;
                let isBotAdmins = false;

                if (isGroup) {
                    groupMetadata = await sock.groupMetadata(jid);
                    const participants = groupMetadata.participants;
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    isAdmins = !!participants.find(p => p.id === senderNumber && p.admin);
                    isBotAdmins = !!participants.find(p => p.id === botNumber && p.admin);
                }

                // .menu
                if (command === 'menu') {
                    await sendVoiceNote(sock, jid, config.VOICES.commands['.menu'], msg);

                    const menuMsg = `╭━━━〔 🤖 *${config.BOT_NAME}* 〕━━━╮
│
│ 👤 *User:* ${senderName}
│ ⚙️ *Prefix:* [ ${config.PREFIX} ]
│ 👑 *Owner:* ${config.OWNER_NAME}
│ ⏱️ *Uptime:* ${runtime(process.uptime())}
│
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👥 *GROUP COMMANDS* 〕━━━╮
│ .tagall
│ .hidetag
│ .admins
│ .kick
│ .promote
│ .demote
│ .open
│ .close
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 📥 *DOWNLOAD COMMANDS* 〕━━━╮
│ .song <නම/link>
│ .video <නම/link>
│ .tiktok <link>
│ .fb <link>
│ .ig <link>
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👑 *OWNER COMMANDS* 〕━━━╮
│ .owner
│ .restart
│ .broadcast <msg>
│ .eval <code>
╰━━━━━━━━━━━━━━━━━━━━━━╯

> *Powered by Sara MD Engine* ⚡`;

                    return await sock.sendMessage(jid, { text: menuMsg }, { quoted: msg });
                }

                // .alive
                if (command === 'alive') {
                    await sendVoiceNote(sock, jid, config.VOICES.commands['.alive'], msg);

                    const aliveMsg = `👋 *Hey ${senderName}! I'm Alive and Active!* 🌸

🤖 *Bot Name:* ${config.BOT_NAME}
👑 *Owner:* ${config.OWNER_NAME}
⏱️ *Uptime:* ${runtime(process.uptime())}
🧠 *AI Mode:* Gemini 1.5 Flash Active

_Type *${config.PREFIX}menu* to see all available commands!_`;

                    return await sock.sendMessage(jid, { text: aliveMsg }, { quoted: msg });
                }

                // .owner
                if (command === 'owner') {
                    const ownerMsg = `👑 *SARA MD BOT OWNER INFO*

👤 *Name:* ${config.OWNER_NAME}
📱 *WhatsApp:* https://wa.me/${config.OWNER_NUMBER}
🌐 *GitHub:* https://github.com
💻 *Project:* Sara Multi-Device Bot`;

                    return await sock.sendMessage(jid, { text: ownerMsg }, { quoted: msg });
                }

                // Routers
                if (['song', 'video', 'play', 'audio', 'tiktok', 'fb', 'ig'].includes(command)) {
                    return await handleDownloadCommands(sock, jid, msg, command, query);
                }

                if (isGroup && ['tagall', 'hidetag', 'admins', 'open', 'close', 'kick', 'promote', 'demote'].includes(command)) {
                    return await handleGroupCommands(sock, jid, msg, command, args, groupMetadata, isAdmins, isBotAdmins);
                }

                if (['restart', 'broadcast', 'eval'].includes(command)) {
                    return await handleOwnerCommands(sock, jid, msg, command, args, isOwner);
                }
            }

            // Gemini AI Auto Reply (Private Chats)
            if (text && !isGroup) {
                const aiReply = await getGeminiReply(text, senderName);
                if (aiReply) await sock.sendMessage(jid, { text: aiReply }, { quoted: msg });
            }

        } catch (error) {
            console.error('Error:', error);
        }
    });
}

startSaraBot();
