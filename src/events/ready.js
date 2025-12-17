const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
        console.log(`👥 Monitoring ${client.users.cache.size} user(s)`);
        
        // Set bot status
        client.user.setActivity('Wagers | /help', { type: 'WATCHING' });
    }
};
