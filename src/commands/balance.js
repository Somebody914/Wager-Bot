const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { userOps } = require('../services/database');
const { COLORS } = require('../utils/constants');
const { createErrorEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your escrow balance'),

    async execute(interaction) {
        try {
            const user = userOps.get(interaction.user.id);

            if (!user) {
                const embed = createErrorEmbed('You need to verify your wallet first. Use `/verify <wallet>` to get started.');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const balance = userOps.getBalance(interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('💰 Your Balance')
                .setColor(COLORS.PRIMARY)
                .addFields(
                    { name: 'Wallet Address', value: user.wallet_address || 'Not verified', inline: false },
                    { name: 'Escrow Balance', value: `${balance.toFixed(4)} ETH`, inline: false }
                )
                .setFooter({ text: 'Funds are held in escrow until wagers are completed' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in balance command:', error);
            const embed = createErrorEmbed('An error occurred while fetching your balance. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
