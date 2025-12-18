const { SlashCommandBuilder } = require('discord.js');
const { userOps, teamOps } = require('../services/database');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { GAME_CHOICES, TEAM_SIZES } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Manage teams')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new team')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Team name')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('Game for this team')
                        .setRequired(true)
                        .addChoices(...GAME_CHOICES)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invite a user to your team')
                .addIntegerOption(option =>
                    option.setName('team_id')
                        .setDescription('Team ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to invite')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave a team')
                .addIntegerOption(option =>
                    option.setName('team_id')
                        .setDescription('Team ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('roster')
                .setDescription('View team roster')
                .addIntegerOption(option =>
                    option.setName('team_id')
                        .setDescription('Team ID (leave empty to view your teams)')
                        .setRequired(false)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disband')
                .setDescription('Disband your team (captain only)')
                .addIntegerOption(option =>
                    option.setName('team_id')
                        .setDescription('Team ID')
                        .setRequired(true)
                        .setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction);
                    break;
                case 'invite':
                    await handleInvite(interaction);
                    break;
                case 'leave':
                    await handleLeave(interaction);
                    break;
                case 'roster':
                    await handleRoster(interaction);
                    break;
                case 'disband':
                    await handleDisband(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in team ${subcommand}:`, error);
            const embed = createErrorEmbed('An error occurred. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

async function handleCreate(interaction) {
    const name = interaction.options.getString('name');
    const game = interaction.options.getString('game');

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Create team
    const teamId = teamOps.create(name, interaction.user.id, game);

    const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;
    const teamSizes = TEAM_SIZES[game] || [1];

    const embed = createSuccessEmbed(
        `✅ Team created successfully!\n\n` +
        `**Team ID:** ${teamId}\n` +
        `**Name:** ${name}\n` +
        `**Game:** ${gameName}\n` +
        `**Captain:** ${interaction.user}\n` +
        `**Supported Team Sizes:** ${teamSizes.join(', ')}\n\n` +
        `Use \`/team invite ${teamId} @user\` to add members to your team.`
    );

    await interaction.reply({ embeds: [embed] });
}

async function handleInvite(interaction) {
    const teamId = interaction.options.getInteger('team_id');
    const userToInvite = interaction.options.getUser('user');

    // Get team
    const team = teamOps.get(teamId);
    if (!team) {
        const embed = createErrorEmbed('Team not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is the captain
    if (team.captain_id !== interaction.user.id) {
        const embed = createErrorEmbed('Only the team captain can invite members.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user to invite is verified
    const inviteeUser = userOps.get(userToInvite.id);
    if (!inviteeUser || !inviteeUser.verified) {
        const embed = createErrorEmbed('The user must be verified before joining a team.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is already on the team
    if (userToInvite.id === team.captain_id) {
        const embed = createErrorEmbed('This user is the team captain!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const members = teamOps.getMembers(teamId);
    if (members.some(m => m.discord_id === userToInvite.id)) {
        const embed = createErrorEmbed('This user is already on the team.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check team size limits
    const currentSize = teamOps.getMemberCount(teamId);
    const maxSize = Math.max(...(TEAM_SIZES[team.game] || [5]));
    
    if (currentSize >= maxSize) {
        const embed = createErrorEmbed(`Team is full. Maximum size for ${team.game} is ${maxSize}.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add member
    teamOps.addMember(teamId, userToInvite.id);

    const embed = createSuccessEmbed(
        `✅ Member added successfully!\n\n` +
        `**Team:** ${team.name}\n` +
        `**New Member:** ${userToInvite}\n` +
        `**Current Size:** ${currentSize + 1}/${maxSize}`
    );

    await interaction.reply({ embeds: [embed] });

    // Notify the invited user
    try {
        await userToInvite.send(
            `You have been added to team **${team.name}** (ID: ${teamId}) by ${interaction.user}!`
        );
    } catch (error) {
        console.error('Error sending invite notification:', error);
    }
}

async function handleLeave(interaction) {
    const teamId = interaction.options.getInteger('team_id');

    // Get team
    const team = teamOps.get(teamId);
    if (!team) {
        const embed = createErrorEmbed('Team not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is the captain
    if (team.captain_id === interaction.user.id) {
        const embed = createErrorEmbed('Captains cannot leave their team. Use `/team disband` to disband the team.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Remove member
    const result = teamOps.removeMember(teamId, interaction.user.id);
    
    if (result.changes === 0) {
        const embed = createErrorEmbed('You are not a member of this team.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = createSuccessEmbed(
        `✅ You have left team **${team.name}** (ID: ${teamId}).`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRoster(interaction) {
    const teamId = interaction.options.getInteger('team_id');

    if (teamId) {
        // View specific team roster
        const team = teamOps.get(teamId);
        if (!team) {
            const embed = createErrorEmbed('Team not found.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const members = teamOps.getMembers(teamId);
        const gameName = GAME_CHOICES.find(g => g.value === team.game)?.name || team.game;

        let rosterText = `**Captain:** <@${team.captain_id}>\n\n**Members:**\n`;
        
        if (members.length === 0) {
            rosterText += 'No members yet. Captain can invite using `/team invite`.';
        } else {
            members.forEach((member, index) => {
                rosterText += `${index + 1}. <@${member.discord_id}>\n`;
            });
        }

        const currentSize = teamOps.getMemberCount(teamId);
        const maxSize = Math.max(...(TEAM_SIZES[team.game] || [5]));

        const embed = createSuccessEmbed(
            `📋 **${team.name}** (ID: ${teamId})\n\n` +
            `**Game:** ${gameName}\n` +
            `**Size:** ${currentSize}/${maxSize}\n\n` +
            rosterText
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
        // View user's teams
        const teams = teamOps.getByUser(interaction.user.id);
        
        if (teams.length === 0) {
            const embed = createErrorEmbed('You are not part of any teams. Create one with `/team create`.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        let teamsText = '';
        for (const team of teams) {
            const gameName = GAME_CHOICES.find(g => g.value === team.game)?.name || team.game;
            const size = teamOps.getMemberCount(team.id);
            const isCaptain = team.captain_id === interaction.user.id;
            teamsText += `**${team.name}** (ID: ${team.id})\n`;
            teamsText += `  Game: ${gameName} | Size: ${size} | ${isCaptain ? '👑 Captain' : 'Member'}\n\n`;
        }

        const embed = createSuccessEmbed(
            `📋 **Your Teams**\n\n${teamsText}` +
            `Use \`/team roster <team_id>\` to view a team's full roster.`
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleDisband(interaction) {
    const teamId = interaction.options.getInteger('team_id');

    // Get team
    const team = teamOps.get(teamId);
    if (!team) {
        const embed = createErrorEmbed('Team not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is the captain
    if (team.captain_id !== interaction.user.id) {
        const embed = createErrorEmbed('Only the team captain can disband the team.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get members before disbanding
    const members = teamOps.getMembers(teamId);

    // Delete team (team_members will be automatically deleted due to foreign key constraint)
    teamOps.delete(teamId);

    const embed = createSuccessEmbed(
        `✅ Team **${team.name}** has been disbanded.`
    );

    await interaction.reply({ embeds: [embed] });

    // Notify all members
    for (const member of members) {
        try {
            const user = await interaction.client.users.fetch(member.discord_id);
            await user.send(
                `Team **${team.name}** (ID: ${teamId}) has been disbanded by the captain.`
            );
        } catch (error) {
            console.error('Error sending disband notification:', error);
        }
    }
}
