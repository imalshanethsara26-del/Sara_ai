const axios = require('axios');
const yts = require('yt-search');

// YouTube Link එකෙන් Direct MP3 Audio Link එක හෝ Buffer එක ලබාගැනීම
async function getAudioBufferOrUrl(youtubeUrl) {
    console.log(`\n-------------------------------------------`);
    console.log(`🔗 Passing URL to API: ${youtubeUrl}`);
    console.log(`-------------------------------------------\n`);

    const apis = [
        `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
        `https://api.vreden.web.id/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
        `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
        `https://widipe.com/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`
    ];

    for (let api of apis) {
        try {
            console.log(`🌐 Trying API: ${api}`);
            const res = await axios.get(api, { timeout: 15000 });
            
            let dlUrl = res.data?.data?.dl || 
                        res.data?.result?.download_url || 
                        res.data?.result?.dl || 
                        res.data?.result?.download?.url ||
                        res.data?.result?.download ||
                        res.data?.url;

            if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
                console.log(`✅ Success! Download URL Found: ${dlUrl}`);
                return dlUrl;
            }
        } catch (e) {
            console.log(`⚠️ API Failed/Timed out, trying next... (${e.message})`);
            continue;
        }
    }
    return null;
}

// YouTube Video (.mp4) Downloader
async function getVideoDownloadUrl(youtubeUrl) {
    const apis = [
        `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(youtubeUrl)}`,
        `https://api.vreden.web.id/api/ytmp4?url=${encodeURIComponent(youtubeUrl)}`,
        `https://widipe.com/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
    ];

    for (let api of apis) {
        try {
            const res = await axios.get(api, { timeout: 18000 });
            let dlUrl = res.data?.data?.dl || 
                        res.data?.result?.download_url || 
                        res.data?.result?.dl || 
                        res.data?.result?.download;

            if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
                return dlUrl;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

async function handleDownloadCommands(sock, jid, msg, command, query) {
    if (!query && ['song', 'video', 'play', 'audio'].includes(command)) {
        return await sock.sendMessage(jid, { text: '❌ කරුණාකර සින්දුවේ හෝ වීඩියෝවේ නම/Link එක ඇතුළත් කරන්න!\n\n*Example:* `.song lelena`' }, { quoted: msg });
    }

    // 1. YouTube Song / Audio Download (.song / .play / .audio)
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

            // Direct MP3 Link එක අරන් File එක Fetch කිරීම
            const audioDlUrl = await getAudioBufferOrUrl(video.url);

            if (audioDlUrl) {
                // Direct Buffer එකක් ලෙස Download කර යැවීම (Fail වීම වැළැක්වීමට)
                const audioBuffer = await axios.get(audioDlUrl, { responseType: 'arraybuffer' });

                await sock.sendMessage(jid, {
                    audio: Buffer.from(audioBuffer.data),
                    mimetype: 'audio/mpeg',
                    fileName: `${video.title}.mp3`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { text: '❌ කණගාටුයි, සියලුම Download APIs මෙම අවස්ථාවේ වැඩ නොකරයි. නැවත උත්සාහ කරන්න!' }, { quoted: msg });
            }

        } catch (error) {
            console.error('Song Command Error:', error.message);
            await sock.sendMessage(jid, { text: '❌ සින්දුව Download කිරීමේදී දෝෂයක් සිදු විය!' }, { quoted: msg });
        }
    }

    // 2. YouTube Video Download (.video)
    if (command === 'video') {
        await sock.sendMessage(jid, { text: `🔍 *YouTube Video එක සොයමින් පවතී:* "${query}"...` }, { quoted: msg });

        try {
            const searchResult = await yts(query);
            const video = searchResult.videos[0];

            if (!video) {
                return await sock.sendMessage(jid, { text: '❌ වීඩියෝව හමු වූයේ නැත!' }, { quoted: msg });
            }

            const videoDlUrl = await getVideoDownloadUrl(video.url);

            if (videoDlUrl) {
                await sock.sendMessage(jid, {
                    video: { url: videoDlUrl },
                    caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n🔗 ${video.url}\n\n✅ *Powered by Sara MD*`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { text: '❌ Video එක Download කිරීමට නොහැකි විය!' }, { quoted: msg });
            }

        } catch (error) {
            console.error('Video Command Error:', error.message);
            await sock.sendMessage(jid, { text: '❌ Video Download කිරීමේදී දෝෂයක් සිදු විය!' }, { quoted: msg });
        }
    }
}

module.exports = { handleDownloadCommands };
