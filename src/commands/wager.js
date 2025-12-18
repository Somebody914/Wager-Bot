const { SlashCommandBuilder } = require('discord.js');
const { userOps, wagerOps, disputeOps, teamOps, participantOps, disputeVoteOps } = require('../services/database');
const { createWagerEmbed, createErrorEmbed, createSuccessEmbed, createDepositInstructionsEmbed } = require('../utils/embeds');
const { GAME_CHOICES, PLATFORM_FEE, TEAM_SIZES, WAGER_TYPES, MATCH_TYPE_CHOICES, isValidProofUrl, calculatePayout, calculateFee } = require('../utils/constants');
const { sendWagerAlert, notifyWagerAccepted, notifyWagerSubmitted, notifyWagerCompleted, notifyDispute, sendMatchResult, sendDisputeAlert } = require('../services/notifications');
const EscrowService = require('../services/escrow');
const db = require('../services/database');

// Initialize escrow service
const escrowService = new EscrowService(db);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wager')
        .setDescription('Manage wagers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new wager')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The game to wager on')
                        .setRequired(true)
                        .addChoices(...GAME_CHOICES))
                .addNumberOption(option =>
                    option.setName('amount')
                        .setDescription('Wager amount in ETH')
                        .setRequired(true)
                        .setMinValue(0.001))
                .addUserOption(option =>
                    option.setName('opponent')
                        .setDescription('Challenge a specific user (leave empty for open challenge)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('team_size')
                        .setDescription('Team size (1 for solo, or game-specific sizes)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(5))
                .addIntegerOption(option =>
                    option.setName('team_id')
                        .setDescription('Your team ID (for team wagers)')
                        .setRequired(false)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('match_type')
                        .setDescription('Type of match for verification')
                        .setRequired(false)
                        .addChoices(...MATCH_TYPE_CHOICES)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('accept')
                .setDescription('Accept an open challenge')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check wager details and status')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit win proof')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('match_id')
                        .setDescription('Match ID for API verification (ranked/competitive only)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('proof_url')
                        .setDescription('Screenshot/video URL (Discord/Imgur/YouTube for custom/creative matches)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dispute')
                .setDescription('File a dispute on a wager')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the dispute')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('lft-join')
                .setDescription('Join an LFT (Looking For Teammates) wager')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Wager ID')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('side')
                        .setDescription('Which side to join')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Creator Side', value: 'creator' },
                            { name: 'Opponent Side', value: 'opponent' }
                        ))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction);
                    break;
                case 'accept':
                    await handleAccept(interaction);
                    break;
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'submit':
                    await handleSubmit(interaction);
                    break;
                case 'dispute':
                    await handleDispute(interaction);
                    break;
                case 'lft-join':
                    await handleLftJoin(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in wager ${subcommand}:`, error);
            const embed = createErrorEmbed('An error occurred. Please try again.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

async function handleCreate(interaction) {
    const game = interaction.options.getString('game');
    const amount = interaction.options.getNumber('amount');
    const opponent = interaction.options.getUser('opponent');
    const teamSize = interaction.options.getInteger('team_size') || 1;
    const teamId = interaction.options.getInteger('team_id');
    const matchType = interaction.options.getString('match_type') || 'ranked';

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate team size for the game
    const validTeamSizes = TEAM_SIZES[game] || [1];
    if (!validTeamSizes.includes(teamSize)) {
        const embed = createErrorEmbed(
            `Invalid team size for ${game}.\n\n` +
            `Valid team sizes: ${validTeamSizes.join(', ')}`
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate team if provided
    let team = null;
    if (teamId) {
        team = teamOps.get(teamId);
        if (!team) {
            const embed = createErrorEmbed('Team not found.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check if user is captain or member
        if (team.captain_id !== interaction.user.id) {
            const members = teamOps.getMembers(teamId);
            if (!members.some(m => m.discord_id === interaction.user.id)) {
                const embed = createErrorEmbed('You are not a member of this team.');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // Check if team game matches wager game
        if (team.game !== game) {
            const embed = createErrorEmbed(`This team is for ${team.game}, not ${game}.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check if team size matches
        const currentTeamSize = teamOps.getMemberCount(teamId);
        if (currentTeamSize !== teamSize) {
            const embed = createErrorEmbed(
                `Team size mismatch.\n\n` +
                `Your team has ${currentTeamSize} members, but you specified team size ${teamSize}.`
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // Validate opponent
    if (opponent) {
        if (opponent.id === interaction.user.id) {
            const embed = createErrorEmbed('You cannot challenge yourself!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const opponentUser = userOps.get(opponent.id);
        if (!opponentUser || !opponentUser.verified) {
            const embed = createErrorEmbed('The opponent must be verified before you can challenge them.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // Determine wager type
    let wagerType = WAGER_TYPES.SOLO;
    if (teamSize > 1) {
        wagerType = teamId ? WAGER_TYPES.TEAM : WAGER_TYPES.LFT;
    }

    // Create wager
    const wagerId = wagerOps.create(
        interaction.user.id,
        opponent ? opponent.id : null,
        game,
        amount,
        teamSize,
        wagerType,
        teamId,
        null,
        matchType
    );

    const wager = wagerOps.get(wagerId);
    const gameName = GAME_CHOICES.find(g => g.value === game)?.name || game;
    const fee = calculateFee(amount).toFixed(4);
    const payout = calculatePayout(amount).toFixed(4);

    // Create escrow account for this wager
    const escrowAccount = escrowService.createEscrowAccount(wagerId);

    // Get match type display name
    const matchTypeDisplay = MATCH_TYPE_CHOICES.find(mt => mt.value === matchType)?.name || matchType;

    let message = `✅ Wager created successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Amount:** ${amount} ETH\n` +
        `**Platform Fee:** ${fee} ETH (3%)\n` +
        `**Winner Payout:** ${payout} ETH\n` +
        `**Match Type:** ${matchTypeDisplay}\n`;

    if (teamSize > 1) {
        message += `**Team Size:** ${teamSize}v${teamSize}\n`;
        message += `**Type:** ${wagerType === WAGER_TYPES.TEAM ? 'Team Wager' : 'LFT (Looking For Teammates)'}\n`;
        if (team) {
            message += `**Your Team:** ${team.name}\n`;
        }
    }

    message += `**Opponent:** ${opponent ? opponent.toString() : 'Open Challenge'}\n\n`;

    // Add escrow information
    message += `🔐 **Escrow Address:** \`${escrowAccount.escrowAddress}\`\n`;
    message += `💰 **You must deposit ${amount} ETH** to the escrow address before the match starts.\n\n`;

    // Add verification requirement info
    if (matchType === 'custom' || matchType === 'creative') {
        message += `⚠️ **Proof Required:** Upload screenshot/video when submitting results.\n`;
    }

    if (opponent) {
        message += 'Your opponent has been notified.\n\n';
        message += `📥 **Next Step:** Use \`/escrow deposit ${wagerId} <tx_hash>\` after depositing.`;
    } else if (wagerType === WAGER_TYPES.LFT) {
        message += `Players can join your team using \`/wager lft-join ${wagerId} creator\`.\n`;
        message += `Opponents can join using \`/wager lft-join ${wagerId} opponent\`.\n\n`;
        message += `📥 **Next Step:** Use \`/escrow deposit ${wagerId} <tx_hash>\` after depositing.`;
    } else {
        message += `Other players can accept this challenge using \`/wager accept ${wagerId}\`.\n\n`;
        message += `📥 **Next Step:** Use \`/escrow deposit ${wagerId} <tx_hash>\` after depositing.`;
    }

    const embed = createSuccessEmbed(message);

    // Send deposit instructions as second embed
    const depositEmbed = createDepositInstructionsEmbed(wagerId, escrowAccount.escrowAddress, amount);

    await interaction.reply({ embeds: [embed, depositEmbed] });

    // Send wager alert to channel
    await sendWagerAlert(interaction.client, wager);

    // Notify opponent if direct challenge
    if (opponent) {
        await notifyWagerAccepted(interaction.client, wager);
    }
}

async function handleAccept(interaction) {
    const wagerId = interaction.options.getInteger('id');

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'open') {
        const embed = createErrorEmbed('This wager is no longer open for acceptance.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Cannot accept own wager
    if (wager.creator_id === interaction.user.id) {
        const embed = createErrorEmbed('You cannot accept your own wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Accept wager
    wagerOps.accept(wagerId, interaction.user.id);

    // Get escrow account
    const escrowStatus = escrowService.getEscrowStatus(wagerId);

    const gameName = GAME_CHOICES.find(g => g.value === wager.game)?.name || wager.game;
    const embed = createSuccessEmbed(
        `✅ Challenge accepted!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Amount:** ${wager.amount} ETH\n\n` +
        `🔐 **Escrow Address:** \`${escrowStatus.escrowAddress}\`\n` +
        `💰 **You must deposit ${wager.amount} ETH** to the escrow address.\n\n` +
        `📥 **Next Step:** Use \`/escrow deposit ${wagerId} <tx_hash>\` after depositing.\n\n` +
        `⚠️ **Both parties must deposit before the match can begin.**`
    );

    // Send deposit instructions as second embed
    const depositEmbed = createDepositInstructionsEmbed(wagerId, escrowStatus.escrowAddress, wager.amount);

    await interaction.reply({ embeds: [embed, depositEmbed] });

    // Notify both players
    const updatedWager = wagerOps.get(wagerId);
    await notifyWagerAccepted(interaction.client, updatedWager);
}

async function handleStatus(interaction) {
    const wagerId = interaction.options.getInteger('id');

    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const creator = await interaction.client.users.fetch(wager.creator_id);
    const opponent = wager.opponent_id ? await interaction.client.users.fetch(wager.opponent_id) : null;

    const embed = createWagerEmbed(wager, creator, opponent);
    
    if (wager.match_id) {
        embed.addFields({ name: 'Match ID', value: wager.match_id, inline: true });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSubmit(interaction) {
    const wagerId = interaction.options.getInteger('id');
    const matchId = interaction.options.getString('match_id');
    const proofUrl = interaction.options.getString('proof_url');

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate participant
    if (wager.creator_id !== interaction.user.id && wager.opponent_id !== interaction.user.id) {
        const embed = createErrorEmbed('You are not a participant in this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'accepted' && wager.status !== 'in_progress') {
        const embed = createErrorEmbed('This wager is not in progress.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate submission based on match type
    const matchType = wager.match_type || 'ranked';
    
    if (matchType === 'custom' || matchType === 'creative') {
        // Custom/creative matches require proof URL
        if (!proofUrl) {
            const embed = createErrorEmbed(
                'Proof required for custom/creative matches!\n\n' +
                'Please provide a proof_url (Discord attachment, Imgur, YouTube, or Streamable link).'
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Validate proof URL
        if (!isValidProofUrl(proofUrl)) {
            const embed = createErrorEmbed(
                'Invalid proof URL!\n\n' +
                'Supported: Discord attachments, Imgur, YouTube, Streamable'
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    } else {
        // Ranked/competitive matches: prefer match_id for API verification, but allow proof_url as fallback
        if (!matchId && !proofUrl) {
            const embed = createErrorEmbed(
                'Match ID or proof URL required!\n\n' +
                '**Preferred**: Provide match_id for automatic API verification (Valorant, LoL).\n' +
                '**Alternative**: Provide proof_url for manual verification.'
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // Submit win
    wagerOps.submit(wagerId, matchId, interaction.user.id, proofUrl);

    let message = `✅ Win submitted successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n`;
    
    if (matchId) {
        message += `**Match ID:** ${matchId}\n`;
    }
    
    if (proofUrl) {
        message += `**Proof URL:** ${proofUrl}\n`;
    }
    
    message += `\nYour opponent has 24 hours to dispute. If no dispute is filed, the wager will be automatically completed.`;

    const embed = createSuccessEmbed(message);

    await interaction.reply({ embeds: [embed] });

    // Notify opponent
    await notifyWagerSubmitted(interaction.client, wager, interaction.user.id);

    // Auto-complete after verification period (in production, this would be handled by a scheduled job)
    // For now, we'll complete it immediately
    setTimeout(async () => {
        const currentWager = wagerOps.get(wagerId);
        if (currentWager.status === 'pending_verification') {
            wagerOps.complete(wagerId, interaction.user.id);
            
            const loserId = interaction.user.id === wager.creator_id ? wager.opponent_id : wager.creator_id;
            
            // Release escrowed funds to winner
            try {
                escrowService.releaseFunds(wagerId, interaction.user.id);
            } catch (error) {
                console.error('Error releasing escrow funds:', error);
            }
            
            // Update balances
            const payout = calculatePayout(wager.amount);
            userOps.updateBalance(interaction.user.id, payout);
            
            // Send notifications
            await notifyWagerCompleted(interaction.client, wager, interaction.user.id);
            await sendMatchResult(interaction.client, wager, interaction.user.id, loserId);
        }
    }, 1000); // In production, this would be 24 hours
}

async function handleDispute(interaction) {
    const wagerId = interaction.options.getInteger('id');
    const reason = interaction.options.getString('reason');

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate participant
    if (wager.creator_id !== interaction.user.id && wager.opponent_id !== interaction.user.id) {
        const embed = createErrorEmbed('You are not a participant in this wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Validate wager status
    if (wager.status !== 'pending_verification' && wager.status !== 'accepted' && wager.status !== 'in_progress') {
        const embed = createErrorEmbed('This wager cannot be disputed at this time.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Create dispute
    const disputeId = disputeOps.create(wagerId, interaction.user.id, reason);
    wagerOps.dispute(wagerId);

    // Lock escrow funds during dispute
    try {
        escrowService.lockFunds(wagerId);
    } catch (error) {
        console.error('Error locking escrow funds:', error);
    }

    const embed = createSuccessEmbed(
        `✅ Dispute filed successfully!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Dispute ID:** ${disputeId}\n` +
        `**Reason:** ${reason}\n\n` +
        `🔒 **Escrow funds have been locked** until the dispute is resolved.\n\n` +
        `A moderator will review your dispute and make a decision.`
    );

    await interaction.reply({ embeds: [embed] });

    // Send dispute alert
    const dispute = disputeOps.get(disputeId);
    await sendDisputeAlert(interaction.client, wager, dispute);
    await notifyDispute(interaction.client, wager, dispute);
}

async function handleLftJoin(interaction) {
    const wagerId = interaction.options.getInteger('id');
    const side = interaction.options.getString('side');

    // Check if user is verified
    const user = userOps.get(interaction.user.id);
    if (!user || !user.verified) {
        const embed = createErrorEmbed('You must verify your wallet first using `/verify <wallet>`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get wager
    const wager = wagerOps.get(wagerId);
    if (!wager) {
        const embed = createErrorEmbed('Wager not found.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if wager is LFT type
    if (wager.wager_type !== WAGER_TYPES.LFT) {
        const embed = createErrorEmbed('This wager is not an LFT (Looking For Teammates) wager.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if wager is still open
    if (wager.status !== 'open') {
        const embed = createErrorEmbed('This wager is no longer accepting players.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if user is already in the wager
    if (wager.creator_id === interaction.user.id) {
        const embed = createErrorEmbed('You are the creator of this wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const existingParticipants = participantOps.getByWager(wagerId);
    if (existingParticipants.some(p => p.discord_id === interaction.user.id)) {
        const embed = createErrorEmbed('You are already in this wager!');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if the side is full
    const sideCount = participantOps.getCount(wagerId, side);
    const maxPerSide = wager.team_size;

    // For creator side, we need to account for the creator themselves
    const currentSideCount = side === 'creator' ? sideCount + 1 : sideCount;

    if (currentSideCount >= maxPerSide) {
        const embed = createErrorEmbed(`The ${side} side is already full (${maxPerSide}/${maxPerSide}).`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add participant
    participantOps.add(wagerId, interaction.user.id, side);

    const newSideCount = currentSideCount + 1;
    const gameName = GAME_CHOICES.find(g => g.value === wager.game)?.name || wager.game;

    const embed = createSuccessEmbed(
        `✅ Successfully joined the wager!\n\n` +
        `**Wager ID:** ${wagerId}\n` +
        `**Game:** ${gameName}\n` +
        `**Side:** ${side === 'creator' ? 'Creator' : 'Opponent'}\n` +
        `**Team Size:** ${newSideCount}/${maxPerSide}\n\n` +
        `${newSideCount === maxPerSide ? '✅ Your side is now full!' : `Waiting for ${maxPerSide - newSideCount} more player(s) on your side.`}`
    );

    await interaction.reply({ embeds: [embed] });

    // Check if both sides are full
    const creatorSideCount = participantOps.getCount(wagerId, 'creator') + 1; // +1 for creator
    const opponentSideCount = participantOps.getCount(wagerId, 'opponent');

    if (creatorSideCount === maxPerSide && opponentSideCount === maxPerSide) {
        // Both sides are full, accept the wager
        // Set the first opponent participant as the opponent
        const opponentParticipants = participantOps.getByWager(wagerId, 'opponent');
        if (opponentParticipants.length > 0) {
            wagerOps.accept(wagerId, opponentParticipants[0].discord_id);
            
            // Notify all participants
            const allParticipants = participantOps.getByWager(wagerId);
            const updatedWager = wagerOps.get(wagerId);
            
            for (const participant of allParticipants) {
                try {
                    const user = await interaction.client.users.fetch(participant.discord_id);
                    await user.send(
                        `✅ Wager #${wagerId} is now full and ready to start!\n\n` +
                        `All ${maxPerSide}v${maxPerSide} slots have been filled. Good luck!`
                    );
                } catch (error) {
                    console.error('Error notifying participant:', error);
                }
            }

            // Also notify the creator
            try {
                const creator = await interaction.client.users.fetch(wager.creator_id);
                await creator.send(
                    `✅ Your wager #${wagerId} is now full and ready to start!\n\n` +
                    `All ${maxPerSide}v${maxPerSide} slots have been filled. Good luck!`
                );
            } catch (error) {
                console.error('Error notifying creator:', error);
            }
        }
    }
}
