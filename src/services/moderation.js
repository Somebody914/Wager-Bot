const { createErrorEmbed } = require('../utils/embeds');

/**
 * Channel moderation service
 * Manages message filtering and auto-deletion in moderated channels
 */

// Get moderated channels from environment
function getModeratedChannels() {
    const channels = {};
    
    // Wager alerts channel (also known as OPEN_CHALLENGES_CHANNEL)
    if (process.env.WAGER_ALERTS_CHANNEL || process.env.OPEN_CHALLENGES_CHANNEL) {
        channels.wagerAlerts = process.env.OPEN_CHALLENGES_CHANNEL || process.env.WAGER_ALERTS_CHANNEL;
    }
    
    // Disputes channel
    if (process.env.DISPUTES_CHANNEL) {
        channels.disputes = process.env.DISPUTES_CHANNEL;
    }
    
    return channels;
}

/**
 * Check if moderation is enabled
 */
function isModerationEnabled() {
    return process.env.MODERATION_ENABLED === 'true';
}

/**
 * Check if a channel should be moderated
 */
function isModeratedChannel(channelId) {
    if (!isModerationEnabled()) {
        return false;
    }
    
    const moderatedChannels = getModeratedChannels();
    return Object.values(moderatedChannels).includes(channelId);
}

/**
 * Get channel type based on channel ID
 */
function getChannelType(channelId) {
    const moderatedChannels = getModeratedChannels();
    
    if (channelId === moderatedChannels.wagerAlerts) {
        return 'wager_alerts';
    }
    if (channelId === moderatedChannels.disputes) {
        return 'disputes';
    }
    
    return null;
}

/**
 * Check if a message should be allowed in a moderated channel
 */
function shouldAllowMessage(message, channelType) {
    // Always allow bot messages
    if (message.author.bot) {
        return true;
    }
    
    // For wager alerts channel: only allow wager-related commands
    if (channelType === 'wager_alerts') {
        const content = message.content.toLowerCase().trim();
        // Allow commands like /wager create, /wager accept, etc.
        if (content.startsWith('/wager')) {
            return true;
        }
        return false;
    }
    
    // For disputes channel: only allow dispute-related commands
    if (channelType === 'disputes') {
        const content = message.content.toLowerCase().trim();
        // Allow commands like /wager dispute
        if (content.startsWith('/wager dispute')) {
            return true;
        }
        return false;
    }
    
    return false;
}

/**
 * Send a warning DM to a user who posted in a moderated channel
 */
async function sendWarningDM(user, channelType, channelName) {
    try {
        let warningMessage = '';
        
        if (channelType === 'wager_alerts') {
            warningMessage = `⚠️ **Channel Moderation Warning**\n\n` +
                `The **${channelName}** channel is reserved for wager creation posts from the bot only.\n\n` +
                `Your message was automatically deleted. Please use wager commands (e.g., \`/wager create\`, \`/wager accept\`) in the appropriate channels.\n\n` +
                `For general discussion, please use other channels.`;
        } else if (channelType === 'disputes') {
            warningMessage = `⚠️ **Channel Moderation Warning**\n\n` +
                `The **${channelName}** channel is reserved for dispute alerts from the bot only.\n\n` +
                `Your message was automatically deleted. To file a dispute, use the \`/wager dispute\` command.\n\n` +
                `For general discussion, please use other channels.`;
        }
        
        const embed = createErrorEmbed(warningMessage);
        await user.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Error sending warning DM to user ${user.id}:`, error);
        // User might have DMs disabled, which is okay
    }
}

/**
 * Handle a message in a moderated channel
 */
async function handleModeratedMessage(message) {
    const channelType = getChannelType(message.channel.id);
    
    if (!channelType) {
        return;
    }
    
    // Check if message should be allowed
    if (!shouldAllowMessage(message, channelType)) {
        try {
            // Delete the message
            await message.delete();
            console.log(`Deleted unauthorized message from ${message.author.tag} in ${channelType} channel`);
            
            // Send warning DM
            await sendWarningDM(message.author, channelType, message.channel.name);
        } catch (error) {
            console.error('Error handling moderated message:', error);
        }
    }
}

module.exports = {
    isModerationEnabled,
    isModeratedChannel,
    handleModeratedMessage,
    getChannelType
};
