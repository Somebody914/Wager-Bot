const { SlashCommandBuilder } = require('discord.js');
const { wagerOps, escrowOps } = require('../services/database');
const { createEscrowEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const EscrowService = require('../services/escrow');

// Initialize escrow service
const db = require('../services/database');
const escrowService = new EscrowService(db);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('escrow')
        .setDescription('Manage escrow deposits and check status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('deposit')
                .setDescription('Submit transaction hash proving your deposit')
                .addIntegerOption(option =>
                    option.setName('wager_id')
                        .setDescription('The wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('tx_hash')
                        .setDescription('Your transaction hash')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check escrow status for a wager')
                .addIntegerOption(option =>
                    option.setName('wager_id')
                        .setDescription('The wager ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verify that deposits are complete')
                .addIntegerOption(option =>
                    option.setName('wager_id')
                        .setDescription('The wager ID')
                        .setRequired(true)
                        .setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'deposit':
                    await handleDeposit(interaction);
                    break;
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'verify':
                    await handleVerify(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in escrow ${subcommand}:`, error);
            const embed = createErrorEmbed(error.message || 'An error occurred. Please try again.');
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};

async function handleDeposit(interaction) {
    const wagerId = interaction.options.getInteger('wager_id');
    const txHash = interaction.options.getString('tx_hash');

    // Get the wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is a participant
    if (wager.creator_id !== interaction.user.id && wager.opponent_id !== interaction.user.id) {
        const embed = createErrorEmbed('You are not a participant in this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if wager is in correct status
    if (wager.status !== 'accepted' && wager.status !== 'open') {
        const embed = createErrorEmbed(`Cannot deposit for wager with status: ${wager.status}`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Record the deposit
        escrowService.deposit(wagerId, interaction.user.id, wager.amount, txHash);

        // Verify the deposit
        const verification = escrowService.verifyDeposit(wagerId, interaction.user.id);

        let message = `✅ Deposit recorded successfully!\n\n` +
            `**Wager ID:** ${wagerId}\n` +
            `**Amount:** ${wager.amount} ETH\n` +
            `**Transaction Hash:** \`${txHash}\`\n` +
            `**Status:** ${verification.message}\n\n`;

        if (verification.bothDeposited) {
            message += `🎮 Both parties have deposited. The wager is now ready to begin!\n\n`;
            message += `Use \`/wager submit ${wagerId}\` to submit your results after the match.`;
            
            // Update wager status to in_progress
            const updateStmt = db.db.prepare('UPDATE wagers SET status = ? WHERE id = ?');
            updateStmt.run('in_progress', wagerId);
        } else {
            message += `⏳ Waiting for ${verification.side === 'creator' ? 'opponent' : 'creator'} to deposit.`;
        }

        const embed = createSuccessEmbed(message);
        await interaction.reply({ embeds: [embed] });

    } catch (error) {
        const embed = createErrorEmbed(error.message);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleStatus(interaction) {
    const wagerId = interaction.options.getInteger('wager_id');

    // Get the wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get escrow status
    const escrowStatus = escrowService.getEscrowStatus(wagerId);

    if (!escrowStatus) {
        const embed = createErrorEmbed('No escrow account found for this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = createEscrowEmbed(escrowStatus, escrowStatus.transactions);
    await interaction.reply({ embeds: [embed] });
}

async function handleVerify(interaction) {
    const wagerId = interaction.options.getInteger('wager_id');

    // Get the wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get escrow status
    const escrowStatus = escrowService.getEscrowStatus(wagerId);

    if (!escrowStatus) {
        const embed = createErrorEmbed('No escrow account found for this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if both have deposited
    if (escrowStatus.creatorDeposited && escrowStatus.opponentDeposited) {
        const embed = createSuccessEmbed(
            `✅ Both parties have deposited!\n\n` +
            `**Total Amount in Escrow:** ${escrowStatus.totalAmount} ETH\n` +
            `**Status:** ${escrowStatus.status.toUpperCase()}\n\n` +
            `The wager can now proceed. Good luck! 🎮`
        );
        await interaction.reply({ embeds: [embed] });
    } else {
        let message = `⏳ Waiting for deposits...\n\n`;
        
        if (!escrowStatus.creatorDeposited) {
            message += `❌ Creator has not deposited yet\n`;
        } else {
            message += `✅ Creator has deposited\n`;
        }
        
        if (!escrowStatus.opponentDeposited) {
            message += `❌ Opponent has not deposited yet\n`;
        } else {
            message += `✅ Opponent has deposited\n`;
        }
        
        message += `\n**Escrow Address:** \`${escrowStatus.escrowAddress}\``;
        
        const embed = createErrorEmbed(message);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
