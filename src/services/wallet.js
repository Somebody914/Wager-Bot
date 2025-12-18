const crypto = require('crypto');
const { walletOps, userOps } = require('./database');
const { PLATFORM_FEE } = require('../utils/constants');

/**
 * WalletService - Manages user wallet operations
 * Simple pre-funded wallet balance system
 */
class WalletService {
    /**
     * Generate unique deposit address for user
     * @param {string} discordId - Discord user ID
     * @returns {string} Unique deposit address
     * 
     * WARNING: This implementation is for DEVELOPMENT/TESTING ONLY.
     * In production, you MUST implement proper wallet generation using:
     * - ethers.js or web3.js for secure key generation
     * - Hardware Security Modules (HSM) for key storage
     * - Proper derivation paths (BIP32/BIP44)
     * - Secure key management practices
     */
    generateDepositAddress(discordId) {
        // DEVELOPMENT ONLY: Creates deterministic fake addresses for testing
        // These are NOT real Ethereum addresses and cannot receive actual funds
        
        const masterSeed = process.env.MASTER_WALLET_PRIVATE_KEY || 'development-seed-do-not-use-in-production';
        const hash = crypto.createHash('sha256')
            .update(`${masterSeed}-user-${discordId}`)
            .digest('hex');
        
        return `0x${hash.substring(0, 40)}`;
    }

    /**
     * Get or create wallet for user
     * @param {string} discordId - Discord user ID
     * @returns {Object} Wallet info
     */
    getOrCreateWallet(discordId) {
        let wallet = walletOps.get(discordId);
        
        if (!wallet) {
            // Create new wallet
            const depositAddress = this.generateDepositAddress(discordId);
            walletOps.create(discordId, depositAddress);
            wallet = walletOps.get(discordId);
        }
        
        return wallet;
    }

    /**
     * Check if user has enough balance
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount to check
     * @returns {boolean} True if sufficient balance
     */
    hasBalance(discordId, amount) {
        const wallet = walletOps.get(discordId);
        return wallet && wallet.available_balance >= amount;
    }

    /**
     * Hold funds for a wager (atomic operation)
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount to hold
     * @param {number} wagerId - Wager ID
     * @returns {Object} Transaction result
     */
    holdForWager(discordId, amount, wagerId) {
        try {
            return walletOps.holdFunds(discordId, amount, wagerId, `Wager #${wagerId} - funds held`);
        } catch (error) {
            throw new Error(`Failed to hold funds: ${error.message}`);
        }
    }

    /**
     * Release held funds back (wager cancelled/refunded)
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount to release
     * @param {number} wagerId - Wager ID
     * @returns {Object} Transaction result
     */
    releaseHeldFunds(discordId, amount, wagerId) {
        try {
            return walletOps.releaseFunds(discordId, amount, wagerId, `Wager #${wagerId} - refund`);
        } catch (error) {
            throw new Error(`Failed to release funds: ${error.message}`);
        }
    }

    /**
     * Process wager completion - winner gets both stakes minus fee
     * @param {number} wagerId - Wager ID
     * @param {string} winnerId - Winner's Discord ID
     * @param {string} loserId - Loser's Discord ID
     * @param {number} amount - Original wager amount per player
     * @returns {Object} Processing result
     */
    processWagerResult(wagerId, winnerId, loserId, amount) {
        try {
            // Calculate payout (both stakes minus platform fee)
            const totalPot = amount * 2;
            const fee = totalPot * PLATFORM_FEE;
            const winnings = totalPot - fee;

            // Release winner's held funds and add total winnings
            // This is done in a transaction to ensure atomicity
            const { db } = require('./database');
            const transaction = db.transaction(() => {
                // First release the winner's held stake
                const releaseStmt = db.prepare(`
                    UPDATE user_wallets 
                    SET available_balance = available_balance + ?,
                        held_balance = held_balance - ?
                    WHERE discord_id = ?
                `);
                releaseStmt.run(amount, amount, winnerId);
                
                // Then add the net winnings (total payout minus their original stake)
                const winningsAmount = winnings - amount;
                const updateStmt = db.prepare(`
                    UPDATE user_wallets 
                    SET available_balance = available_balance + ?,
                        total_won = total_won + ?
                    WHERE discord_id = ?
                `);
                updateStmt.run(winningsAmount, winningsAmount, winnerId);

                // Record combined transaction
                const txStmt = db.prepare(`
                    INSERT INTO wallet_transactions 
                    (discord_id, type, amount, wager_id, description) 
                    VALUES (?, ?, ?, ?, ?)
                `);
                txStmt.run(winnerId, 'wager_win', winnings, wagerId, `Wager #${wagerId} - won ${winnings.toFixed(4)} ETH`);
            });
            
            transaction();
            
            // Loser loses their held funds
            walletOps.loseFunds(loserId, amount, wagerId, `Wager #${wagerId} - lost ${amount} ETH`);

            return {
                success: true,
                winnerId,
                loserId,
                winnings,
                fee,
                amount
            };
        } catch (error) {
            throw new Error(`Failed to process wager result: ${error.message}`);
        }
    }

    /**
     * Get formatted balance info for user
     * @param {string} discordId - Discord user ID
     * @returns {Object} Balance information
     */
    getBalanceInfo(discordId) {
        const wallet = this.getOrCreateWallet(discordId);
        
        return {
            depositAddress: wallet.deposit_address,
            availableBalance: wallet.available_balance,
            heldBalance: wallet.held_balance,
            totalBalance: wallet.available_balance + wallet.held_balance,
            totalDeposited: wallet.total_deposited,
            totalWithdrawn: wallet.total_withdrawn,
            totalWon: wallet.total_won,
            totalLost: wallet.total_lost,
            netProfit: wallet.total_won - wallet.total_lost
        };
    }

    /**
     * Add funds to user wallet (deposit detected)
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount deposited
     * @param {string} txHash - Transaction hash
     * @returns {Object} Transaction result
     */
    addFunds(discordId, amount, txHash) {
        // Ensure wallet exists
        this.getOrCreateWallet(discordId);
        
        try {
            return walletOps.addFunds(discordId, amount, txHash, `Deposit of ${amount} ETH`);
        } catch (error) {
            throw new Error(`Failed to add funds: ${error.message}`);
        }
    }

    /**
     * Withdraw funds from wallet
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount to withdraw
     * @param {string} toAddress - Destination address
     * @returns {Object} Withdrawal result
     */
    async withdrawFunds(discordId, amount, toAddress) {
        const wallet = walletOps.get(discordId);
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }

        if (wallet.available_balance < amount) {
            throw new Error(`Insufficient balance. Available: ${wallet.available_balance} ETH`);
        }

        // Check minimum withdrawal
        const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL || '0.005');
        if (amount < minWithdrawal) {
            throw new Error(`Minimum withdrawal is ${minWithdrawal} ETH`);
        }

        // In production, this would actually send the transaction on blockchain
        // For now, we'll simulate with a fake tx hash
        const fakeTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        
        try {
            walletOps.withdraw(discordId, amount, fakeTxHash, `Withdrawal of ${amount} ETH to ${toAddress}`);
            
            return {
                success: true,
                amount,
                toAddress,
                txHash: fakeTxHash,
                status: 'pending'
            };
        } catch (error) {
            throw new Error(`Failed to withdraw funds: ${error.message}`);
        }
    }

    /**
     * Get transaction history
     * @param {string} discordId - Discord user ID
     * @param {number} limit - Number of transactions to return
     * @returns {Array} Transaction history
     */
    getTransactionHistory(discordId, limit = 10) {
        return walletOps.getTransactions(discordId, limit);
    }
}

module.exports = WalletService;
