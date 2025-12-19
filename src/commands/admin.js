const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const WalletService = require('../services/wallet');
const { COLORS } = require('../utils/constants');
const { createErrorEmbed } = require('../utils/embeds');

const walletService = new WalletService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands for managing the bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('wallet-balance')
                .setDescription('Check the hot wallet balance'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('system-status')
                .setDescription('Check system status and configuration')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'wallet-balance') {
                await this.handleWalletBalance(interaction);
            } else if (subcommand === 'system-status') {
                await this.handleSystemStatus(interaction);
            }
        } catch (error) {
            console.error('Error in admin command:', error);
            const embed = createErrorEmbed('An error occurred while executing the admin command.');
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    },

    async handleWalletBalance(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const balance = await walletService.getMasterWalletBalance();
            const masterAddress = process.env.MASTER_WALLET_ADDRESS || 'Not configured';

            const embed = new EmbedBuilder()
                .setTitle('🏦 Hot Wallet Status')
                .setColor(COLORS.PRIMARY)
                .addFields(
                    { 
                        name: '💰 Balance', 
                        value: `${parseFloat(balance).toFixed(4)} ETH`,
                        inline: true 
                    },
                    { 
                        name: '📍 Address', 
                        value: `\`${masterAddress}\``,
                        inline: false 
                    }
                )
                .setFooter({ text: 'Monitor this balance to ensure sufficient funds for withdrawals' })
                .setTimestamp();

            // Add warning if balance is low
            const balanceNum = parseFloat(balance);
            if (balanceNum < 0.1) {
                embed.addFields({
                    name: '⚠️ Warning',
                    value: 'Hot wallet balance is low! Consider adding funds to ensure withdrawals can be processed.',
                    inline: false
                });
                embed.setColor(COLORS.WARNING);
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            const embed = createErrorEmbed('Failed to fetch hot wallet balance. Check if ETHEREUM_RPC_URL is configured.');
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleSystemStatus(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const config = {
            ethereumRpcConfigured: !!process.env.ETHEREUM_RPC_URL,
            masterWalletConfigured: !!process.env.MASTER_WALLET_PRIVATE_KEY,
            hdMnemonicConfigured: !!process.env.HD_WALLET_MNEMONIC,
            network: process.env.NETWORK || 'mainnet',
            depositCheckInterval: parseInt(process.env.DEPOSIT_CHECK_INTERVAL_MS || '60000') / 1000,
            requiredConfirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || '12'),
            minDeposit: parseFloat(process.env.MIN_DEPOSIT_ETH || '0.001'),
            minWithdrawal: parseFloat(process.env.MIN_WITHDRAWAL || '0.005'),
            maxGasPrice: parseInt(process.env.MAX_GAS_PRICE_GWEI || '100')
        };

        const embed = new EmbedBuilder()
            .setTitle('⚙️ System Status')
            .setColor(COLORS.PRIMARY)
            .addFields(
                {
                    name: '🔧 Configuration Status',
                    value: 
                        `**Ethereum RPC:** ${config.ethereumRpcConfigured ? '✅ Configured' : '❌ Not configured'}\n` +
                        `**Master Wallet:** ${config.masterWalletConfigured ? '✅ Configured' : '❌ Not configured'}\n` +
                        `**HD Mnemonic:** ${config.hdMnemonicConfigured ? '✅ Configured' : '❌ Not configured'}\n` +
                        `**Network:** ${config.network}`,
                    inline: false
                },
                {
                    name: '💰 Deposit Settings',
                    value:
                        `**Check Interval:** ${config.depositCheckInterval}s\n` +
                        `**Required Confirmations:** ${config.requiredConfirmations} blocks\n` +
                        `**Minimum Deposit:** ${config.minDeposit} ETH`,
                    inline: true
                },
                {
                    name: '📤 Withdrawal Settings',
                    value:
                        `**Minimum Withdrawal:** ${config.minWithdrawal} ETH\n` +
                        `**Max Gas Price:** ${config.maxGasPrice} gwei`,
                    inline: true
                }
            )
            .setFooter({ text: 'Ensure all critical components are configured for production use' })
            .setTimestamp();

        // Check if system is ready
        if (config.ethereumRpcConfigured && config.masterWalletConfigured && config.hdMnemonicConfigured) {
            embed.addFields({
                name: '✅ System Ready',
                value: 'All critical components are configured. The bot is ready for real blockchain operations.',
                inline: false
            });
        } else {
            embed.addFields({
                name: '⚠️ Configuration Incomplete',
                value: 'Some critical components are not configured. Real blockchain operations may not work.',
                inline: false
            });
            embed.setColor(COLORS.WARNING);
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
