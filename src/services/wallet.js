const crypto = require('crypto');
const { ethers } = require('ethers');
const { walletOps, userOps, db } = require('./database');
const { PLATFORM_FEE } = require('../utils/constants');

/**
 * WalletService - Manages user wallet operations
 * Implements real Ethereum HD wallet generation and blockchain transactions
 */
class WalletService {
    constructor() {
        // Initialize Ethereum provider
        const rpcUrl = process.env.ETHEREUM_RPC_URL;
        if (!rpcUrl) {
            console.warn('⚠️  ETHEREUM_RPC_URL not set. Wallet operations will be limited.');
            this.provider = null;
        } else {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        }

        // Initialize HD wallet from mnemonic
        const mnemonic = process.env.HD_WALLET_MNEMONIC;
        if (!mnemonic) {
            console.warn('⚠️  HD_WALLET_MNEMONIC not set. Using fallback address generation.');
            this.hdNode = null;
        } else {
            try {
                this.hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
            } catch (error) {
                console.error('❌ Invalid HD_WALLET_MNEMONIC:', error.message);
                this.hdNode = null;
            }
        }

        // Initialize master wallet for withdrawals
        const masterKey = process.env.MASTER_WALLET_PRIVATE_KEY;
        if (!masterKey || !this.provider) {
            console.warn('⚠️  Master wallet not configured. Withdrawals will not work.');
            this.masterWallet = null;
        } else {
            try {
                this.masterWallet = new ethers.Wallet(masterKey, this.provider);
                // Log only first and last 6 chars for security
                const addrShort = `${this.masterWallet.address.slice(0, 6)}...${this.masterWallet.address.slice(-4)}`;
                console.log(`✅ Master wallet initialized: ${addrShort}`);
            } catch (error) {
                console.error('❌ Invalid MASTER_WALLET_PRIVATE_KEY:', error.message);
                this.masterWallet = null;
            }
        }
    }

    /**
     * Generate unique deposit address for user using BIP44 HD derivation
     * @param {string} discordId - Discord user ID
     * @param {number} derivationIndex - Unique index for this user
     * @returns {string} Real Ethereum deposit address
     */
    generateDepositAddress(discordId, derivationIndex) {
        if (!this.hdNode) {
            // Fallback to deterministic fake addresses for development
            console.warn('⚠️  Using fallback address generation (not real addresses)');
            const hash = crypto.createHash('sha256')
                .update(`${discordId}-${derivationIndex}`)
                .digest('hex');
            return `0x${hash.substring(0, 40)}`;
        }

        // Use BIP44 derivation path: m/44'/60'/0'/0/{index}
        // 60 is the coin type for Ethereum
        // Since HDNodeWallet.fromPhrase creates at m/44'/60'/0'/0, we derive relative path
        const childWallet = this.hdNode.deriveChild(derivationIndex);
        
        // Log without exposing user ID for privacy
        const addrShort = `${childWallet.address.slice(0, 6)}...${childWallet.address.slice(-4)}`;
        console.log(`✅ Generated real deposit address (index ${derivationIndex}): ${addrShort}`);
        return childWallet.address;
    }

    /**
     * Get the private key for a user's deposit address (needed for advanced operations)
     * SECURITY: This should only be used internally and never exposed
     * @param {number} derivationIndex - User's derivation index
     * @returns {string|null} Private key or null if not available
     */
    _getPrivateKeyForIndex(derivationIndex) {
        if (!this.hdNode) {
            return null;
        }
        const childWallet = this.hdNode.deriveChild(derivationIndex);
        return childWallet.privateKey;
    }

    /**
     * Get or create wallet for user
     * @param {string} discordId - Discord user ID
     * @returns {Object} Wallet info
     */
    getOrCreateWallet(discordId) {
        let wallet = walletOps.get(discordId);
        
        if (!wallet) {
            // Get next available derivation index
            const derivationIndex = this._getNextDerivationIndex();
            
            // Create new wallet with real address
            const depositAddress = this.generateDepositAddress(discordId, derivationIndex);
            
            // Store wallet with derivation index
            const stmt = db.prepare(`
                INSERT INTO user_wallets (discord_id, deposit_address, derivation_index) 
                VALUES (?, ?, ?)
            `);
            stmt.run(discordId, depositAddress, derivationIndex);
            
            wallet = walletOps.get(discordId);
        }
        
        return wallet;
    }

    /**
     * Get next available derivation index
     * @returns {number} Next derivation index
     */
    _getNextDerivationIndex() {
        const stmt = db.prepare('SELECT MAX(derivation_index) as max_index FROM user_wallets');
        const result = stmt.get();
        return (result.max_index || -1) + 1;
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
     * Withdraw funds from wallet - executes real blockchain transaction
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Amount to withdraw in ETH
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

        // Validate destination address
        if (!ethers.isAddress(toAddress)) {
            throw new Error('Invalid destination address');
        }

        // Check if master wallet is configured
        if (!this.masterWallet) {
            throw new Error('Withdrawal system not configured. Please contact administrator.');
        }

        try {
            // Check master wallet balance
            const masterBalance = await this.masterWallet.provider.getBalance(this.masterWallet.address);
            const amountWei = ethers.parseEther(amount.toString());
            
            // Estimate gas for the transaction
            const gasEstimate = 21000n; // Standard ETH transfer
            const feeData = await this.masterWallet.provider.getFeeData();
            const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
            
            // Check max gas price limit
            const maxGasPriceGwei = BigInt(process.env.MAX_GAS_PRICE_GWEI || '100');
            const maxGasPriceWei = maxGasPriceGwei * 1000000000n;
            
            // Handle both EIP-1559 and legacy gas pricing
            const effectiveGasPrice = maxFeePerGas || feeData.gasPrice;
            if (!effectiveGasPrice) {
                throw new Error('Unable to estimate gas price. Try again later.');
            }
            
            if (effectiveGasPrice > maxGasPriceWei) {
                throw new Error(`Gas price too high (${ethers.formatUnits(effectiveGasPrice, 'gwei')} gwei). Try again later.`);
            }
            
            const estimatedGasCost = gasEstimate * effectiveGasPrice;
            
            const totalRequired = amountWei + estimatedGasCost;

            if (masterBalance < totalRequired) {
                throw new Error('Hot wallet has insufficient funds. Please contact administrator.');
            }

            // Execute the withdrawal transaction
            console.log(`💸 Executing withdrawal: ${amount} ETH to ${toAddress}`);
            const tx = await this.masterWallet.sendTransaction({
                to: toAddress,
                value: amountWei,
                gasLimit: gasEstimate
            });

            console.log(`✅ Withdrawal transaction sent: ${tx.hash}`);

            // Update database with pending transaction
            walletOps.withdraw(discordId, amount, tx.hash, `Withdrawal of ${amount} ETH to ${toAddress}`);
            
            return {
                success: true,
                amount,
                toAddress,
                txHash: tx.hash,
                status: 'pending'
            };
        } catch (error) {
            console.error('❌ Withdrawal failed:', error);
            throw new Error(`Failed to withdraw funds: ${error.message}`);
        }
    }

    /**
     * Get master wallet balance
     * @returns {Promise<string>} Balance in ETH
     */
    async getMasterWalletBalance() {
        if (!this.masterWallet) {
            return '0.0';
        }
        try {
            const balance = await this.masterWallet.provider.getBalance(this.masterWallet.address);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Error fetching master wallet balance:', error);
            return '0.0';
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
