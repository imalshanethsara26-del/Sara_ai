const config = require('../config');

async function handleOwnerCommands(sock, jid, msg, command, args, isOwner) {
    if (!isOwner) return await sock.sendMessage(jid, { text: '❌ මෙය Bot Owner ට පමණක් භාවිත කළ හැක!' }, { quoted: msg });

    if (command === 'restart') {
        await sock.sendMessage(jid, { text: '🔄 Sara MD නැවත ආරම්භ වේ...' }, { quoted: msg });
        process.exit(0);
    }

    if (command === 'broadcast') {
        const bcText = args.join(' ');
        if (!bcText) return await sock.sendMessage(jid, { text: '❌ Broadcast කිරීමට මෙසේජ් එකක් ඇතුළත් කරන්න!' });

        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.keys(chats);

        await sock.sendMessage(jid, { text: `📢 Groups ${groups.length} කට Broadcast කිරීම ආරම්භ විය...` });
        for (let id of groups) {
            await sock.sendMessage(id, { text: `📢 *SARA MD BROADCAST*\n\n${bcText}` });
        }
        await sock.sendMessage(jid, { text: '✅ Broadcast එක සාර්ථකව අවසන් විය!' });
    }

    if (command === 'eval') {
        try {
            let code = args.join(' ');
            let evaled = await eval(code);
            if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
            await sock.sendMessage(jid, { text: evaled }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, { text: String(err) }, { quoted: msg });
        }
    }
}

module.exports = { handleOwnerCommands };
