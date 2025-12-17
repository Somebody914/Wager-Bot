// Supported games for wagers
const GAMES = {
    VALORANT: 'Valorant',
    LOL: 'League of Legends',
    CS2: 'CS2',
    ROCKET_LEAGUE: 'Rocket League',
    FORTNITE: 'Fortnite',
    APEX: 'Apex Legends'
};

const GAME_CHOICES = [
    { name: 'Valorant', value: 'valorant' },
    { name: 'League of Legends', value: 'lol' },
    { name: 'CS2 (Counter-Strike 2)', value: 'cs2' },
    { name: 'Rocket League', value: 'rocket_league' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Apex Legends', value: 'apex' }
];

// Wager statuses
const WAGER_STATUS = {
    OPEN: 'open',
    ACCEPTED: 'accepted',
    IN_PROGRESS: 'in_progress',
    PENDING_VERIFICATION: 'pending_verification',
    DISPUTED: 'disputed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Platform fee percentage
const PLATFORM_FEE = 0.03; // 3%

// Color codes for embeds
const COLORS = {
    PRIMARY: 0x5865F2,
    SUCCESS: 0x57F287,
    WARNING: 0xFEE75C,
    ERROR: 0xED4245,
    INFO: 0x5865F2
};

module.exports = {
    GAMES,
    GAME_CHOICES,
    WAGER_STATUS,
    PLATFORM_FEE,
    COLORS
};
