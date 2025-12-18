const { userOps, wagerOps, participantOps } = require('../services/database');
const { createWagerEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { GAME_CHOICES, WAGER_TYPES } = require('../utils/constants');
const { notifyWagerAccepted } = require('../services/notifications');

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    try {
        if (customId.startsWith('accept_wager_')) {
            await handleAcceptWager(interaction);
        } else if (customId.startsWith('view_wager_')) {
            await handleViewWager(interaction);
        } else if (customId.startsWith('lft_join_creator_')) {
            await handleLftJoin(interaction, 'creator');
        } else if (customId.startsWith('lft_join_opponent_')) {
            await handleLftJoin(interaction, 'opponent');
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

async function handleLftJoin(interaction, side) {
    const wagerId = parseInt(interaction.customId.split('_')[3]);

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

    // Check if wager is LFT type
    if (wager.wager_type !== WAGER_TYPES.LFT) {
        const embed = createErrorEmbed('This wager is not an LFT (Looking For Teammates) wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if wager is still open
    if (wager.status !== 'open') {
        const embed = createErrorEmbed('This wager is no longer accepting players.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is already in the wager
    if (wager.creator_id === interaction.user.id) {
        const embed = createErrorEmbed('You are the creator of this wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const existingParticipants = participantOps.getByWager(wagerId);
    if (existingParticipants.some(p => p.discord_id === interaction.user.id)) {
        const embed = createErrorEmbed('You are already in this wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if the side is full
    const sideCount = participantOps.getCount(wagerId, side);
    const maxPerSide = wager.team_size;

    // For creator side, we need to account for the creator themselves
    const currentSideCount = side === 'creator' ? sideCount + 1 : sideCount;

    if (currentSideCount >= maxPerSide) {
        const embed = createErrorEmbed(`The ${side} side is already full (${maxPerSide}/${maxPerSide}).`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add participant
    participantOps.add(wagerId, interaction.user.id, side);

    const newSideCount = currentSideCount + 1;
    const gameName = GAME_CHOICES.find(g => g.value === wager.game)?.name || wager.game;

    const embed = createSuccessEmbed(
        `✅ Successfully joined the wager!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Side:** ${side === 'creator' ? 'Creator' : 'Opponent'}\n` +
        `**Team Size:** ${newSideCount}/${maxPerSide}\n\n` +
        `${newSideCount === maxPerSide ? '✅ Your side is now full!' : `Waiting for ${maxPerSide - newSideCount} more player(s) on your side.`}`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Check if both sides are full
    const creatorSideCount = participantOps.getCount(wagerId, 'creator') + 1; // +1 for creator
    const opponentSideCount = participantOps.getCount(wagerId, 'opponent');

    if (creatorSideCount === maxPerSide && opponentSideCount === maxPerSide) {
        // Both sides are full, accept the wager
        // Set the first opponent participant as the opponent
        const opponentParticipants = participantOps.getByWager(wagerId, 'opponent');
        if (opponentParticipants.length > 0) {
            wagerOps.accept(wagerId, opponentParticipants[0].discord_id);
            
            // Update the original message to remove buttons
            try {
                await interaction.message.edit({ components: [] });
            } catch (error) {
                console.error('Error updating message:', error);
            }

            // Notify all participants
            const allParticipants = participantOps.getByWager(wagerId);
            
            for (const participant of allParticipants) {
                try {
                    const user = await interaction.client.users.fetch(participant.discord_id);
                    await user.send(
                        `✅ Wager #${wagerId} is now full and ready to start!\n\n` +
                        `All ${maxPerSide}v${maxPerSide} slots have been filled. Good luck!`
                    );
                } catch (error) {
                    console.error('Error notifying participant:', error);
                }
            }

            // Also notify the creator
            try {
                const creator = await interaction.client.users.fetch(wager.creator_id);
                await creator.send(
                    `✅ Your wager #${wagerId} is now full and ready to start!\n\n` +
                    `All ${maxPerSide}v${maxPerSide} slots have been filled. Good luck!`
                );
            } catch (error) {
                console.error('Error notifying creator:', error);
            }
        }
    }
}

module.exports = { handleButtonInteraction };
