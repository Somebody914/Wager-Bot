const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { userOps } = require('../services/database');
const WalletService = require('../services/wallet');
const { COLORS } = require('../utils/constants');
const { createErrorEmbed } = require('../utils/embeds');

const walletService = new WalletService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your wallet balance and statistics'),

    async execute(interaction) {
        try {
            const user = userOps.get(interaction.user.id);

            if (!user) {
                const embed = createErrorEmbed('You need to verify your wallet first. Use `/verify <wallet>` to get started.');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Get wallet balance info
            const balanceInfo = walletService.getBalanceInfo(interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('💰 Your Wallet')
                .setColor(COLORS.PRIMARY)
                .setDescription(
                    `**Available:** ${balanceInfo.availableBalance.toFixed(4)} ETH _(can wager or withdraw)_\n` +
                    `**In Wagers:** ${balanceInfo.heldBalance.toFixed(4)} ETH _(locked in active matches)_\n` +
                    `**Total:** ${balanceInfo.totalBalance.toFixed(4)} ETH`
                )
                .addFields(
                    { 
                        name: '📊 Statistics', 
                        value: 
                            `**Total Deposited:** ${balanceInfo.totalDeposited.toFixed(4)} ETH\n` +
                            `**Total Withdrawn:** ${balanceInfo.totalWithdrawn.toFixed(4)} ETH\n` +
                            `**Total Won:** ${balanceInfo.totalWon.toFixed(4)} ETH\n` +
                            `**Total Lost:** ${balanceInfo.totalLost.toFixed(4)} ETH\n` +
                            `**Net Profit:** ${balanceInfo.netProfit >= 0 ? '+' : ''}${balanceInfo.netProfit.toFixed(4)} ETH`,
                        inline: false 
                    },
                    {
                        name: '💡 Quick Actions',
                        value: 
                            '• Use `/deposit` to add funds\n' +
                            '• Use `/withdraw <amount>` to cash out\n' +
                            '• Use `/wager create` to start a match',
                        inline: false
                    }
                )
                .setFooter({ text: 'Your wallet is ready to use!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in balance command:', error);
            const embed = createErrorEmbed('An error occurred while fetching your balance. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
