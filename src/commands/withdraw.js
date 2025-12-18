const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { userOps } = require('../services/database');
const WalletService = require('../services/wallet');
const { COLORS } = require('../utils/constants');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');

const walletService = new WalletService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw funds from your wallet')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Amount to withdraw in ETH')
                .setRequired(true)
                .setMinValue(0.001)),

    async execute(interaction) {
        try {
            const amount = interaction.options.getNumber('amount');

            // Check if user is verified
            const user = userOps.get(interaction.user.id);
            if (!user || !user.verified) {
                const embed = createErrorEmbed(
                    'You must verify your wallet first!\n\n' +
                    'Use `/verify <wallet_address>` to link your Ethereum wallet before withdrawing.'
                );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Get balance info
            const balanceInfo = walletService.getBalanceInfo(interaction.user.id);

            // Check if sufficient balance
            if (balanceInfo.availableBalance < amount) {
                const embed = createErrorEmbed(
                    `❌ Insufficient balance!\n\n` +
                    `**Available:** ${balanceInfo.availableBalance.toFixed(4)} ETH\n` +
                    `**Requested:** ${amount.toFixed(4)} ETH\n\n` +
                    `You can only withdraw your available balance. Funds held in active wagers cannot be withdrawn.`
                );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Check minimum withdrawal
            const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL || '0.005');
            if (amount < minWithdrawal) {
                const embed = createErrorEmbed(
                    `❌ Amount too small!\n\n` +
                    `**Minimum withdrawal:** ${minWithdrawal} ETH\n` +
                    `**Requested:** ${amount.toFixed(4)} ETH`
                );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Process withdrawal
            await interaction.deferReply({ ephemeral: true });

            const withdrawal = await walletService.withdrawFunds(
                interaction.user.id,
                amount,
                user.wallet_address
            );

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('✅ Withdrawal Initiated')
                .setColor(COLORS.SUCCESS)
                .setDescription(
                    `Your withdrawal has been initiated and will be processed shortly.`
                )
                .addFields(
                    { 
                        name: '💰 Amount', 
                        value: `${amount.toFixed(4)} ETH`,
                        inline: true 
                    },
                    { 
                        name: '📍 To Address', 
                        value: `\`${user.wallet_address}\``,
                        inline: false 
                    },
                    { 
                        name: '🔗 Transaction Hash', 
                        value: `\`${withdrawal.txHash}\``,
                        inline: false 
                    },
                    { 
                        name: '📊 New Available Balance', 
                        value: `${(balanceInfo.availableBalance - amount).toFixed(4)} ETH`,
                        inline: true 
                    },
                    {
                        name: '⏱️ Status',
                        value: 'Pending confirmation (usually 5-10 minutes)',
                        inline: false
                    }
                )
                .setFooter({ text: 'You will receive a notification when the withdrawal is complete' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in withdraw command:', error);
            const embed = createErrorEmbed(error.message || 'An error occurred while processing your withdrawal. Please try again.');
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
