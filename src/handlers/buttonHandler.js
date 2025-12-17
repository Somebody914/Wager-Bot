const { userOps, wagerOps } = require('../services/database');
const { createWagerEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { GAME_CHOICES } = require('../utils/constants');
const { notifyWagerAccepted } = require('../services/notifications');

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    try {
        if (customId.startsWith('accept_wager_')) {
            await handleAcceptWager(interaction);
        } else if (customId.startsWith('view_wager_')) {
            await handleViewWager(interaction);
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
        const embed = createErrorEmbed('An error occurred. Please try again.');
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleAcceptWager(interaction) {
    const wagerId = parseInt(interaction.customId.split('_')[2]);

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'open') {
        const embed = createErrorEmbed('This wager is no longer open for acceptance.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Cannot accept own wager
    if (wager.creator_id === interaction.user.id) {
        const embed = createErrorEmbed('You cannot accept your own wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Accept wager
    wagerOps.accept(wagerId, interaction.user.id);

    const gameName = GAME_CHOICES.find(g => g.value === wager.game)?.name || wager.game;
    const embed = createSuccessEmbed(
        `✅ Challenge accepted!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Amount:** ${wager.amount} ETH\n\n` +
        `The match is now in progress. Submit your win proof using \`/wager submit ${wagerId} <match_id>\` when you win.`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Notify both players
    const updatedWager = wagerOps.get(wagerId);
    await notifyWagerAccepted(interaction.client, updatedWager);

    // Update the original message to remove buttons
    try {
        await interaction.message.edit({ components: [] });
    } catch (error) {
        console.error('Error updating message:', error);
    }
}

async function handleViewWager(interaction) {
    const wagerId = parseInt(interaction.customId.split('_')[2]);

    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const creator = await interaction.client.users.fetch(wager.creator_id);
    const opponent = wager.opponent_id ? await interaction.client.users.fetch(wager.opponent_id) : null;

    const embed = createWagerEmbed(wager, creator, opponent);
    
    if (wager.match_id) {
        embed.addFields({ name: 'Match ID', value: wager.match_id, inline: true });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleButtonInteraction };
