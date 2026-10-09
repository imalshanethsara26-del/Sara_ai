const axios = require('axios');
const yts = require('yt-search');

// Working YouTube Downloader API
async function downloadYtAudio(youtubeUrl) {
    try {
        const res = await axios.get(`https://api.vreden.web.id/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}`);
        if (res.data && res.data.result && res.data.result.download) {
            return res.data.result.download.url || res.data.result.download;
        }
        return null;
    } catch (err) {
        console.error('Download API Error:', err.message);
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
        if (!video) return await sock.sendMessage(jid, { text: '❌ සින්දුව හමු වූයේ නැත!' }, { quoted: msg });

        const downloadUrl = await downloadYtAudio(video.url);
        if (downloadUrl) {
            await sock.sendMessage(jid, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, { text: '❌ Audio එක Download කරගැනීමට නොහැකි විය!' }, { quoted: msg });
        }
    }
}

module.exports = { handleDownloadCommands };
