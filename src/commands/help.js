const { SlashCommandBuilder } = require('discord.js');
const { createHelpEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands and how to use them'),

    async execute(interaction) {
        const embed = createHelpEmbed();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
