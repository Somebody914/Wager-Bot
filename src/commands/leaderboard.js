const { SlashCommandBuilder } = require('discord.js');
const { statsOps } = require('../services/database');
const { createLeaderboardEmbed } = require('../utils/embeds');
const { GAME_CHOICES } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View top players')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Filter by specific game (optional)')
                .setRequired(false)
                .addChoices(...GAME_CHOICES)),

    async execute(interaction) {
        const game = interaction.options.getString('game');

        try {
            const leaderboard = statsOps.getLeaderboard(game, 10);
            
            const gameName = game ? GAME_CHOICES.find(g => g.value === game)?.name : null;
            const embed = createLeaderboardEmbed(leaderboard, gameName);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in leaderboard command:', error);
            const embed = createErrorEmbed('An error occurred while fetching the leaderboard. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
