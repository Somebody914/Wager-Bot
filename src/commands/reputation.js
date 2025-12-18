const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ReputationService } = require('../services/reputation');
const { COLORS } = require('../utils/constants');

const reputationService = new ReputationService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reputation')
        .setDescription('View reputation score and history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check (leave empty for yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isOwnReputation = targetUser.id === interaction.user.id;

        try {
            const reputation = reputationService.getReputation(targetUser.id);
            const events = reputationService.getEvents(targetUser.id, 5);

            // Determine reputation color
            let color = COLORS.SUCCESS;
            let statusEmoji = '✅';
            let statusText = 'Good Standing';

            if (reputation.score < 75 && reputation.score >= 50) {
                color = COLORS.WARNING;
                statusEmoji = '⚠️';
                statusText = 'Low Reputation';
            } else if (reputation.score < 50 && reputation.score >= 25) {
                color = COLORS.ERROR;
                statusEmoji = '⚠️';
                statusText = 'Very Low Reputation';
            } else if (reputation.score < 25) {
                color = COLORS.ERROR;
                statusEmoji = '🚫';
                statusText = 'Restricted';
            }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${statusEmoji} Reputation - ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setDescription(`**Status:** ${statusText}\n**Score:** ${reputation.score}/100`)
                .addFields(
                    { name: '📊 Statistics', value: 
                        `Total Wagers: ${reputation.total_wagers}\n` +
                        `Completed: ${reputation.completed}\n` +
                        `No-Shows: ${reputation.no_shows}\n` +
                        `Disputes Won: ${reputation.disputes_won}\n` +
                        `Disputes Lost: ${reputation.disputes_lost}\n` +
                        `False Claims: ${reputation.false_claims}`,
                        inline: true
                    },
                    { name: '🎯 Abilities', value:
                        `Create Wagers: ${reputation.score >= 50 ? '✅' : '❌'}\n` +
                        `Join Wagers: ${reputation.score >= 25 ? '✅' : '❌'}`,
                        inline: true
                    }
                );

            // Add recent events
            if (events.length > 0) {
                const eventsList = events.map(event => {
                    const sign = event.points >= 0 ? '+' : '';
                    const pointsColor = event.points >= 0 ? '🟢' : '🔴';
                    return `${pointsColor} ${sign}${event.points} - ${event.description}`;
                }).join('\n');

                embed.addFields({ 
                    name: '📜 Recent Activity', 
                    value: eventsList || 'No recent activity',
                    inline: false 
                });
            }

            // Add warnings if applicable
            const warning = reputationService.getWarning(targetUser.id);
            if (warning) {
                embed.addFields({ 
                    name: '⚠️ Warning', 
                    value: warning,
                    inline: false 
                });
            }

            embed.setFooter({ text: `Reputation system tracks player behavior` });
            embed.setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: isOwnReputation });

        } catch (error) {
            console.error('Error in reputation command:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while fetching reputation data.', 
                ephemeral: true 
            });
        }
    }
};
