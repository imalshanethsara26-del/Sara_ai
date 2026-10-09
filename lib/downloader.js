const axios = require('axios');
const yts = require('yt-search');

async function cobaltDownload(url, isAudio = false) {
    try {
        const response = await axios.post('https://api.cobalt.tools/', {
            url: url,
            downloadMode: isAudio ? 'audio' : 'auto',
            audioFormat: 'mp3',
            quality: '720'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data?.url || null;
    } catch (err) {
        console.error('Cobalt Error:', err.message);
        return null;
    }
}

async function tiktokDownload(url) {
    try {
        const res = await axios.post('https://www.tikwm.com/api/', { url: url });
        if (res.data && res.data.data) {
            return res.data.data.play;
        }
        return null;
    } catch (err) {
        console.error('TikTok API Error:', err.message);
        return null;
    }
}

async function handleDownloadCommands(sock, jid, msg, command, query) {
    if (!query && ['song', 'video', 'play', 'tiktok', 'fb', 'ig'].includes(command)) {
        return await sock.sendMessage(jid, { text: '❌ කරුණාකර Link එකක් හෝ සින්දුවේ නම ඇතුළත් කරන්න!' }, { quoted: msg });
    }

    if (command === 'song' || command === 'play' || command === 'audio') {
        await sock.sendMessage(jid, { text: '🔍 සින්දුව සෙවීම සිදුකරයි, පොඩ්ඩක් ඉන්න...' }, { quoted: msg });
        const search = await yts(query);
        const video = search.videos[0];
        if (!video) return await sock.sendMessage(jid, { text: '❌ සින්දුව හමු වූයේ නැත!' });

        const downloadUrl = await cobaltDownload(video.url, true);
        if (downloadUrl) {
            await sock.sendMessage(jid, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mp4',
                fileName: `${video.title}.mp3`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: '❌ Audio එක Download කරගැනීමට නොහැකි විය!' }, { quoted: msg });
        }
    }

    if (command === 'video') {
        await sock.sendMessage(jid, { text: '🎥 වීඩියෝව Download වෙමින් පවතී...' }, { quoted: msg });
        const search = await yts(query);
        const video = search.videos[0];
        if (!video) return await sock.sendMessage(jid, { text: '❌ වීඩියෝව හමු වූයේ නැත!' });

        const downloadUrl = await cobaltDownload(video.url, false);
        if (downloadUrl) {
            await sock.sendMessage(jid, {
                video: { url: downloadUrl },
                caption: `🎬 *${video.title}*`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: '❌ Video එක Download කරගැනීමට නොහැකි විය!' }, { quoted: msg });
        }
    }

    if (command === 'tiktok') {
        await sock.sendMessage(jid, { text: '🎵 TikTok Video එක Download වෙමින් පවතී...' }, { quoted: msg });
        const videoUrl = await tiktokDownload(query);
        if (videoUrl) {
            await sock.sendMessage(jid, { video: { url: videoUrl }, caption: '✅ Powered by Sara MD' }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: '❌ TikTok Video එක Download කිරීමට නොහැකි විය!' }, { quoted: msg });
        }
    }

    if (command === 'fb' || command === 'ig') {
        await sock.sendMessage(jid, { text: '📥 Media එක Download වෙමින් පවතී...' }, { quoted: msg });
        const mediaUrl = await cobaltDownload(query, false);
        if (mediaUrl) {
            await sock.sendMessage(jid, { video: { url: mediaUrl }, caption: '✅ Powered by Sara MD' }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: '❌ Media එක Download කරගැනීමට නොහැකි විය!' }, { quoted: msg });
        }
    }
}

module.exports = { handleDownloadCommands };
