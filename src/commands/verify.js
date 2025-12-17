const { SlashCommandBuilder } = require('discord.js');
const { userOps } = require('../services/database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Link your Discord account to an ETH wallet address')
        .addStringOption(option =>
            option.setName('wallet')
                .setDescription('Your Ethereum wallet address')
                .setRequired(true)),

    async execute(interaction) {
        const walletAddress = interaction.options.getString('wallet');

        // Basic ETH address validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            const embed = createErrorEmbed('Invalid Ethereum wallet address. Please provide a valid address starting with 0x.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            // Create user if doesn't exist
            userOps.create(interaction.user.id);

            // Check if already verified
            const existingUser = userOps.get(interaction.user.id);
            if (existingUser && existingUser.verified) {
                const embed = createErrorEmbed(`You are already verified with wallet: ${existingUser.wallet_address}`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Verify user
            userOps.verify(interaction.user.id, walletAddress);

            // Assign verified role
            const verifiedRoleId = process.env.VERIFIED_ROLE_ID;
            if (verifiedRoleId) {
                try {
                    const member = interaction.guild.members.cache.get(interaction.user.id);
                    if (member) {
                        await member.roles.add(verifiedRoleId);
                    }
                } catch (error) {
                    console.error('Error assigning verified role:', error);
                }
            }

            const embed = createSuccessEmbed(
                `✅ Successfully verified!\n\n` +
                `**Wallet Address:** ${walletAddress}\n` +
                `You can now create and participate in wagers.`
            );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in verify command:', error);
            const embed = createErrorEmbed('An error occurred while verifying your wallet. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
