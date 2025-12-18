const { EmbedBuilder } = require('discord.js');
const { COLORS, PLATFORM_FEE } = require('./constants');

function createWagerEmbed(wager, creator, opponent = null) {
    const fee = (wager.amount * PLATFORM_FEE).toFixed(4);
    const payout = (wager.amount * 2 * (1 - PLATFORM_FEE)).toFixed(4);

    const teamSize = wager.team_size || 1;
    const wagerType = wager.wager_type || 'solo';
    const matchType = wager.match_type || 'ranked';

    const embed = new EmbedBuilder()
        .setTitle(`🎮 ${wager.game} Wager #${wager.id}${teamSize > 1 ? ` (${teamSize}v${teamSize})` : ''}`)
        .setColor(COLORS.PRIMARY)
        .addFields(
            { name: 'Creator', value: `<@${wager.creator_id}>`, inline: true },
            { name: 'Opponent', value: opponent ? `<@${wager.opponent_id}>` : 'Open Challenge', inline: true },
            { name: 'Amount', value: `${wager.amount} ETH`, inline: true },
            { name: 'Platform Fee', value: `${fee} ETH (3%)`, inline: true },
            { name: 'Winner Payout', value: `${payout} ETH`, inline: true },
            { name: 'Status', value: wager.status.toUpperCase(), inline: true }
        );

    // Add match type
    const matchTypeEmoji = matchType === 'ranked' || matchType === 'competitive' ? '✅' : '📸';
    embed.addFields({ name: 'Match Type', value: `${matchTypeEmoji} ${matchType.toUpperCase()}`, inline: true });

    if (teamSize > 1) {
        const typeDisplay = wagerType === 'lft' ? '🔍 LFT (Looking For Teammates)' : '👥 Team Wager';
        embed.addFields({ name: 'Type', value: typeDisplay, inline: true });
    }

    // Add proof URL if available
    if (wager.proof_url) {
        embed.addFields({ name: 'Proof', value: wager.proof_url });
    }

    embed.setTimestamp(new Date(wager.created_at))
        .setFooter({ text: `Wager ID: ${wager.id}` });

    return embed;
}

function createMatchResultEmbed(wager, winner, loser) {
    const fee = (wager.amount * PLATFORM_FEE).toFixed(4);
    const payout = (wager.amount * 2 * (1 - PLATFORM_FEE)).toFixed(4);

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Match Result - ${wager.game}`)
        .setColor(COLORS.SUCCESS)
        .addFields(
            { name: 'Winner', value: `<@${winner}>`, inline: true },
            { name: 'Loser', value: `<@${loser}>`, inline: true },
            { name: 'Wager Amount', value: `${wager.amount} ETH`, inline: true },
            { name: 'Platform Fee', value: `${fee} ETH`, inline: true },
            { name: 'Payout', value: `${payout} ETH`, inline: true },
            { name: 'Match ID', value: wager.match_id || 'N/A', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Wager ID: ${wager.id}` });

    return embed;
}

function createDisputeEmbed(wager, dispute, filer) {
    const embed = new EmbedBuilder()
        .setTitle(`⚠️ Dispute Filed - Wager #${wager.id}`)
        .setColor(COLORS.WARNING)
        .addFields(
            { name: 'Game', value: wager.game, inline: true },
            { name: 'Amount', value: `${wager.amount} ETH`, inline: true },
            { name: 'Filed By', value: `<@${dispute.filer_id}>`, inline: true },
            { name: 'Reason', value: dispute.reason }
        );

    // Add original proof if available
    if (wager.proof_url) {
        embed.addFields({ name: 'Original Proof', value: wager.proof_url });
    }

    // Add counter-proof if available
    if (dispute.counter_proof) {
        embed.addFields({ name: 'Counter-Proof', value: dispute.counter_proof });
    }

    embed.setTimestamp(new Date(dispute.created_at))
        .setFooter({ text: `Dispute ID: ${dispute.id}` });

    return embed;
}

function createStatsEmbed(user, stats) {
    const winRate = stats.total_matches > 0 
        ? ((stats.wins / stats.total_matches) * 100).toFixed(1) 
        : 0;

    const embed = new EmbedBuilder()
        .setTitle(`📊 Stats for ${user.username}`)
        .setColor(COLORS.INFO)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'Wins', value: stats.wins.toString(), inline: true },
            { name: 'Losses', value: stats.losses.toString(), inline: true },
            { name: 'Win Rate', value: `${winRate}%`, inline: true },
            { name: 'Total Wagered', value: `${stats.total_wagered.toFixed(4)} ETH`, inline: true },
            { name: 'Total Earnings', value: `${stats.total_earnings.toFixed(4)} ETH`, inline: true },
            { name: 'Net Profit', value: `${(stats.total_earnings - stats.total_wagered).toFixed(4)} ETH`, inline: true }
        )
        .setTimestamp();

    return embed;
}

function createLeaderboardEmbed(leaderboard, game = null) {
    const title = game ? `🏆 ${game} Leaderboard` : '🏆 Overall Leaderboard';
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(COLORS.PRIMARY)
        .setTimestamp();

    if (leaderboard.length === 0) {
        embed.setDescription('No data available yet.');
    } else {
        const description = leaderboard.map((entry, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} <@${entry.discord_id}> - ${entry.wins}W/${entry.losses}L (${entry.total_wagered.toFixed(2)} ETH)`;
        }).join('\n');
        
        embed.setDescription(description);
    }

    return embed;
}

function createHelpEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('📚 Wager Bot Commands')
        .setColor(COLORS.INFO)
        .setDescription('Complete list of available commands:')
        .addFields(
            {
                name: '🔗 Account Management',
                value: '`/verify <wallet>` - Link your Discord to an ETH wallet\n' +
                       '`/link <game> <username>` - Link a gaming account\n' +
                       '`/balance` - Check your escrow balance'
            },
            {
                name: '🎮 Wager Commands',
                value: '`/wager create <game> <amount> [opponent]` - Create a new wager\n' +
                       '`/wager accept <id>` - Accept an open challenge\n' +
                       '`/wager status <id>` - Check wager details\n' +
                       '`/wager submit <id> <match_id>` - Submit win proof\n' +
                       '`/wager dispute <id> <reason>` - File a dispute'
            },
            {
                name: '📊 Statistics',
                value: '`/stats [@user]` - View user statistics\n' +
                       '`/leaderboard [game]` - View top players'
            },
            {
                name: '💡 Tips',
                value: '• Wagers require 3% platform fee\n' +
                       '• Winner receives 97% of total pot\n' +
                       '• Submit match IDs for verification\n' +
                       '• Disputes are reviewed manually'
            }
        )
        .setTimestamp();

    return embed;
}

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(message)
        .setColor(COLORS.ERROR)
        .setTimestamp();
}

function createSuccessEmbed(message) {
    return new EmbedBuilder()
        .setTitle('✅ Success')
        .setDescription(message)
        .setColor(COLORS.SUCCESS)
        .setTimestamp();
}

module.exports = {
    createWagerEmbed,
    createMatchResultEmbed,
    createDisputeEmbed,
    createStatsEmbed,
    createLeaderboardEmbed,
    createHelpEmbed,
    createErrorEmbed,
    createSuccessEmbed
};
