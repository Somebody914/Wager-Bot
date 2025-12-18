const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { userOps } = require('../services/database');
const WalletService = require('../services/wallet');
const { COLORS } = require('../utils/constants');
const { createErrorEmbed } = require('../utils/embeds');

const walletService = new WalletService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Get your personal deposit address to add funds'),

    async execute(interaction) {
        try {
            // Check if user is verified
            const user = userOps.get(interaction.user.id);
            if (!user || !user.verified) {
                const embed = createErrorEmbed(
                    'You must verify your wallet first!\n\n' +
                    'Use `/verify <wallet_address>` to link your Ethereum wallet before depositing funds.'
                );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Get or create wallet
            const balanceInfo = walletService.getBalanceInfo(interaction.user.id);

            // Create deposit embed
            const embed = new EmbedBuilder()
                .setTitle('💰 Your Deposit Address')
                .setColor(COLORS.PRIMARY)
                .setDescription(
                    'Send ETH to this address to add funds to your bot account.\n\n' +
                    '**Your unique deposit address:**'
                )
                .addFields(
                    { 
                        name: '📍 Address', 
                        value: `\`${balanceInfo.depositAddress}\``,
                        inline: false 
                    },
                    { 
                        name: '💵 Current Available Balance', 
                        value: `${balanceInfo.availableBalance.toFixed(4)} ETH`,
                        inline: true 
                    },
                    { 
                        name: '🔒 Held in Wagers', 
                        value: `${balanceInfo.heldBalance.toFixed(4)} ETH`,
                        inline: true 
                    },
                    { 
                        name: '💎 Total Balance', 
                        value: `${balanceInfo.totalBalance.toFixed(4)} ETH`,
                        inline: true 
                    }
                )
                .addFields(
                    {
                        name: '✅ How to Deposit',
                        value: 
                            '1. Copy the deposit address above\n' +
                            '2. Send ETH from your verified wallet\n' +
                            '3. Deposits are detected automatically\n' +
                            '4. Usually confirms within 5 minutes',
                        inline: false
                    },
                    {
                        name: '⚠️ Important',
                        value: 
                            `• Only send from your verified wallet: \`${user.wallet_address}\`\n` +
                            '• Send ETH on the correct network\n' +
                            '• Minimum deposit: 0.001 ETH\n' +
                            '• Keep transaction hash for records',
                        inline: false
                    }
                )
                .setFooter({ text: 'Secure Wallet System - Your funds are safe' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in deposit command:', error);
            const embed = createErrorEmbed('An error occurred while fetching your deposit information. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
