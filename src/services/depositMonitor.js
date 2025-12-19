const { ethers } = require('ethers');
const { walletOps, db } = require('./database');

/**
 * DepositMonitorService - Monitors Ethereum blockchain for incoming deposits
 * Checks user deposit addresses for new transactions and credits balances
 */
class DepositMonitorService {
    constructor(client) {
        this.client = client;
        this.provider = null;
        this.isRunning = false;
        this.checkInterval = parseInt(process.env.DEPOSIT_CHECK_INTERVAL_MS || '60000');
        this.requiredConfirmations = parseInt(process.env.REQUIRED_CONFIRMATIONS || '12');
        this.minDepositEth = parseFloat(process.env.MIN_DEPOSIT_ETH || '0.001');
        this.intervalId = null;

        // Initialize provider
        const rpcUrl = process.env.ETHEREUM_RPC_URL;
        if (!rpcUrl) {
            console.warn('⚠️  ETHEREUM_RPC_URL not set. Deposit monitoring disabled.');
            return;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            console.log('✅ Deposit monitor provider initialized');
        } catch (error) {
            console.error('❌ Failed to initialize deposit monitor provider:', error.message);
        }
    }

    /**
     * Start the deposit monitoring service
     */
    start() {
        if (!this.provider) {
            console.log('⚠️  Deposit monitoring not started (provider not available)');
            return;
        }

        if (this.isRunning) {
            console.log('⚠️  Deposit monitor already running');
            return;
        }

        console.log(`🔍 Starting deposit monitor (checking every ${this.checkInterval/1000}s)`);
        this.isRunning = true;

        // Run initial check
        this.checkDeposits().catch(error => {
            console.error('Error in initial deposit check:', error);
        });

        // Set up periodic checking
        this.intervalId = setInterval(() => {
            this.checkDeposits().catch(error => {
                console.error('Error in deposit check:', error);
            });
        }, this.checkInterval);
    }

    /**
     * Stop the deposit monitoring service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Deposit monitor stopped');
    }

    /**
     * Check all user deposit addresses for new transactions
     */
    async checkDeposits() {
        try {
            // Get current block number
            const currentBlock = await this.provider.getBlockNumber();
            
            // Get all wallets
            const stmt = db.prepare('SELECT * FROM user_wallets');
            const wallets = stmt.all();

            console.log(`🔍 Checking deposits for ${wallets.length} wallets (current block: ${currentBlock})`);

            for (const wallet of wallets) {
                try {
                    await this.checkWalletDeposits(wallet, currentBlock);
                } catch (error) {
                    console.error(`Error checking deposits for ${wallet.discord_id}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error in checkDeposits:', error);
        }
    }

    /**
     * Check deposits for a specific wallet
     * @param {Object} wallet - Wallet database record
     * @param {number} currentBlock - Current blockchain block number
     */
    async checkWalletDeposits(wallet, currentBlock) {
        const address = wallet.deposit_address;
        const lastCheckedBlock = wallet.last_checked_block || 0;

        // Skip if we're already up to date
        if (lastCheckedBlock >= currentBlock - this.requiredConfirmations) {
            return;
        }

        try {
            // Get current balance
            const balance = await this.provider.getBalance(address);
            const balanceEth = parseFloat(ethers.formatEther(balance));
            
            // If balance is greater than minimum deposit
            if (balanceEth >= this.minDepositEth) {
                // Check if we need to scan for new transactions
                // In a real implementation, you would:
                // 1. Use Etherscan API or similar to get transaction history
                // 2. Filter transactions from lastCheckedBlock to currentBlock
                // 3. Process each incoming transaction
                
                // For now, we'll use a simpler approach: check if balance increased
                const startBlock = Math.max(0, lastCheckedBlock);
                const endBlock = currentBlock - this.requiredConfirmations;
                
                if (endBlock > startBlock) {
                    // Scan for transactions in this block range
                    await this.scanBlockRange(wallet, address, startBlock, endBlock, balanceEth);
                }
            }
        } catch (error) {
            console.error(`Error checking wallet ${address}:`, error.message);
        }

        // Update last checked block (with confirmations buffer)
        const updateStmt = db.prepare('UPDATE user_wallets SET last_checked_block = ? WHERE discord_id = ?');
        updateStmt.run(currentBlock - this.requiredConfirmations, wallet.discord_id);
    }

    /**
     * Scan a block range for transactions to a specific address
     * Note: This is a basic implementation. In production, use Etherscan API or similar
     * @param {Object} wallet - Wallet database record
     * @param {string} address - Ethereum address to monitor
     * @param {number} startBlock - Start block number
     * @param {number} endBlock - End block number
     * @param {number} currentBalance - Current balance in ETH
     */
    async scanBlockRange(wallet, address, startBlock, endBlock, currentBalance) {
        // This is a simplified implementation
        // In production, you should use Etherscan API or run your own archive node
        // to efficiently get transaction history
        
        // Calculate expected balance from transaction history
        // This accounts for deposits and withdrawals, but not funds in wagers or fees
        const stmt = db.prepare(`
            SELECT SUM(amount) as total_deposited 
            FROM wallet_transactions 
            WHERE discord_id = ? AND type = 'deposit'
        `).get(wallet.discord_id);
        
        const knownDeposits = stmt?.total_deposited || 0;
        
        // Calculate expected on-chain balance (deposits minus withdrawals)
        // Note: held_balance is stored in the bot's tracking, not on-chain
        const expectedBalance = knownDeposits - (wallet.total_withdrawn || 0);
        
        // If current balance is higher than expected, there's a new deposit
        // Using a small tolerance for floating point comparison
        const tolerance = 0.000001; // 1 gwei tolerance
        if (currentBalance > expectedBalance + tolerance && currentBalance >= this.minDepositEth) {
            const newDepositAmount = currentBalance - expectedBalance;
            
            // Only process if the new amount is significant (above minimum)
            if (newDepositAmount >= this.minDepositEth) {
                await this.processNewDeposit(wallet, newDepositAmount, endBlock, address);
            }
        }
    }

    /**
     * Process a newly detected deposit
     * @param {Object} wallet - Wallet database record
     * @param {number} amount - Deposit amount in ETH
     * @param {number} blockNumber - Block number where deposit was confirmed
     * @param {string} address - Deposit address
     */
    async processNewDeposit(wallet, amount, blockNumber, address) {
        // Convert to wei for precise comparison
        const { ethers } = require('ethers');
        const amountWei = ethers.parseEther(amount.toFixed(18));
        const tolerance = ethers.parseEther('0.0001'); // 0.0001 ETH tolerance
        
        // Check if we've already processed a similar deposit recently
        // Use wei-based comparison for precision
        const recentTx = db.prepare(`
            SELECT * FROM wallet_transactions 
            WHERE discord_id = ? AND type = 'deposit' 
            AND created_at > datetime('now', '-1 hour')
        `).all(wallet.discord_id);

        // Check if any recent transaction is within tolerance
        for (const tx of recentTx) {
            const txAmountWei = ethers.parseEther(tx.amount.toFixed(18));
            const diff = txAmountWei > amountWei ? txAmountWei - amountWei : amountWei - txAmountWei;
            if (diff < tolerance) {
                console.log(`⚠️  Similar deposit already processed (within tolerance)`);
                return;
            }
        }

        // Generate a transaction reference
        const txRef = `deposit_${blockNumber}_${address.slice(0, 10)}`;
        const addrShort = `${address.slice(0, 6)}...${address.slice(-4)}`;

        console.log(`💰 New deposit detected: ${amount.toFixed(4)} ETH to ${addrShort}`);

        try {
            // Credit the user's balance
            walletOps.addFunds(wallet.discord_id, amount, txRef, `Deposit of ${amount.toFixed(4)} ETH (Block ${blockNumber})`);
            
            // Notify user via DM
            await this.notifyUserOfDeposit(wallet.discord_id, amount, txRef);
            
            console.log(`✅ Credited ${amount.toFixed(4)} ETH to user`);
        } catch (error) {
            console.error(`❌ Failed to credit deposit:`, error.message);
        }
    }



    /**
     * Notify user of confirmed deposit via Discord DM
     * @param {string} discordId - Discord user ID
     * @param {number} amount - Deposit amount in ETH
     * @param {string} txHash - Transaction hash
     */
    async notifyUserOfDeposit(discordId, amount, txHash) {
        try {
            const user = await this.client.users.fetch(discordId);
            if (!user) {
                console.log(`⚠️  Could not find user ${discordId} to notify`);
                return;
            }

            const { EmbedBuilder } = require('discord.js');
            const { COLORS } = require('../utils/constants');

            const embed = new EmbedBuilder()
                .setTitle('✅ Deposit Confirmed')
                .setColor(COLORS.SUCCESS)
                .setDescription(`Your deposit has been confirmed and credited to your account!`)
                .addFields(
                    { name: '💰 Amount', value: `${amount.toFixed(4)} ETH`, inline: true },
                    { name: '🔗 Transaction', value: `\`${txHash}\``, inline: false },
                    { name: '✨ Status', value: 'Credited to your balance', inline: true }
                )
                .addFields({
                    name: '📊 Next Steps',
                    value: '• Use `/balance` to view your balance\n• Use `/wager create` to start wagering\n• Use `/withdraw` to cash out anytime',
                    inline: false
                })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            console.log(`✅ Sent deposit notification to ${discordId}`);
        } catch (error) {
            console.error(`Failed to send deposit notification to ${discordId}:`, error.message);
        }
    }

    /**
     * Manually check a specific address for deposits (admin/testing use)
     * @param {string} address - Ethereum address to check
     * @returns {Promise<Object>} Balance information
     */
    async checkAddress(address) {
        if (!this.provider) {
            throw new Error('Provider not initialized');
        }

        const balance = await this.provider.getBalance(address);
        const balanceEth = ethers.formatEther(balance);
        const blockNumber = await this.provider.getBlockNumber();

        return {
            address,
            balance: balanceEth,
            blockNumber
        };
    }
}

module.exports = DepositMonitorService;
