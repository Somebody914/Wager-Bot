const { wagerOps, walletOps } = require('./database');
const { ReputationService } = require('./reputation');
const { calculatePayout } = require('../utils/constants');

const reputationService = new ReputationService();

class SchedulerService {
    constructor(client) {
        this.client = client;
        this.intervals = [];
    }

    /**
     * Start all scheduled tasks
     */
    start() {
        console.log('✅ Starting scheduler service...');

        // Check for expired ready checks every minute
        const readyCheckInterval = setInterval(() => {
            this.processExpiredReadyChecks();
        }, 60000); // 60 seconds
        this.intervals.push(readyCheckInterval);

        // Check for expired confirmations every minute
        const confirmationInterval = setInterval(() => {
            this.processExpiredConfirmations();
        }, 60000); // 60 seconds
        this.intervals.push(confirmationInterval);

        console.log('✅ Scheduler service started');
    }

    /**
     * Stop all scheduled tasks
     */
    stop() {
        console.log('Stopping scheduler service...');
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    /**
     * Process wagers with expired ready check deadlines
     */
    async processExpiredReadyChecks() {
        try {
            const expiredWagers = wagerOps.getExpiredReadyChecks();

            for (const wager of expiredWagers) {
                console.log(`Processing expired ready check for wager #${wager.id}`);

                // Determine who didn't ready up
                const noShowId = !wager.creator_ready ? wager.creator_id : wager.opponent_id;
                const showedUpId = wager.creator_ready ? wager.creator_id : wager.opponent_id;

                // Refund both players
                try {
                    walletOps.releaseFunds(wager.creator_id, wager.amount, wager.id, 'Wager cancelled - no show');
                    if (wager.opponent_id) {
                        walletOps.releaseFunds(wager.opponent_id, wager.amount, wager.id, 'Wager cancelled - no show');
                    }
                } catch (error) {
                    console.error('Error releasing funds for expired ready check:', error);
                }

                // Penalize no-show user
                try {
                    reputationService.penalize(noShowId, 'NO_SHOW', wager.id);
                } catch (error) {
                    console.error('Error penalizing no-show user:', error);
                }

                // Cancel wager
                wagerOps.updateStatus(wager.id, 'cancelled');

                // Notify users
                await this.notifyNoShow(wager, noShowId, showedUpId);
            }
        } catch (error) {
            console.error('Error processing expired ready checks:', error);
        }
    }

    /**
     * Process wagers with expired confirmation deadlines
     */
    async processExpiredConfirmations() {
        try {
            const expiredWagers = wagerOps.getExpiredConfirmations();

            for (const wager of expiredWagers) {
                console.log(`Processing expired confirmation for wager #${wager.id}`);

                // Auto-complete: submitter wins (opponent didn't respond)
                const winnerId = wager.submitted_by;
                const loserId = wager.creator_id === winnerId ? wager.opponent_id : wager.creator_id;

                // Complete the wager
                wagerOps.complete(wager.id, winnerId);

                // Process funds
                try {
                    const payout = calculatePayout(wager.amount);
                    
                    // Winner gets payout (their held funds are released and they get the winnings)
                    walletOps.loseFunds(winnerId, wager.amount, wager.id, 'Wager entry');
                    walletOps.winFunds(winnerId, payout, wager.id, 'Wager won (auto-confirmed)');
                    
                    // Loser just loses their held funds
                    walletOps.loseFunds(loserId, wager.amount, wager.id, 'Wager lost (timeout)');
                } catch (error) {
                    console.error('Error processing funds for auto-completion:', error);
                }

                // Update reputation
                try {
                    reputationService.reward(winnerId, 'WAGER_COMPLETE', wager.id);
                    reputationService.reward(loserId, 'WAGER_COMPLETE', wager.id);
                } catch (error) {
                    console.error('Error updating reputation:', error);
                }

                // Notify users
                await this.notifyAutoComplete(wager, winnerId, loserId);
            }
        } catch (error) {
            console.error('Error processing expired confirmations:', error);
        }
    }

    /**
     * Notify users about no-show cancellation
     */
    async notifyNoShow(wager, noShowId, showedUpId) {
        try {
            // Notify the no-show user
            const noShowUser = await this.client.users.fetch(noShowId);
            await noShowUser.send(
                `⚠️ **Wager #${wager.id} Cancelled - No Show**\n\n` +
                `You failed to ready up within 15 minutes.\n` +
                `Your funds have been refunded, but you've lost 10 reputation points.\n\n` +
                `⚠️ Please ready up promptly to avoid penalties.`
            ).catch(err => console.error('Could not DM no-show user:', err));

            // Notify the user who showed up
            if (showedUpId) {
                const showedUpUser = await this.client.users.fetch(showedUpId);
                await showedUpUser.send(
                    `✅ **Wager #${wager.id} Cancelled**\n\n` +
                    `Your opponent failed to ready up.\n` +
                    `Your funds have been refunded.\n\n` +
                    `Sorry for the inconvenience!`
                ).catch(err => console.error('Could not DM showed-up user:', err));
            }
        } catch (error) {
            console.error('Error sending no-show notifications:', error);
        }
    }

    /**
     * Notify users about auto-completion
     */
    async notifyAutoComplete(wager, winnerId, loserId) {
        try {
            const payout = calculatePayout(wager.amount).toFixed(4);

            // Notify winner
            const winner = await this.client.users.fetch(winnerId);
            await winner.send(
                `✅ **Wager #${wager.id} Auto-Completed**\n\n` +
                `Your opponent didn't respond within 30 minutes.\n` +
                `You've been awarded the win!\n\n` +
                `**Payout:** ${payout} ETH\n\n` +
                `GG!`
            ).catch(err => console.error('Could not DM winner:', err));

            // Notify loser
            const loser = await this.client.users.fetch(loserId);
            await loser.send(
                `⚠️ **Wager #${wager.id} Auto-Completed**\n\n` +
                `You failed to confirm or dispute the result within 30 minutes.\n` +
                `The wager has been completed in favor of your opponent.\n\n` +
                `**Lost:** ${wager.amount} ETH\n\n` +
                `⚠️ Please respond to result submissions promptly.`
            ).catch(err => console.error('Could not DM loser:', err));
        } catch (error) {
            console.error('Error sending auto-completion notifications:', error);
        }
    }
}

module.exports = SchedulerService;
