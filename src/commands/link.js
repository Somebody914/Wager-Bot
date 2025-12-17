const { SlashCommandBuilder } = require('discord.js');
const { userOps, linkedAccountOps } = require('../services/database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { GAME_CHOICES } = require('../utils/constants');

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
                .setDescription('Your in-game username')
                .setRequired(true)),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const username = interaction.options.getString('username');

        try {
            // Create user if doesn't exist
            userOps.create(interaction.user.id);

            // Link account
            linkedAccountOps.create(interaction.user.id, game, username);

            const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;

            const embed = createSuccessEmbed(
                `✅ Successfully linked your ${gameName} account!\n\n` +
                `**Username:** ${username}\n\n` +
                `You can now create wagers for this game.`
            );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in link command:', error);
            const embed = createErrorEmbed('An error occurred while linking your account. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
