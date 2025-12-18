const { EmbedBuilder } = require('discord.js');
const { COLORS, calculatePayout, calculateFee } = require('./constants');

function createWagerEmbed(wager, creator, opponent = null) {
    const fee = calculateFee(wager.amount).toFixed(4);
    const payout = calculatePayout(wager.amount).toFixed(4);

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
    const fee = calculateFee(wager.amount).toFixed(4);
    const payout = calculatePayout(wager.amount).toFixed(4);

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
                       '`/link <game> <username>` - Link a gaming account'
            },
            {
                name: '💰 Wallet Commands',
                value: '`/deposit` - Get your deposit address to add funds\n' +
                       '`/balance` - View balance, stats, and transaction history\n' +
                       '`/withdraw <amount>` - Withdraw funds to your verified wallet'
            },
            {
                name: '🎮 Wager Commands',
                value: '`/wager create <game> <amount> [match_type]` - Create a new wager\n' +
                       '`/wager accept <id>` - Accept an open challenge\n' +
                       '`/wager status <id>` - Check wager details\n' +
                       '`/wager submit <id> [match_id] [proof_url]` - Submit win proof\n' +
                       '`/wager dispute <id> <reason>` - File a dispute\n' +
                       '`/wager lft-join <id> <side>` - Join LFT wager'
            },
            {
                name: '⚖️ Dispute Commands',
                value: '`/dispute counter-proof <dispute_id> <proof_url>` - Submit counter evidence\n' +
                       '`/dispute vote <dispute_id> <side>` - Vote on a dispute\n' +
                       '`/dispute resolve <dispute_id> <winner>` - Resolve dispute (Moderators)'
            },
            {
                name: '👥 Team Commands',
                value: '`/team create <name> <game>` - Create a team\n' +
                       '`/team invite <team_id> <@user>` - Invite to team\n' +
                       '`/team roster [team_id]` - View team roster'
            },
            {
                name: '📊 Statistics',
                value: '`/stats [@user]` - View user statistics\n' +
                       '`/leaderboard [game]` - View top players'
            },
            {
                name: '🎯 Match Types',
                value: '**Ranked/Competitive**: API-verified matches (Valorant, LoL)\n' +
                       '**Custom/Creative**: Requires screenshot/video proof\n' +
                       'Supported proof: Discord attachments, Imgur, YouTube, Streamable'
            },
            {
                name: '💡 Tips',
                value: '• Deposit funds once, use for all wagers\n' +
                       '• Funds held automatically when creating/accepting wagers\n' +
                       '• Winner receives 97% of total pot (3% platform fee)\n' +
                       '• Custom matches need proof URLs\n' +
                       '• Disputes can be voted on by community\n' +
                       '• Moderators resolve contested disputes\n' +
                       '• Withdraw unused funds anytime'
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

function createEscrowEmbed(escrowAccount, transactions) {
    const statusEmoji = {
        'awaiting_deposits': '⏳',
        'funded': '✅',
        'locked': '🔒',
        'released': '💰',
        'refunded': '↩️'
    };

    const embed = new EmbedBuilder()
        .setTitle('🔐 Escrow Status')
        .setColor(COLORS.INFO)
        .addFields(
            { name: 'Wager ID', value: `#${escrowAccount.wagerId}`, inline: true },
            { name: 'Status', value: `${statusEmoji[escrowAccount.status] || '❓'} ${escrowAccount.status.toUpperCase()}`, inline: true },
            { name: 'Escrow Address', value: `\`${escrowAccount.escrowAddress}\``, inline: false },
            { name: 'Creator Deposited', value: escrowAccount.creatorDeposited ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Opponent Deposited', value: escrowAccount.opponentDeposited ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Total Amount', value: `${escrowAccount.totalAmount} ETH`, inline: true }
        );

    if (transactions && transactions.length > 0) {
        const txList = transactions.slice(0, 5).map(tx => {
            const typeEmoji = tx.transaction_type === 'deposit' ? '📥' : tx.transaction_type === 'release' ? '📤' : '↩️';
            return `${typeEmoji} ${tx.transaction_type.toUpperCase()} - ${tx.amount} ETH (${tx.status})`;
        }).join('\n');
        
        embed.addFields({ name: 'Recent Transactions', value: txList || 'No transactions yet' });
    }

    embed.setTimestamp()
        .setFooter({ text: 'Secure Escrow System' });

    return embed;
}

function createDepositInstructionsEmbed(wagerId, escrowAddress, amount) {
    const embed = new EmbedBuilder()
        .setTitle('💳 Deposit Instructions')
        .setColor(COLORS.PRIMARY)
        .setDescription(
            `To participate in this wager, you must deposit **${amount} ETH** into the escrow account.\n\n` +
            `**How to deposit:**\n` +
            `1. Send **exactly ${amount} ETH** to the escrow address below\n` +
            `2. Copy your transaction hash after sending\n` +
            `3. Use \`/escrow deposit ${wagerId} <tx_hash>\` to submit proof\n` +
            `4. Wait for verification\n\n` +
            `⚠️ **Important:**\n` +
            `• Only send from your verified wallet address\n` +
            `• Send the exact amount (${amount} ETH)\n` +
            `• Keep your transaction hash for verification\n` +
            `• Do not share your private keys with anyone`
        )
        .addFields(
            { name: '🔐 Escrow Address', value: `\`${escrowAddress}\``, inline: false },
            { name: '💰 Required Amount', value: `${amount} ETH`, inline: true },
            { name: '🎮 Wager ID', value: `#${wagerId}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Secure Escrow System - Your funds are safe' });

    return embed;
}

function createInsufficientFundsEmbed(required, available) {
    return new EmbedBuilder()
        .setTitle('❌ Insufficient Balance')
        .setDescription(
            `You don't have enough funds in your wallet to create or accept this wager.\n\n` +
            `**Required:** ${required.toFixed(4)} ETH\n` +
            `**Available:** ${available.toFixed(4)} ETH\n` +
            `**Needed:** ${(required - available).toFixed(4)} ETH`
        )
        .addFields({
            name: '💡 How to Add Funds',
            value: 'Use `/deposit` to get your unique deposit address and add funds to your wallet.',
            inline: false
        })
        .setColor(COLORS.ERROR)
        .setTimestamp();
}

function createBalanceEmbed(wallet, stats) {
    return new EmbedBuilder()
        .setTitle('💰 Your Wallet')
        .setColor(COLORS.PRIMARY)
        .setDescription(
            `**Available:** ${wallet.available_balance.toFixed(4)} ETH _(can wager or withdraw)_\n` +
            `**In Wagers:** ${wallet.held_balance.toFixed(4)} ETH _(locked in active matches)_\n` +
            `**Total:** ${(wallet.available_balance + wallet.held_balance).toFixed(4)} ETH`
        )
        .addFields(
            { 
                name: '📊 Statistics', 
                value: 
                    `**Total Deposited:** ${wallet.total_deposited.toFixed(4)} ETH\n` +
                    `**Total Withdrawn:** ${wallet.total_withdrawn.toFixed(4)} ETH\n` +
                    `**Total Won:** ${wallet.total_won.toFixed(4)} ETH\n` +
                    `**Total Lost:** ${wallet.total_lost.toFixed(4)} ETH`,
                inline: false 
            }
        )
        .setFooter({ text: 'Your wallet is ready to use!' })
        .setTimestamp();
}

function createWithdrawEmbed(amount, txHash, toAddress) {
    return new EmbedBuilder()
        .setTitle('✅ Withdrawal Initiated')
        .setColor(COLORS.SUCCESS)
        .setDescription(
            `Your withdrawal has been initiated and will be processed shortly.`
        )
        .addFields(
            { name: '💰 Amount', value: `${amount.toFixed(4)} ETH`, inline: true },
            { name: '📍 To Address', value: `\`${toAddress}\``, inline: false },
            { name: '🔗 Transaction Hash', value: `\`${txHash}\``, inline: false },
            { name: '⏱️ Status', value: 'Pending confirmation', inline: false }
        )
        .setFooter({ text: 'You will receive a notification when complete' })
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
    createSuccessEmbed,
    createEscrowEmbed,
    createDepositInstructionsEmbed,
    createInsufficientFundsEmbed,
    createBalanceEmbed,
    createWithdrawEmbed
};
