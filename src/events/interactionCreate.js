const { Events } = require('discord.js');
const { handleButtonInteraction } = require('../handlers/buttonHandler');
const { getModeChoices } = require('../utils/constants');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);
            
            if (focusedOption.name === 'mode' && interaction.commandName === 'wager') {
                try {
                    const game = interaction.options.getString('game');
                    if (!game) {
                        return await interaction.respond([]);
                    }
                    
                    const modes = getModeChoices(game);
                    const filtered = modes.filter(mode => 
                        mode.name.toLowerCase().includes(focusedOption.value.toLowerCase())
                    ).slice(0, 25); // Discord limits to 25 choices
                    
                    await interaction.respond(filtered);
                } catch (error) {
                    console.error('Error handling autocomplete:', error);
                    await interaction.respond([]);
                }
            }
            return;
        }
        
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                
                const errorMessage = { 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }
        // Handle button interactions
        else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
    }
};
