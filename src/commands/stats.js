const { SlashCommandBuilder } = require('discord.js');
const { statsOps, userOps } = require('../services/database');
const { createStatsEmbed, createErrorEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View user statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view stats for (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            const user = userOps.get(targetUser.id);

            if (!user) {
                const embed = createErrorEmbed(`${targetUser.username} hasn't verified their wallet yet.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const stats = statsOps.getUserStats(targetUser.id);

            // Initialize stats if they're null
            const userStats = {
                wins: stats.wins || 0,
                losses: stats.losses || 0,
                total_matches: stats.total_matches || 0,
                total_wagered: stats.total_wagered || 0,
                total_earnings: stats.total_earnings || 0
            };

            const embed = createStatsEmbed(targetUser, userStats);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in stats command:', error);
            const embed = createErrorEmbed('An error occurred while fetching statistics. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
