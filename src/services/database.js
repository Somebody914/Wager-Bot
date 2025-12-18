const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../wager.db'));

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            discord_id TEXT PRIMARY KEY,
            wallet_address TEXT UNIQUE,
            verified INTEGER DEFAULT 0,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Linked accounts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS linked_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            username TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            platform_id TEXT,
            verified_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (discord_id) REFERENCES users(discord_id),
            UNIQUE(discord_id, platform)
        )
    `);

    // Wagers table
    db.exec(`
        CREATE TABLE IF NOT EXISTS wagers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator_id TEXT NOT NULL,
            opponent_id TEXT,
            game TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'open',
            winner_id TEXT,
            match_id TEXT,
            proof TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES users(discord_id),
            FOREIGN KEY (opponent_id) REFERENCES users(discord_id)
        )
    `);

    // Disputes table
    db.exec(`
        CREATE TABLE IF NOT EXISTS disputes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wager_id INTEGER NOT NULL,
            filer_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            evidence TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (wager_id) REFERENCES wagers(id),
            FOREIGN KEY (filer_id) REFERENCES users(discord_id)
        )
    `);

    // Teams table
    db.exec(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            captain_id TEXT NOT NULL,
            game TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (captain_id) REFERENCES users(discord_id)
        )
    `);

    // Team members table
    db.exec(`
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER NOT NULL,
            discord_id TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (discord_id) REFERENCES users(discord_id),
            UNIQUE(team_id, discord_id)
        )
    `);

    // Wager participants table (for LFT - Looking For Teammates)
    db.exec(`
        CREATE TABLE IF NOT EXISTS wager_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wager_id INTEGER NOT NULL,
            discord_id TEXT NOT NULL,
            team_side TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wager_id) REFERENCES wagers(id),
            FOREIGN KEY (discord_id) REFERENCES users(discord_id),
            UNIQUE(wager_id, discord_id)
        )
    `);

    // Add team-related columns to wagers table if they don't exist
    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN team_size INTEGER DEFAULT 1`);
    } catch (e) {
        // Column already exists
    }
    
    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN creator_team_id INTEGER`);
    } catch (e) {
        // Column already exists
    }
    
    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN opponent_team_id INTEGER`);
    } catch (e) {
        // Column already exists
    }
    
    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN wager_type TEXT DEFAULT 'solo'`);
    } catch (e) {
        // Column already exists
    }

    // Add verification-related columns to wagers table
    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN proof_url TEXT`);
    } catch (e) {
        // Column already exists
    }

    try {
        db.exec(`ALTER TABLE wagers ADD COLUMN match_type TEXT DEFAULT 'ranked'`);
    } catch (e) {
        // Column already exists
    }

    // Add counter_proof column to disputes table
    try {
        db.exec(`ALTER TABLE disputes ADD COLUMN counter_proof TEXT`);
    } catch (e) {
        // Column already exists
    }

    // Dispute votes table (for community voting system)
    db.exec(`
        CREATE TABLE IF NOT EXISTS dispute_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dispute_id INTEGER NOT NULL,
            voter_id TEXT NOT NULL,
            vote TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dispute_id) REFERENCES disputes(id),
            FOREIGN KEY (voter_id) REFERENCES users(discord_id),
            UNIQUE(dispute_id, voter_id)
        )
    `);

    // Escrow accounts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS escrow_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wager_id INTEGER UNIQUE NOT NULL,
            escrow_address TEXT NOT NULL,
            creator_deposited INTEGER DEFAULT 0,
            opponent_deposited INTEGER DEFAULT 0,
            total_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'awaiting_deposits',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wager_id) REFERENCES wagers(id)
        )
    `);

    // Escrow transactions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS escrow_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wager_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            transaction_type TEXT NOT NULL,
            amount REAL NOT NULL,
            tx_hash TEXT,
            status TEXT DEFAULT 'pending',
            escrow_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            confirmed_at DATETIME,
            FOREIGN KEY (wager_id) REFERENCES wagers(id),
            FOREIGN KEY (user_id) REFERENCES users(discord_id)
        )
    `);

    console.log('✅ Database initialized successfully');
}

// User operations
const userOps = {
    create(discordId) {
        const stmt = db.prepare('INSERT OR IGNORE INTO users (discord_id) VALUES (?)');
        return stmt.run(discordId);
    },

    get(discordId) {
        const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
        return stmt.get(discordId);
    },

    verify(discordId, walletAddress) {
        const stmt = db.prepare('UPDATE users SET wallet_address = ?, verified = 1 WHERE discord_id = ?');
        return stmt.run(walletAddress, discordId);
    },

    updateBalance(discordId, amount) {
        const stmt = db.prepare('UPDATE users SET balance = balance + ? WHERE discord_id = ?');
        return stmt.run(amount, discordId);
    },

    getBalance(discordId) {
        const stmt = db.prepare('SELECT balance FROM users WHERE discord_id = ?');
        const result = stmt.get(discordId);
        return result ? result.balance : 0;
    }
};

// Linked accounts operations
const linkedAccountOps = {
    create(discordId, platform, username, platformId = null, verified = 0) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO linked_accounts 
            (discord_id, platform, username, platform_id, verified, verified_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const verifiedAt = verified ? new Date().toISOString() : null;
        return stmt.run(discordId, platform, username, platformId, verified, verifiedAt);
    },

    get(discordId, platform) {
        const stmt = db.prepare('SELECT * FROM linked_accounts WHERE discord_id = ? AND platform = ?');
        return stmt.get(discordId, platform);
    },

    getAll(discordId) {
        const stmt = db.prepare('SELECT * FROM linked_accounts WHERE discord_id = ?');
        return stmt.all(discordId);
    }
};

// Wager operations
const wagerOps = {
    create(creatorId, opponentId, game, amount, teamSize = 1, wagerType = 'solo', creatorTeamId = null, opponentTeamId = null, matchType = 'ranked') {
        const stmt = db.prepare(`
            INSERT INTO wagers 
            (creator_id, opponent_id, game, amount, status, team_size, wager_type, creator_team_id, opponent_team_id, match_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const status = opponentId ? 'accepted' : 'open';
        const result = stmt.run(creatorId, opponentId, game, amount, status, teamSize, wagerType, creatorTeamId, opponentTeamId, matchType);
        return result.lastInsertRowid;
    },

    get(id) {
        const stmt = db.prepare('SELECT * FROM wagers WHERE id = ?');
        return stmt.get(id);
    },

    accept(wagerId, opponentId) {
        const stmt = db.prepare('UPDATE wagers SET opponent_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?');
        return stmt.run(opponentId, 'accepted', wagerId, 'open');
    },

    submit(wagerId, matchId, winnerId, proofUrl = null) {
        const stmt = db.prepare('UPDATE wagers SET match_id = ?, winner_id = ?, proof_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(matchId, winnerId, proofUrl, 'pending_verification', wagerId);
    },

    complete(wagerId, winnerId) {
        const stmt = db.prepare('UPDATE wagers SET winner_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(winnerId, 'completed', wagerId);
    },

    dispute(wagerId) {
        const stmt = db.prepare('UPDATE wagers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run('disputed', wagerId);
    },

    cancel(wagerId) {
        const stmt = db.prepare('UPDATE wagers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run('cancelled', wagerId);
    },

    getOpenWagers(game = null) {
        if (game) {
            const stmt = db.prepare('SELECT * FROM wagers WHERE status = ? AND game = ? ORDER BY created_at DESC');
            return stmt.all('open', game);
        } else {
            const stmt = db.prepare('SELECT * FROM wagers WHERE status = ? ORDER BY created_at DESC');
            return stmt.all('open');
        }
    },

    getUserWagers(discordId) {
        const stmt = db.prepare('SELECT * FROM wagers WHERE creator_id = ? OR opponent_id = ? ORDER BY created_at DESC');
        return stmt.all(discordId, discordId);
    }
};

// Dispute operations
const disputeOps = {
    create(wagerId, filerId, reason, evidence = null) {
        const stmt = db.prepare('INSERT INTO disputes (wager_id, filer_id, reason, evidence) VALUES (?, ?, ?, ?)');
        const result = stmt.run(wagerId, filerId, reason, evidence);
        return result.lastInsertRowid;
    },

    get(id) {
        const stmt = db.prepare('SELECT * FROM disputes WHERE id = ?');
        return stmt.get(id);
    },

    getByWager(wagerId) {
        const stmt = db.prepare('SELECT * FROM disputes WHERE wager_id = ?');
        return stmt.get(wagerId);
    },

    resolve(disputeId, status) {
        const stmt = db.prepare('UPDATE disputes SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(status, disputeId);
    },

    addCounterProof(disputeId, counterProof) {
        const stmt = db.prepare('UPDATE disputes SET counter_proof = ? WHERE id = ?');
        return stmt.run(counterProof, disputeId);
    }
};

// Dispute vote operations
const disputeVoteOps = {
    addVote(disputeId, voterId, vote) {
        const stmt = db.prepare('INSERT OR REPLACE INTO dispute_votes (dispute_id, voter_id, vote) VALUES (?, ?, ?)');
        return stmt.run(disputeId, voterId, vote);
    },

    getVotes(disputeId) {
        const stmt = db.prepare('SELECT * FROM dispute_votes WHERE dispute_id = ?');
        return stmt.all(disputeId);
    },

    getVoteCounts(disputeId) {
        const stmt = db.prepare(`
            SELECT 
                SUM(CASE WHEN vote = 'creator' THEN 1 ELSE 0 END) as creator_votes,
                SUM(CASE WHEN vote = 'opponent' THEN 1 ELSE 0 END) as opponent_votes
            FROM dispute_votes 
            WHERE dispute_id = ?
        `);
        return stmt.get(disputeId);
    }
};

// Statistics operations
const statsOps = {
    getUserStats(discordId, game = null) {
        let query = `
            SELECT 
                COUNT(*) as total_matches,
                SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN (creator_id = ? OR opponent_id = ?) AND winner_id != ? AND winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN creator_id = ? OR opponent_id = ? THEN amount ELSE 0 END) as total_wagered,
                SUM(CASE WHEN winner_id = ? THEN amount * 2 * 0.97 ELSE 0 END) as total_earnings
            FROM wagers 
            WHERE status = 'completed' AND (creator_id = ? OR opponent_id = ?)
        `;
        
        const params = [discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId, discordId];
        
        if (game) {
            query += ' AND game = ?';
            params.push(game);
        }
        
        const stmt = db.prepare(query);
        return stmt.get(...params);
    },

    getLeaderboard(game = null, limit = 10) {
        let query = `
            SELECT 
                u.discord_id,
                COUNT(*) as total_matches,
                SUM(CASE WHEN w.winner_id = u.discord_id THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN (w.creator_id = u.discord_id OR w.opponent_id = u.discord_id) AND w.winner_id != u.discord_id AND w.winner_id IS NOT NULL THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN w.creator_id = u.discord_id OR w.opponent_id = u.discord_id THEN w.amount ELSE 0 END) as total_wagered
            FROM users u
            JOIN wagers w ON (w.creator_id = u.discord_id OR w.opponent_id = u.discord_id)
            WHERE w.status = 'completed'
        `;
        
        if (game) {
            query += ' AND w.game = ?';
        }
        
        query += ' GROUP BY u.discord_id ORDER BY wins DESC, total_wagered DESC LIMIT ?';
        
        const stmt = db.prepare(query);
        return game ? stmt.all(game, limit) : stmt.all(limit);
    }
};

// Team operations
const teamOps = {
    create(name, captainId, game) {
        const stmt = db.prepare('INSERT INTO teams (name, captain_id, game) VALUES (?, ?, ?)');
        const result = stmt.run(name, captainId, game);
        return result.lastInsertRowid;
    },

    get(id) {
        const stmt = db.prepare('SELECT * FROM teams WHERE id = ?');
        return stmt.get(id);
    },

    getByUser(discordId) {
        const stmt = db.prepare(`
            SELECT t.* FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            WHERE t.captain_id = ? OR tm.discord_id = ?
        `);
        return stmt.all(discordId, discordId);
    },

    delete(id) {
        const stmt = db.prepare('DELETE FROM teams WHERE id = ?');
        return stmt.run(id);
    },

    addMember(teamId, discordId) {
        const stmt = db.prepare('INSERT INTO team_members (team_id, discord_id) VALUES (?, ?)');
        return stmt.run(teamId, discordId);
    },

    removeMember(teamId, discordId) {
        const stmt = db.prepare('DELETE FROM team_members WHERE team_id = ? AND discord_id = ?');
        return stmt.run(teamId, discordId);
    },

    getMembers(teamId) {
        const stmt = db.prepare('SELECT discord_id FROM team_members WHERE team_id = ?');
        return stmt.all(teamId);
    },

    getMemberCount(teamId) {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM team_members WHERE team_id = ?');
        const result = stmt.get(teamId);
        return result ? result.count + 1 : 1; // +1 for captain
    }
};

// Wager participants operations (for LFT wagers)
const participantOps = {
    add(wagerId, discordId, teamSide) {
        const stmt = db.prepare('INSERT INTO wager_participants (wager_id, discord_id, team_side) VALUES (?, ?, ?)');
        return stmt.run(wagerId, discordId, teamSide);
    },

    remove(wagerId, discordId) {
        const stmt = db.prepare('DELETE FROM wager_participants WHERE wager_id = ? AND discord_id = ?');
        return stmt.run(wagerId, discordId);
    },

    getByWager(wagerId, teamSide = null) {
        if (teamSide) {
            const stmt = db.prepare('SELECT * FROM wager_participants WHERE wager_id = ? AND team_side = ?');
            return stmt.all(wagerId, teamSide);
        } else {
            const stmt = db.prepare('SELECT * FROM wager_participants WHERE wager_id = ?');
            return stmt.all(wagerId);
        }
    },

    getCount(wagerId, teamSide) {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM wager_participants WHERE wager_id = ? AND team_side = ?');
        const result = stmt.get(wagerId, teamSide);
        return result ? result.count : 0;
    }
};

// Escrow operations
const escrowOps = {
    createAccount(wagerId, escrowAddress) {
        const stmt = db.prepare(`
            INSERT INTO escrow_accounts (wager_id, escrow_address, status) 
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(wagerId, escrowAddress, 'awaiting_deposits');
        return result.lastInsertRowid;
    },

    recordDeposit(wagerId, userId, amount, txHash) {
        // Record transaction
        const stmt = db.prepare(`
            INSERT INTO escrow_transactions 
            (wager_id, user_id, transaction_type, amount, tx_hash, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(wagerId, userId, 'deposit', amount, txHash, 'confirmed');
        
        // Update total amount in escrow account
        const updateStmt = db.prepare(`
            UPDATE escrow_accounts 
            SET total_amount = total_amount + ? 
            WHERE wager_id = ?
        `);
        updateStmt.run(amount, wagerId);
        
        return result.lastInsertRowid;
    },

    recordTransaction(wagerId, userId, transactionType, amount, txHash, status) {
        const stmt = db.prepare(`
            INSERT INTO escrow_transactions 
            (wager_id, user_id, transaction_type, amount, tx_hash, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(wagerId, userId, transactionType, amount, txHash, status);
        return result.lastInsertRowid;
    },

    getAccount(wagerId) {
        const stmt = db.prepare('SELECT * FROM escrow_accounts WHERE wager_id = ?');
        return stmt.get(wagerId);
    },

    getTransactions(wagerId) {
        const stmt = db.prepare('SELECT * FROM escrow_transactions WHERE wager_id = ? ORDER BY created_at DESC');
        return stmt.all(wagerId);
    },

    updateStatus(wagerId, status) {
        const stmt = db.prepare('UPDATE escrow_accounts SET status = ? WHERE wager_id = ?');
        return stmt.run(status, wagerId);
    },

    markDeposited(wagerId, side) {
        const column = side === 'creator' ? 'creator_deposited' : 'opponent_deposited';
        const stmt = db.prepare(`UPDATE escrow_accounts SET ${column} = 1 WHERE wager_id = ?`);
        return stmt.run(wagerId);
    }
};

module.exports = {
    initializeDatabase,
    userOps,
    linkedAccountOps,
    wagerOps,
    disputeOps,
    disputeVoteOps,
    statsOps,
    teamOps,
    participantOps,
    escrowOps,
    db
};
