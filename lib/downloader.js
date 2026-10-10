const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const yts = require('yt-search');

// Colab එකේ yt-dlp භාවිතයෙන් Direct MP3 Download කිරීම
function downloadWithYtdlp(youtubeUrl) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(__dirname, `../temp_${Date.now()}.mp3`);
        
        // yt-dlp Command එක run කිරීම
        const command = `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${youtubeUrl}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('yt-dlp error:', stderr);
                return resolve(null);
            }
            if (fs.existsSync(outputPath)) {
                resolve(outputPath);
            } else {
                resolve(null);
            }
        });
    });
}

async function handleDownloadCommands(sock, jid, msg, command, query) {
    if (!query && ['song', 'video', 'play', 'audio'].includes(command)) {
        return await sock.sendMessage(jid, { text: '❌ කරුණාකර සින්දුවේ හෝ වීඩියෝවේ නම/Link එක ඇතුළත් කරන්න!\n\n*Example:* `.song lelena`' }, { quoted: msg });
    }

    if (['song', 'play', 'audio'].includes(command)) {
        await sock.sendMessage(jid, { text: `🔍 *YouTube හි සෙවීම සිදුකරයි:* "${query}"...` }, { quoted: msg });

        try {
            const searchResult = await yts(query);
            const video = searchResult.videos[0];

            if (!video) {
                return await sock.sendMessage(jid, { text: '❌ YouTube එකෙන් කිසිදු ප්‍රතිඵලයක් හමු වූයේ නැත!' }, { quoted: msg });
            }

            // වීඩියෝ විස්තර යැවීම
            const infoText = `🎶 *SARA MD YOUTUBE DOWNLOADER* 🎶\n\n` +
                             `📌 *Title:* ${video.title}\n` +
                             `⏱️ *Duration:* ${video.timestamp}\n` +
                             `👤 *Channel:* ${video.author.name}\n` +
                             `🔗 *Link:* ${video.url}\n\n` +
                             `⏳ *Audio එක Download වෙමින් පවතී, පොඩ්ඩක් ඉන්න...*`;

            await sock.sendMessage(jid, { 
                image: { url: video.thumbnail }, 
                caption: infoText 
            }, { quoted: msg });

            // Direct yt-dlp හරහා Download කිරීම
            const filePath = await downloadWithYtdlp(video.url);

            if (filePath && fs.existsSync(filePath)) {
                await sock.sendMessage(jid, {
                    audio: fs.readFileSync(filePath),
                    mimetype: 'audio/mpeg',
                    fileName: `${video.title}.mp3`
                }, { quoted: msg });

                // Temp file එක Delete කිරීම
                fs.unlinkSync(filePath);
            } else {
                await sock.sendMessage(jid, { text: '❌ Audio එක Download කිරීමට නොහැකි විය!' }, { quoted: msg });
            }

        } catch (error) {
            console.error('Song Command Error:', error.message);
            await sock.sendMessage(jid, { text: '❌ සින්දුව Download කිරීමේදී දෝෂයක් සිදු විය!' }, { quoted: msg });
        }
    }
}

module.exports = { handleDownloadCommands };
