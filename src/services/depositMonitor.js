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

        // Get transaction history for this address
        // Note: This is a simplified approach. In production, you might want to use
        // event logs or a more efficient method like tracking specific blocks
        const balance = await this.provider.getBalance(address);
        
        // If balance is greater than 0 and we haven't processed it yet
        if (balance > 0n) {
            // Get transaction history
            // For simplicity, we'll check if there's a balance and if it's new
            const balanceEth = parseFloat(ethers.formatEther(balance));
            
            // Check if this is a new deposit (balance changed since last check)
            if (lastCheckedBlock < currentBlock) {
                // Get transactions for this address
                // Note: ethers.js doesn't provide a direct way to get transaction history
                // In production, you'd use Etherscan API or similar service
                await this.processNewBalance(wallet, balanceEth, currentBlock);
            }
        }

        // Update last checked block
        const updateStmt = db.prepare('UPDATE user_wallets SET last_checked_block = ? WHERE discord_id = ?');
        updateStmt.run(currentBlock, wallet.discord_id);
    }

    /**
     * Process a new balance for a wallet
     * @param {Object} wallet - Wallet database record
     * @param {number} balanceEth - Current balance in ETH
     * @param {number} blockNumber - Block number of the transaction
     */
    async processNewBalance(wallet, balanceEth, blockNumber) {
        // Check minimum deposit
        if (balanceEth < this.minDepositEth) {
            console.log(`⚠️  Balance ${balanceEth} ETH for ${wallet.discord_id} below minimum`);
            return;
        }

        // Check if we've already processed this deposit
        const existingTx = db.prepare(`
            SELECT * FROM wallet_transactions 
            WHERE discord_id = ? AND type = 'deposit' AND amount = ?
            ORDER BY created_at DESC LIMIT 1
        `).get(wallet.discord_id, balanceEth);

        if (existingTx) {
            // Already processed this amount
            return;
        }

        // Generate a pseudo tx hash for tracking (in production, get real tx hash)
        const txHash = `0x${Date.now().toString(16)}${wallet.discord_id.slice(0, 16)}`;

        console.log(`💰 New deposit detected: ${balanceEth} ETH for user ${wallet.discord_id}`);

        // Credit the user's balance
        try {
            walletOps.addFunds(wallet.discord_id, balanceEth, txHash, `Deposit of ${balanceEth} ETH`);
            
            // Notify user via DM
            await this.notifyUserOfDeposit(wallet.discord_id, balanceEth, txHash);
            
            console.log(`✅ Credited ${balanceEth} ETH to ${wallet.discord_id}`);
        } catch (error) {
            console.error(`❌ Failed to credit deposit for ${wallet.discord_id}:`, error.message);
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
