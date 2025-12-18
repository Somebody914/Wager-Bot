const { SlashCommandBuilder } = require('discord.js');
const { userOps, linkedAccountOps } = require('../services/database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { GAME_CHOICES } = require('../utils/constants');
const { verifyGameAccount } = require('../services/gameVerification');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your gaming account')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game platform')
                .setRequired(true)
                .addChoices(...GAME_CHOICES))
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your in-game username (Valorant/LoL: name#tag)')
                .setRequired(true)),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const username = interaction.options.getString('username');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create user if doesn't exist
            userOps.create(interaction.user.id);

            const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;

            // Attempt to verify the account
            const verificationResult = await verifyGameAccount(game, username);

            if (verificationResult.verified) {
                // Link account with verification data
                linkedAccountOps.create(
                    interaction.user.id, 
                    game, 
                    verificationResult.displayName || username,
                    verificationResult.platformId,
                    1 // verified
                );

                let message = `✅ Successfully linked and verified your ${gameName} account!\n\n` +
                    `**Username:** ${verificationResult.displayName || username}\n`;

                if (verificationResult.platformId) {
                    message += `**Platform ID:** ${verificationResult.platformId}\n`;
                }

                if (game === 'cs2' && verificationResult.ownsCS2 !== undefined) {
                    message += `**CS2 Ownership:** ${verificationResult.ownsCS2 ? '✅ Verified' : '⚠️ Could not verify (private profile?)'}\n`;
                }

                message += `\n✅ **Status:** Verified\n\nYou can now create wagers for this game.`;

                const embed = createSuccessEmbed(message);
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Link account without verification
                linkedAccountOps.create(interaction.user.id, game, username, null, 0);

                const embed = createErrorEmbed(
                    `⚠️ Account linked but not verified\n\n` +
                    `**Game:** ${gameName}\n` +
                    `**Username:** ${username}\n` +
                    `**Reason:** ${verificationResult.error}\n\n` +
                    `You can still create wagers, but verification is recommended for better security.`
                );

                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in link command:', error);
            const embed = createErrorEmbed('An error occurred while linking your account. Please try again.');
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
