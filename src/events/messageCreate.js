const { Events } = require('discord.js');
const { isModeratedChannel, handleModeratedMessage } = require('../services/moderation');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore messages from bots (including ourselves)
        if (message.author.bot) {
            return;
        }
        
        // Check if this is a moderated channel
        if (isModeratedChannel(message.channel.id)) {
            await handleModeratedMessage(message);
        }
    }
};
