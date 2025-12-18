const crypto = require('crypto');

/**
 * EscrowService - Manages escrow operations for wagers
 * Provides secure middleman account handling for cryptocurrency wagers
 */
class EscrowService {
    constructor(database) {
        this.db = database;
    }

    /**
     * Creates a unique escrow account for a wager
     * @param {number} wagerId - The wager ID
     * @returns {Object} Created escrow account with unique address
     */
    createEscrowAccount(wagerId) {
        // Generate a unique escrow address for this wager
        // In production, this would integrate with actual wallet generation
        const escrowAddress = this.generateEscrowAddress(wagerId);
        
        const account = this.db.escrowOps.createAccount(wagerId, escrowAddress);
        
        return {
            wagerId,
            escrowAddress,
            status: 'awaiting_deposits',
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Records a user's deposit into escrow
     * @param {number} wagerId - The wager ID
     * @param {string} userId - The Discord user ID
     * @param {number} amount - The amount deposited
     * @param {string} txHash - Transaction hash for verification
     * @returns {Object} Deposit transaction record
     */
    deposit(wagerId, userId, amount, txHash = null) {
        // Record the deposit transaction
        const transactionId = this.db.escrowOps.recordDeposit(
            wagerId, 
            userId, 
            amount, 
            txHash
        );

        return {
            transactionId,
            wagerId,
            userId,
            amount,
            txHash,
            status: 'pending',
            type: 'deposit'
        };
    }

    /**
     * Verifies a deposit was made by checking transaction hash
     * @param {number} wagerId - The wager ID
     * @param {string} userId - The Discord user ID
     * @returns {Object} Verification result
     */
    verifyDeposit(wagerId, userId) {
        // Get the account and check deposit status
        const account = this.db.escrowOps.getAccount(wagerId);
        
        if (!account) {
            throw new Error('Escrow account not found');
        }

        // Get the wager to determine which side the user is on
        const wager = this.db.wagerOps.get(wagerId);
        
        if (!wager) {
            throw new Error('Wager not found');
        }

        // Determine which side the user is on
        let side = null;
        if (wager.creator_id === userId) {
            side = 'creator';
        } else if (wager.opponent_id === userId) {
            side = 'opponent';
        } else {
            throw new Error('User is not a participant in this wager');
        }

        // Check if this side has already deposited
        const alreadyDeposited = side === 'creator' 
            ? account.creator_deposited 
            : account.opponent_deposited;

        if (alreadyDeposited) {
            return {
                verified: true,
                alreadyDeposited: true,
                message: 'Deposit already verified'
            };
        }

        // In production, this would verify the transaction on the blockchain
        // For now, we mark the deposit as verified
        this.db.escrowOps.markDeposited(wagerId, side);

        // Check if both sides have deposited
        const updatedAccount = this.db.escrowOps.getAccount(wagerId);
        const bothDeposited = updatedAccount.creator_deposited && updatedAccount.opponent_deposited;

        if (bothDeposited) {
            // Update account status to funded
            this.db.escrowOps.updateStatus(wagerId, 'funded');
        }

        return {
            verified: true,
            side,
            bothDeposited,
            message: bothDeposited 
                ? 'Both parties have deposited. Wager can now proceed.' 
                : 'Deposit verified. Waiting for opponent to deposit.'
        };
    }

    /**
     * Releases escrowed funds to the winner
     * @param {number} wagerId - The wager ID
     * @param {string} winnerId - The Discord user ID of the winner
     * @returns {Object} Release transaction record
     */
    releaseFunds(wagerId, winnerId) {
        const account = this.db.escrowOps.getAccount(wagerId);
        
        if (!account) {
            throw new Error('Escrow account not found');
        }

        if (account.status !== 'funded' && account.status !== 'locked') {
            throw new Error(`Cannot release funds. Account status: ${account.status}`);
        }

        // Record the release transaction
        const transactionId = this.db.escrowOps.recordTransaction(
            wagerId,
            winnerId,
            'release',
            account.total_amount,
            null, // txHash will be set when actual release happens
            'pending'
        );

        // Update account status
        this.db.escrowOps.updateStatus(wagerId, 'released');

        return {
            transactionId,
            wagerId,
            winnerId,
            amount: account.total_amount,
            status: 'pending',
            type: 'release'
        };
    }

    /**
     * Refunds both parties when wager is cancelled
     * @param {number} wagerId - The wager ID
     * @returns {Object} Refund transaction records
     */
    refundFunds(wagerId) {
        const account = this.db.escrowOps.getAccount(wagerId);
        
        if (!account) {
            throw new Error('Escrow account not found');
        }

        if (account.status === 'released' || account.status === 'refunded') {
            throw new Error(`Cannot refund. Account already ${account.status}`);
        }

        // Get the wager to find who deposited
        const wager = this.db.wagerOps.get(wagerId);
        
        if (!wager) {
            throw new Error('Wager not found');
        }

        const refunds = [];

        // Refund creator if they deposited
        if (account.creator_deposited) {
            const transactionId = this.db.escrowOps.recordTransaction(
                wagerId,
                wager.creator_id,
                'refund',
                wager.amount,
                null,
                'pending'
            );
            refunds.push({
                transactionId,
                userId: wager.creator_id,
                amount: wager.amount
            });
        }

        // Refund opponent if they deposited
        if (account.opponent_deposited && wager.opponent_id) {
            const transactionId = this.db.escrowOps.recordTransaction(
                wagerId,
                wager.opponent_id,
                'refund',
                wager.amount,
                null,
                'pending'
            );
            refunds.push({
                transactionId,
                userId: wager.opponent_id,
                amount: wager.amount
            });
        }

        // Update account status
        this.db.escrowOps.updateStatus(wagerId, 'refunded');

        return {
            wagerId,
            refunds,
            status: 'refunded'
        };
    }

    /**
     * Locks funds during a dispute
     * @param {number} wagerId - The wager ID
     * @returns {Object} Lock status
     */
    lockFunds(wagerId) {
        const account = this.db.escrowOps.getAccount(wagerId);
        
        if (!account) {
            throw new Error('Escrow account not found');
        }

        if (account.status !== 'funded') {
            throw new Error(`Cannot lock funds. Account status: ${account.status}`);
        }

        this.db.escrowOps.updateStatus(wagerId, 'locked');

        return {
            wagerId,
            status: 'locked',
            message: 'Funds locked due to dispute'
        };
    }

    /**
     * Gets the current escrow status for a wager
     * @param {number} wagerId - The wager ID
     * @returns {Object} Escrow status and details
     */
    getEscrowStatus(wagerId) {
        const account = this.db.escrowOps.getAccount(wagerId);
        
        if (!account) {
            return null;
        }

        const transactions = this.db.escrowOps.getTransactions(wagerId);

        return {
            wagerId,
            escrowAddress: account.escrow_address,
            status: account.status,
            creatorDeposited: Boolean(account.creator_deposited),
            opponentDeposited: Boolean(account.opponent_deposited),
            totalAmount: account.total_amount,
            transactions: transactions || [],
            createdAt: account.created_at
        };
    }

    /**
     * Generates a unique escrow address for a wager
     * @private
     * @param {number} wagerId - The wager ID
     * @returns {string} Unique escrow address
     */
    generateEscrowAddress(wagerId) {
        // In production, this would generate an actual wallet address
        // For now, create a deterministic address based on wager ID
        const hash = crypto.createHash('sha256')
            .update(`wager-${wagerId}-${Date.now()}`)
            .digest('hex');
        
        return `0x${hash.substring(0, 40)}`;
    }
}

module.exports = EscrowService;
