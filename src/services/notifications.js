const { createWagerEmbed, createMatchResultEmbed, createDisputeEmbed } = require('../utils/embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function sendWagerAlert(client, wager) {
    const channelId = process.env.WAGER_ALERTS_CHANNEL;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const creator = await client.users.fetch(wager.creator_id);
        const opponent = wager.opponent_id ? await client.users.fetch(wager.opponent_id) : null;

        const embed = createWagerEmbed(wager, creator, opponent);

        const components = [];
        
        // Add buttons for open challenges
        if (wager.status === 'open') {
            const wagerType = wager.wager_type || 'solo';
            
            if (wagerType === 'lft') {
                // LFT wager buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`lft_join_creator_${wager.id}`)
                            .setLabel('Join Creator Team')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('👥'),
                        new ButtonBuilder()
                            .setCustomId(`lft_join_opponent_${wager.id}`)
                            .setLabel('Join Opponent Team')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('👥'),
                        new ButtonBuilder()
                            .setCustomId(`view_wager_${wager.id}`)
                            .setLabel('View Details')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔍')
                    );
                components.push(row);
            } else {
                // Regular wager buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_wager_${wager.id}`)
                            .setLabel('Accept Challenge')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('⚔️'),
                        new ButtonBuilder()
                            .setCustomId(`view_wager_${wager.id}`)
                            .setLabel('View Details')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔍')
                    );
                components.push(row);
            }
        }

        await channel.send({ 
            embeds: [embed], 
            components: components
        });
    } catch (error) {
        console.error('Error sending wager alert:', error);
    }
}

async function sendMatchResult(client, wager, winnerId, loserId) {
    const channelId = process.env.MATCH_RESULTS_CHANNEL;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const embed = createMatchResultEmbed(wager, winnerId, loserId);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending match result:', error);
    }
}

async function sendDisputeAlert(client, wager, dispute) {
    const channelId = process.env.DISPUTES_CHANNEL;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const filer = await client.users.fetch(dispute.filer_id);
        const embed = createDisputeEmbed(wager, dispute, filer);
        
        await channel.send({ 
            embeds: [embed],
            content: '@here New dispute requires review'
        });
    } catch (error) {
        console.error('Error sending dispute alert:', error);
    }
}

async function sendDM(client, userId, message) {
    try {
        const user = await client.users.fetch(userId);
        await user.send(message);
    } catch (error) {
        console.error(`Error sending DM to user ${userId}:`, error);
    }
}

async function notifyWagerAccepted(client, wager) {
    const message = `Your wager #${wager.id} has been accepted! The match is now in progress. Use \`/wager submit ${wager.id} <match_id>\` to submit proof when you win.`;
    await sendDM(client, wager.creator_id, message);
    await sendDM(client, wager.opponent_id, message);
}

async function notifyWagerSubmitted(client, wager, submitterId) {
    const otherPlayerId = submitterId === wager.creator_id ? wager.opponent_id : wager.creator_id;
    const message = `A win has been submitted for wager #${wager.id}. You have 24 hours to dispute if you disagree. Use \`/wager dispute ${wager.id} <reason>\` to file a dispute.`;
    await sendDM(client, otherPlayerId, message);
}

async function notifyWagerCompleted(client, wager, winnerId) {
    const loserId = winnerId === wager.creator_id ? wager.opponent_id : wager.creator_id;
    
    const winnerMessage = `Congratulations! You won wager #${wager.id}. Your winnings have been added to your balance.`;
    const loserMessage = `Wager #${wager.id} has been completed. Better luck next time!`;
    
    await sendDM(client, winnerId, winnerMessage);
    await sendDM(client, loserId, loserMessage);
}

async function notifyDispute(client, wager, dispute) {
    const message = `A dispute has been filed for wager #${wager.id}. The wager is now under review by moderators.`;
    
    if (wager.creator_id !== dispute.filer_id) {
        await sendDM(client, wager.creator_id, message);
    }
    if (wager.opponent_id !== dispute.filer_id) {
        await sendDM(client, wager.opponent_id, message);
    }
}

module.exports = {
    sendWagerAlert,
    sendMatchResult,
    sendDisputeAlert,
    sendDM,
    notifyWagerAccepted,
    notifyWagerSubmitted,
    notifyWagerCompleted,
    notifyDispute
};
