const { Innertube } = require('youtubei.js');
const fs = require('fs');
const path = require('path');

let youtubeInstance = null;

async function getYoutube() {
    if (!youtubeInstance) {
        youtubeInstance = await Innertube.create({ 
            generate_session_locally: true 
        });
    }
    return youtubeInstance;
}

async function handleDownloadCommands(sock, jid, msg, command, query) {
    if (!query && ['song', 'video', 'play', 'audio'].includes(command)) {
        return await sock.sendMessage(jid, { text: '❌ කරුණාකර සින්දුවේ නම හෝ ලින්ක් එක ඇතුළත් කරන්න!\n\n*Example:* `.song lelena`' }, { quoted: msg });
    }

    if (['song', 'play', 'audio'].includes(command)) {
        await sock.sendMessage(jid, { text: `🔍 *YouTube හි සෙවීම සිදුකරයි:* "${query}"...` }, { quoted: msg });

        try {
            const youtube = await getYoutube();
            
            // YouTube Search
            const searchResult = await youtube.search(query, { type: 'video' });
            if (!searchResult.videos || searchResult.videos.length === 0) {
                return await sock.sendMessage(jid, { text: '❌ YouTube එකෙන් කිසිදු ප්‍රතිඵලයක් හමු වූයේ නැත!' }, { quoted: msg });
            }

            const video = searchResult.videos[0];
            const videoId = video.id;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const videoTitle = video.title?.text || 'audio';

            // වීඩියෝ විස්තර සහ Thumbnail යැවීම
            const infoText = `🎶 *SARA MD YOUTUBE DOWNLOADER* 🎶\n\n` +
                             `📌 *Title:* ${videoTitle}\n` +
                             `⏱️ *Duration:* ${video.duration?.text || 'N/A'}\n` +
                             `👤 *Channel:* ${video.author?.name || 'Unknown'}\n` +
                             `🔗 *Link:* ${videoUrl}\n\n` +
                             `⏳ *Audio එක ඩවුන්ලෝඩ් වෙමින් පවතී, පොඩ්ඩක් ඉන්න...*`;

            const thumbUrl = video.thumbnails?.[0]?.url || '';

            if (thumbUrl) {
                await sock.sendMessage(jid, { 
                    image: { url: thumbUrl }, 
                    caption: infoText 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { text: infoText }, { quoted: msg });
            }

            // YouTube Audio Stream එක කෙලින්ම ඩවුන්ලෝඩ් කර Buffer එකක් ලබා ගැනීම
            const stream = await youtube.download(videoId, {
                type: 'audio',
                quality: 'best'
            });

            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // WhatsApp වෙත Audio File එක යැවීම
            await sock.sendMessage(jid, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${videoTitle.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`
            }, { quoted: msg });

        } catch (error) {
            console.error('YouTube Module Download Error:', error.message);
            await sock.sendMessage(jid, { text: `❌ සින්දුව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් සිදු විය!` }, { quoted: msg });
        }
    }
}

module.exports = { handleDownloadCommands };
