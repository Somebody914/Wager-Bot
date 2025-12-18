const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { userOps, wagerOps, disputeOps, disputeVoteOps } = require('../services/database');
const { createErrorEmbed, createSuccessEmbed, createDisputeEmbed } = require('../utils/embeds');
const { isValidProofUrl } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dispute')
        .setDescription('Manage disputes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('counter-proof')
                .setDescription('Submit counter evidence for a dispute')
                .addIntegerOption(option =>
                    option.setName('dispute_id')
                        .setDescription('Dispute ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('proof_url')
                        .setDescription('Counter-proof URL (Discord/Imgur/YouTube/Streamable)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('vote')
                .setDescription('Vote on a disputed wager')
                .addIntegerOption(option =>
                    option.setName('dispute_id')
                        .setDescription('Dispute ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('side')
                        .setDescription('Which side do you vote for?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Creator', value: 'creator' },
                            { name: 'Opponent', value: 'opponent' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resolve')
                .setDescription('Resolve a dispute (Moderators only)')
                .addIntegerOption(option =>
                    option.setName('dispute_id')
                        .setDescription('Dispute ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('winner')
                        .setDescription('Who wins the dispute?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Creator', value: 'creator' },
                            { name: 'Opponent', value: 'opponent' },
                            { name: 'Cancel Wager', value: 'cancel' }
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the decision')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'counter-proof':
                    await handleCounterProof(interaction);
                    break;
                case 'vote':
                    await handleVote(interaction);
                    break;
                case 'resolve':
                    await handleResolve(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in dispute ${subcommand}:`, error);
            const embed = createErrorEmbed('An error occurred. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

async function handleCounterProof(interaction) {
    const disputeId = interaction.options.getInteger('dispute_id');
    const proofUrl = interaction.options.getString('proof_url');

    // Get dispute
    const dispute = disputeOps.get(disputeId);
    if (!dispute) {
        const embed = createErrorEmbed('Dispute not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(dispute.wager_id);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is a participant but not the filer
    const isParticipant = wager.creator_id === interaction.user.id || wager.opponent_id === interaction.user.id;
    const isFiler = dispute.filer_id === interaction.user.id;

    if (!isParticipant || isFiler) {
        const embed = createErrorEmbed('You must be the opposing party in this dispute to submit counter-proof.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if dispute is still pending
    if (dispute.status !== 'pending') {
        const embed = createErrorEmbed('This dispute has already been resolved.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate proof URL
    if (!isValidProofUrl(proofUrl)) {
        const embed = createErrorEmbed(
            'Invalid proof URL!\n\n' +
            'Supported: Discord attachments, Imgur, YouTube, Streamable'
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add counter-proof
    disputeOps.addCounterProof(disputeId, proofUrl);

    const embed = createSuccessEmbed(
        `✅ Counter-proof submitted successfully!\n\n` +
        `**Dispute ID:** ${disputeId}\n` +
        `**Counter-Proof:** ${proofUrl}\n\n` +
        `Moderators will review both sides of the evidence.`
    );

    await interaction.reply({ embeds: [embed] });

    // Notify moderators with updated dispute info
    const updatedDispute = disputeOps.get(disputeId);
    const disputesChannel = interaction.client.channels.cache.get(process.env.DISPUTES_CHANNEL);
    
    if (disputesChannel) {
        const creator = await interaction.client.users.fetch(wager.creator_id);
        const disputeEmbed = createDisputeEmbed(wager, updatedDispute, creator);
        disputeEmbed.setTitle(`🔄 Counter-Proof Added - Dispute #${disputeId}`);
        
        await disputesChannel.send({ embeds: [disputeEmbed] });
    }
}

async function handleVote(interaction) {
    const disputeId = interaction.options.getInteger('dispute_id');
    const side = interaction.options.getString('side');

    // Get dispute
    const dispute = disputeOps.get(disputeId);
    if (!dispute) {
        const embed = createErrorEmbed('Dispute not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(dispute.wager_id);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is a participant
    if (wager.creator_id === interaction.user.id || wager.opponent_id === interaction.user.id) {
        const embed = createErrorEmbed('Participants cannot vote on their own disputes.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if dispute is still pending
    if (dispute.status !== 'pending') {
        const embed = createErrorEmbed('This dispute has already been resolved.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add vote
    disputeVoteOps.addVote(disputeId, interaction.user.id, side);

    // Get vote counts
    const voteCounts = disputeVoteOps.getVoteCounts(disputeId);

    const embed = createSuccessEmbed(
        `✅ Vote recorded!\n\n` +
        `**Dispute ID:** ${disputeId}\n` +
        `**Your Vote:** ${side === 'creator' ? 'Creator' : 'Opponent'}\n\n` +
        `**Current Votes:**\n` +
        `Creator: ${voteCounts.creator_votes || 0}\n` +
        `Opponent: ${voteCounts.opponent_votes || 0}`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleResolve(interaction) {
    const disputeId = interaction.options.getInteger('dispute_id');
    const winner = interaction.options.getString('winner');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Check if user has moderator permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const embed = createErrorEmbed('You do not have permission to resolve disputes. Moderator role required.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get dispute
    const dispute = disputeOps.get(disputeId);
    if (!dispute) {
        const embed = createErrorEmbed('Dispute not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(dispute.wager_id);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if dispute is still pending
    if (dispute.status !== 'pending') {
        const embed = createErrorEmbed('This dispute has already been resolved.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Resolve dispute
    if (winner === 'cancel') {
        // Cancel the wager
        wagerOps.cancel(dispute.wager_id);
        disputeOps.resolve(disputeId, 'resolved');

        const embed = createSuccessEmbed(
            `✅ Dispute resolved - Wager cancelled!\n\n` +
            `**Dispute ID:** ${disputeId}\n` +
            `**Wager ID:** ${dispute.wager_id}\n` +
            `**Decision:** Wager cancelled\n` +
            `**Reason:** ${reason}\n\n` +
            `Both parties have been notified.`
        );

        await interaction.reply({ embeds: [embed] });

        // Notify participants
        try {
            const creator = await interaction.client.users.fetch(wager.creator_id);
            await creator.send(
                `⚖️ **Dispute Resolved**\n\n` +
                `Wager #${dispute.wager_id} has been cancelled by a moderator.\n` +
                `Reason: ${reason}`
            );
        } catch (error) {
            console.error('Error notifying creator:', error);
        }

        try {
            const opponent = await interaction.client.users.fetch(wager.opponent_id);
            await opponent.send(
                `⚖️ **Dispute Resolved**\n\n` +
                `Wager #${dispute.wager_id} has been cancelled by a moderator.\n` +
                `Reason: ${reason}`
            );
        } catch (error) {
            console.error('Error notifying opponent:', error);
        }
    } else {
        // Determine winner ID
        const winnerId = winner === 'creator' ? wager.creator_id : wager.opponent_id;
        const loserId = winner === 'creator' ? wager.opponent_id : wager.creator_id;

        // Complete wager with winner
        wagerOps.complete(dispute.wager_id, winnerId);
        disputeOps.resolve(disputeId, 'resolved');

        // Update balances
        const { PLATFORM_FEE } = require('../utils/constants');
        const payout = wager.amount * 2 * (1 - PLATFORM_FEE);
        userOps.updateBalance(winnerId, payout);

        const embed = createSuccessEmbed(
            `✅ Dispute resolved!\n\n` +
            `**Dispute ID:** ${disputeId}\n` +
            `**Wager ID:** ${dispute.wager_id}\n` +
            `**Winner:** <@${winnerId}>\n` +
            `**Payout:** ${payout.toFixed(4)} ETH\n` +
            `**Reason:** ${reason}\n\n` +
            `Both parties have been notified.`
        );

        await interaction.reply({ embeds: [embed] });

        // Notify participants
        try {
            const winnerUser = await interaction.client.users.fetch(winnerId);
            await winnerUser.send(
                `🏆 **Dispute Resolved - You Won!**\n\n` +
                `Wager #${dispute.wager_id} has been resolved in your favor.\n` +
                `Payout: ${payout.toFixed(4)} ETH\n` +
                `Reason: ${reason}`
            );
        } catch (error) {
            console.error('Error notifying winner:', error);
        }

        try {
            const loserUser = await interaction.client.users.fetch(loserId);
            await loserUser.send(
                `❌ **Dispute Resolved - You Lost**\n\n` +
                `Wager #${dispute.wager_id} has been resolved against you.\n` +
                `Reason: ${reason}`
            );
        } catch (error) {
            console.error('Error notifying loser:', error);
        }

        // Send to match results channel
        const { sendMatchResult } = require('../services/notifications');
        await sendMatchResult(interaction.client, wager, winnerId, loserId);
    }
}
