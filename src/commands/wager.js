const { SlashCommandBuilder } = require('discord.js');
const { userOps, wagerOps, disputeOps } = require('../services/database');
const { createWagerEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { GAME_CHOICES, PLATFORM_FEE } = require('../utils/constants');
const { sendWagerAlert, notifyWagerAccepted, notifyWagerSubmitted, notifyWagerCompleted, notifyDispute, sendMatchResult, sendDisputeAlert } = require('../services/notifications');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wager')
        .setDescription('Manage wagers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new wager')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The game to wager on')
                        .setRequired(true)
                        .addChoices(...GAME_CHOICES))
                .addNumberOption(option =>
                    option.setName('amount')
                        .setDescription('Wager amount in ETH')
                        .setRequired(true)
                        .setMinValue(0.001))
                .addUserOption(option =>
                    option.setName('opponent')
                        .setDescription('Challenge a specific user (leave empty for open challenge)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('accept')
                .setDescription('Accept an open challenge')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check wager details and status')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit win proof with match ID')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('match_id')
                        .setDescription('Match ID for verification')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dispute')
                .setDescription('File a dispute on a wager')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the dispute')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction);
                    break;
                case 'accept':
                    await handleAccept(interaction);
                    break;
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'submit':
                    await handleSubmit(interaction);
                    break;
                case 'dispute':
                    await handleDispute(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in wager ${subcommand}:`, error);
            const embed = createErrorEmbed('An error occurred. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

async function handleCreate(interaction) {
    const game = interaction.options.getString('game');
    const amount = interaction.options.getNumber('amount');
    const opponent = interaction.options.getUser('opponent');

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate opponent
    if (opponent) {
        if (opponent.id === interaction.user.id) {
            const embed = createErrorEmbed('You cannot challenge yourself!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const opponentUser = userOps.get(opponent.id);
        if (!opponentUser || !opponentUser.verified) {
            const embed = createErrorEmbed('The opponent must be verified before you can challenge them.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // Create wager
    const wagerId = wagerOps.create(
        interaction.user.id,
        opponent ? opponent.id : null,
        game,
        amount
    );

    const wager = wagerOps.get(wagerId);
    const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;
    const fee = (amount * PLATFORM_FEE).toFixed(4);
    const payout = (amount * 2 * (1 - PLATFORM_FEE)).toFixed(4);

    const embed = createSuccessEmbed(
        `✅ Wager created successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Amount:** ${amount} ETH\n` +
        `**Platform Fee:** ${fee} ETH (3%)\n` +
        `**Winner Payout:** ${payout} ETH\n` +
        `**Opponent:** ${opponent ? opponent.toString() : 'Open Challenge'}\n\n` +
        (opponent ? 'Your opponent has been notified.' : 'Other players can accept this challenge using `/wager accept ' + wagerId + '`.')
    );

    await interaction.reply({ embeds: [embed] });

    // Send wager alert to channel
    await sendWagerAlert(interaction.client, wager);

    // Notify opponent if direct challenge
    if (opponent) {
        await notifyWagerAccepted(interaction.client, wager);
    }
}

async function handleAccept(interaction) {
    const wagerId = interaction.options.getInteger('id');

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

    await interaction.reply({ embeds: [embed] });

    // Notify both players
    const updatedWager = wagerOps.get(wagerId);
    await notifyWagerAccepted(interaction.client, updatedWager);
}

async function handleStatus(interaction) {
    const wagerId = interaction.options.getInteger('id');

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

async function handleSubmit(interaction) {
    const wagerId = interaction.options.getInteger('id');
    const matchId = interaction.options.getString('match_id');

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate participant
    if (wager.creator_id !== interaction.user.id && wager.opponent_id !== interaction.user.id) {
        const embed = createErrorEmbed('You are not a participant in this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'accepted' && wager.status !== 'in_progress') {
        const embed = createErrorEmbed('This wager is not in progress.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Submit win
    wagerOps.submit(wagerId, matchId, interaction.user.id);

    const embed = createSuccessEmbed(
        `✅ Win submitted successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Match ID:** ${matchId}\n\n` +
        `Your opponent has 24 hours to dispute. If no dispute is filed, the wager will be automatically completed.`
    );

    await interaction.reply({ embeds: [embed] });

    // Notify opponent
    await notifyWagerSubmitted(interaction.client, wager, interaction.user.id);

    // Auto-complete after verification period (in production, this would be handled by a scheduled job)
    // For now, we'll complete it immediately
    setTimeout(async () => {
        const currentWager = wagerOps.get(wagerId);
        if (currentWager.status === 'pending_verification') {
            wagerOps.complete(wagerId, interaction.user.id);
            
            const loserId = interaction.user.id === wager.creator_id ? wager.opponent_id : wager.creator_id;
            
            // Update balances
            const payout = wager.amount * 2 * (1 - PLATFORM_FEE);
            userOps.updateBalance(interaction.user.id, payout);
            
            // Send notifications
            await notifyWagerCompleted(interaction.client, wager, interaction.user.id);
            await sendMatchResult(interaction.client, wager, interaction.user.id, loserId);
        }
    }, 1000); // In production, this would be 24 hours
}

async function handleDispute(interaction) {
    const wagerId = interaction.options.getInteger('id');
    const reason = interaction.options.getString('reason');

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate participant
    if (wager.creator_id !== interaction.user.id && wager.opponent_id !== interaction.user.id) {
        const embed = createErrorEmbed('You are not a participant in this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'pending_verification' && wager.status !== 'accepted' && wager.status !== 'in_progress') {
        const embed = createErrorEmbed('This wager cannot be disputed at this time.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Create dispute
    const disputeId = disputeOps.create(wagerId, interaction.user.id, reason);
    wagerOps.dispute(wagerId);

    const embed = createSuccessEmbed(
        `✅ Dispute filed successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Dispute ID:** ${disputeId}\n` +
        `**Reason:** ${reason}\n\n` +
        `A moderator will review your dispute and make a decision.`
    );

    await interaction.reply({ embeds: [embed] });

    // Send dispute alert
    const dispute = disputeOps.get(disputeId);
    await sendDisputeAlert(interaction.client, wager, dispute);
    await notifyDispute(interaction.client, wager, dispute);
}
