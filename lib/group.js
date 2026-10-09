async function handleGroupCommands(sock, jid, msg, command, args, groupMetadata, isAdmins, isBotAdmins) {
    if (!isAdmins) return await sock.sendMessage(jid, { text: '❌ මේ Command එක භාවිත කළ හැක්කේ Group Admins ලට පමණි!' }, { quoted: msg });

    const participants = groupMetadata.participants;

    if (command === 'tagall') {
        let text = `📢 *ATTENTION EVERYONE*\n\n`;
        for (let mem of participants) {
            text += `🔘 @${mem.id.split('@')[0]}\n`;
        }
        await sock.sendMessage(jid, { text: text, mentions: participants.map(a => a.id) }, { quoted: msg });
    }

    if (command === 'hidetag') {
        const message = args.join(' ') || 'Announcement!';
        await sock.sendMessage(jid, { text: message, mentions: participants.map(a => a.id) });
    }

    if (command === 'admins') {
        const groupAdmins = participants.filter(v => v.admin !== null);
        let text = `👑 *GROUP ADMINS*\n\n`;
        for (let admin of groupAdmins) {
            text += `⭐ @${admin.id.split('@')[0]}\n`;
        }
        await sock.sendMessage(jid, { text: text, mentions: groupAdmins.map(a => a.id) }, { quoted: msg });
    }

    if (command === 'open') {
        if (!isBotAdmins) return await sock.sendMessage(jid, { text: '❌ Bot ට Admin බලතල නැත!' });
        await sock.groupSettingUpdate(jid, 'not_announcement');
        await sock.sendMessage(jid, { text: '🔓 Group Chat Opened!' });
    }
    if (command === 'close') {
        if (!isBotAdmins) return await sock.sendMessage(jid, { text: '❌ Bot ට Admin බලතල නැත!' });
        await sock.groupSettingUpdate(jid, 'announcement');
        await sock.sendMessage(jid, { text: '🔒 Group Chat Closed (Admins Only)!' });
    }

    if (['kick', 'promote', 'demote'].includes(command)) {
        if (!isBotAdmins) return await sock.sendMessage(jid, { text: '❌ Bot ට Admin බලතල නැත!' });
        
        let users = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            users.push(msg.message.extendedTextMessage.contextInfo.participant);
        }

        if (users.length === 0) return await sock.sendMessage(jid, { text: '❌ කරුණාකර Member කෙනෙක් Mention හෝ Reply කරන්න!' });

        const action = command === 'kick' ? 'remove' : command;
        await sock.groupParticipantsUpdate(jid, users, action);
        await sock.sendMessage(jid, { text: `✅ Action executed successfully!` });
    }
}

module.exports = { handleGroupCommands };
