const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const fs = require('fs');
const pino = require('pino');
const config = require('./config');

const { handleDownloadCommands } = require('./lib/downloader');
const { handleGroupCommands } = require('./lib/group');
const { handleOwnerCommands } = require('./lib/owner');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// MongoDB Connect Logic
mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('✅ MongoDB Database Connected!'))
    .catch((err) => console.log('⚠️ Database Connection Warning (Bypassed):', err.message));

function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor((seconds % (3600 * 24)) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    return (d > 0 ? d + "d " : "") + (h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") + s + "s";
}

async function getGeminiReply(userPrompt, senderName) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const systemPrompt = `You are Sara, a friendly and witty Sri Lankan WhatsApp AI bot. User: ${senderName}. Reply naturally in casual Sinhala/Singlish. Keep it short.`;
        const result = await model.generateContent([systemPrompt, userPrompt]);
        return result.response.text();
    } catch (e) {
        return null;
    }
}

// Voice Note Sender Function (Fixed for Playback)
async function sendVoiceNote(sock, jid, audioPath, quotedMsg) {
    if (fs.existsSync(audioPath)) {
        await sock.sendMessage(jid, {
            audio: fs.readFileSync(audioPath),
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: quotedMsg });
    }
}

async function startSaraBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

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
            if (shouldReconnect) startSaraBot();
        } else if (connection === 'open') {
            console.log('🚀 Sara MD Bot Active & Ready!');
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

            // Simple Keyword Voice Triggers (hi, gm, mk, gn)
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

                // .menu Command
                if (command === 'menu') {
                    // 1. Send Voice
                    await sendVoiceNote(sock, jid, config.VOICES.commands['.menu'], msg);

                    // 2. Send Text Menu
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

                // .alive Command
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

                // .owner Command
                if (command === 'owner') {
                    const ownerMsg = `👑 *SARA MD BOT OWNER INFO*

👤 *Name:* ${config.OWNER_NAME}
📱 *WhatsApp:* https://wa.me/${config.OWNER_NUMBER}
🌐 *GitHub:* https://github.com
💻 *Project:* Sara Multi-Device Bot`;

                    return await sock.sendMessage(jid, { text: ownerMsg }, { quoted: msg });
                }

                // Downloader Router
                if (['song', 'video', 'play', 'audio', 'tiktok', 'fb', 'ig'].includes(command)) {
                    return await handleDownloadCommands(sock, jid, msg, command, query);
                }

                // Group Router
                if (isGroup && ['tagall', 'hidetag', 'admins', 'open', 'close', 'kick', 'promote', 'demote'].includes(command)) {
                    return await handleGroupCommands(sock, jid, msg, command, args, groupMetadata, isAdmins, isBotAdmins);
                }

                // Owner Router
                if (['restart', 'broadcast', 'eval'].includes(command)) {
                    return await handleOwnerCommands(sock, jid, msg, command, args, isOwner);
                }
            }

            // Gemini AI Auto Reply
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
