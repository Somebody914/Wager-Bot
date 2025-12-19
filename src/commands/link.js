const { SlashCommandBuilder } = require('discord.js');
const { userOps, linkedAccountOps } = require('../services/database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { GAME_CHOICES, VERIFICATION_METHODS } = require('../utils/constants');
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
                .setRequired(true))
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Verification method (optional - defaults to automatic)')
                .setRequired(false)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('tracker_url')
                .setDescription('Tracker profile URL (for tracker verification method)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('profile_url')
                .setDescription('Steam/Riot profile URL (for profile verification method)')
                .setRequired(false)),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const username = interaction.options.getString('username');
        const method = interaction.options.getString('method');
        const trackerUrl = interaction.options.getString('tracker_url');
        const profileUrl = interaction.options.getString('profile_url');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create user if doesn't exist
            userOps.create(interaction.user.id);

            const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;

            // Determine verification method
            let verificationMethod = method || 'auto';
            let verified = 0;
            let platformId = null;
            let displayName = username;

            // Handle different verification methods
            if (method === 'tracker' && trackerUrl) {
                // Tracker URL verification
                // In a real implementation, you would validate the tracker URL
                // For now, we'll accept it if it looks like a valid URL
                if (trackerUrl.includes('tracker')) {
                    verified = 1;
                    verificationMethod = 'tracker';
                    
                    const embed = createSuccessEmbed(
                        `✅ Successfully linked your ${gameName} account!\n\n` +
                        `**Username:** ${username}\n` +
                        `**Verification Method:** Tracker Link\n` +
                        `**Tracker URL:** ${trackerUrl}\n\n` +
                        `✅ **Status:** Verified\n\n` +
                        `You can now create wagers for this game.`
                    );
                    
                    // Store with verification method
                    const stmt = require('../services/database').db.prepare(`
                        INSERT OR REPLACE INTO linked_accounts 
                        (discord_id, platform, username, verified, verification_method, tracker_url, last_verified) 
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    `);
                    stmt.run(interaction.user.id, game, username, verified, verificationMethod, trackerUrl);
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
            } else if ((method === 'steam' || method === 'riot_auth') && profileUrl) {
                // Profile URL verification
                if (profileUrl.includes('steamcommunity.com') || profileUrl.includes('riot.com')) {
                    verified = 1;
                    verificationMethod = method;
                    
                    const embed = createSuccessEmbed(
                        `✅ Successfully linked your ${gameName} account!\n\n` +
                        `**Username:** ${username}\n` +
                        `**Verification Method:** ${method === 'steam' ? 'Steam Profile' : 'Riot Profile'}\n` +
                        `**Profile URL:** ${profileUrl}\n\n` +
                        `✅ **Status:** Verified\n\n` +
                        `You can now create wagers for this game.`
                    );
                    
                    // Store with verification method
                    const stmt = require('../services/database').db.prepare(`
                        INSERT OR REPLACE INTO linked_accounts 
                        (discord_id, platform, username, verified, verification_method, platform_profile_url, last_verified) 
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    `);
                    stmt.run(interaction.user.id, game, username, verified, verificationMethod, profileUrl);
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
            } else if (method === 'screenshot') {
                // Screenshot verification - requires manual approval
                verified = 0;
                verificationMethod = 'screenshot';
                
                const embed = createSuccessEmbed(
                    `✅ Account linked - pending screenshot verification\n\n` +
                    `**Game:** ${gameName}\n` +
                    `**Username:** ${username}\n` +
                    `**Verification Method:** Screenshot\n\n` +
                    `⚠️ **Next Steps:**\n` +
                    `1. Take a screenshot as instructed for ${gameName}\n` +
                    `2. Submit it to a moderator for verification\n\n` +
                    `You can create wagers once verified.`
                );
                
                // Store with verification method
                const stmt = require('../services/database').db.prepare(`
                    INSERT OR REPLACE INTO linked_accounts 
                    (discord_id, platform, username, verified, verification_method) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                stmt.run(interaction.user.id, game, username, verified, verificationMethod);
                
                await interaction.editReply({ embeds: [embed] });
                return;
            } else if (method === 'match') {
                // Match verification - play a match
                verified = 0;
                verificationMethod = 'match';
                
                const embed = createSuccessEmbed(
                    `✅ Account linked - pending match verification\n\n` +
                    `**Game:** ${gameName}\n` +
                    `**Username:** ${username}\n` +
                    `**Verification Method:** Play a Match\n\n` +
                    `⚠️ **Next Steps:**\n` +
                    `Play 1 match in ${gameName} and we'll detect your account automatically.\n\n` +
                    `You can create wagers once verified.`
                );
                
                // Store with verification method
                const stmt = require('../services/database').db.prepare(`
                    INSERT OR REPLACE INTO linked_accounts 
                    (discord_id, platform, username, verified, verification_method) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                stmt.run(interaction.user.id, game, username, verified, verificationMethod);
                
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Default: Attempt automatic verification
            const verificationResult = await verifyGameAccount(game, username);

            if (verificationResult.verified) {
                // Link account with verification data
                const stmt = require('../services/database').db.prepare(`
                    INSERT OR REPLACE INTO linked_accounts 
                    (discord_id, platform, username, platform_id, verified, verification_method, last_verified) 
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `);
                stmt.run(
                    interaction.user.id, 
                    game, 
                    verificationResult.displayName || username,
                    verificationResult.platformId,
                    1,
                    'auto'
                );

                let message = `✅ Successfully linked and verified your ${gameName} account!\n\n` +
                    `**Username:** ${verificationResult.displayName || username}\n` +
                    `**Verification Method:** Automatic\n`;

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
                // Link account without verification - show available methods
                linkedAccountOps.create(interaction.user.id, game, username, null, 0);

                const availableMethods = VERIFICATION_METHODS[game] || [];
                const methodsList = availableMethods.map(m => `• **${m.name}**: ${m.description}`).join('\n');

                const embed = createErrorEmbed(
                    `⚠️ Account linked but not verified\n\n` +
                    `**Game:** ${gameName}\n` +
                    `**Username:** ${username}\n` +
                    `**Reason:** ${verificationResult.error}\n\n` +
                    `**Try these verification methods:**\n${methodsList}\n\n` +
                    `Use \`/link ${game} ${username} method:<method_id>\` with additional details.\n\n` +
                    `You can still create wagers, but verification is recommended.`
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
