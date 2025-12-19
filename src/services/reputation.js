const { reputationOps } = require('./database');

// Reputation event definitions
const REPUTATION_EVENTS = {
    WAGER_COMPLETE: { points: 2, description: 'Completed wager' },
    NO_SHOW: { points: -10, description: 'No-show (didn\'t ready up)' },
    FALSE_WIN_CLAIM: { points: -25, description: 'False win claim' },
    DISPUTE_WON: { points: 5, description: 'Won dispute' },
    DISPUTE_LOST: { points: -15, description: 'Lost dispute' },
    CONFIRM_QUICK: { points: 1, description: 'Quick confirmation (good sport)' }
};

class ReputationService {
    /**
     * Add reputation event for a user
     */
    addEvent(discordId, eventType, wagerId = null) {
        const event = REPUTATION_EVENTS[eventType];
        if (!event) {
            throw new Error(`Unknown reputation event type: ${eventType}`);
        }

        return reputationOps.addEvent(
            discordId,
            eventType,
            event.points,
            wagerId,
            event.description
        );
    }

    /**
     * Get user's reputation
     */
    getReputation(discordId) {
        return reputationOps.get(discordId);
    }

    /**
     * Get reputation events for a user
     */
    getEvents(discordId, limit = 10) {
        return reputationOps.getEvents(discordId, limit);
    }

    /**
     * Check if user can create wagers
     */
    canCreateWager(discordId) {
        return reputationOps.canCreateWager(discordId);
    }

    /**
     * Check if user can participate in wagers
     */
    canWager(discordId) {
        return reputationOps.canWager(discordId);
    }

    /**
     * Get warning message for user's reputation
     */
    getWarning(discordId) {
        return reputationOps.getWarning(discordId);
    }

    /**
     * Penalize user for bad behavior
     */
    penalize(discordId, eventType, wagerId = null) {
        return this.addEvent(discordId, eventType, wagerId);
    }

    /**
     * Reward user for good behavior
     */
    reward(discordId, eventType, wagerId = null) {
        return this.addEvent(discordId, eventType, wagerId);
    }
}

module.exports = { ReputationService, REPUTATION_EVENTS };
