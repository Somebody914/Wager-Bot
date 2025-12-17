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
    create(discordId, platform, username) {
        const stmt = db.prepare('INSERT OR REPLACE INTO linked_accounts (discord_id, platform, username) VALUES (?, ?, ?)');
        return stmt.run(discordId, platform, username);
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
    create(creatorId, opponentId, game, amount) {
        const stmt = db.prepare('INSERT INTO wagers (creator_id, opponent_id, game, amount, status) VALUES (?, ?, ?, ?, ?)');
        const status = opponentId ? 'accepted' : 'open';
        const result = stmt.run(creatorId, opponentId, game, amount, status);
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

    submit(wagerId, matchId, winnerId) {
        const stmt = db.prepare('UPDATE wagers SET match_id = ?, winner_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(matchId, winnerId, 'pending_verification', wagerId);
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

module.exports = {
    initializeDatabase,
    userOps,
    linkedAccountOps,
    wagerOps,
    disputeOps,
    statsOps,
    db
};
