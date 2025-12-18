// Supported games for wagers
const GAMES = {
    VALORANT: 'Valorant',
    LOL: 'League of Legends',
    CS2: 'CS2',
    ROCKET_LEAGUE: 'Rocket League',
    FORTNITE: 'Fortnite',
    APEX: 'Apex Legends',
    R6: 'Rainbow Six Siege'
};

const GAME_CHOICES = [
    { name: 'Valorant', value: 'valorant' },
    { name: 'League of Legends', value: 'lol' },
    { name: 'CS2 (Counter-Strike 2)', value: 'cs2' },
    { name: 'Rocket League', value: 'rocket_league' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Apex Legends', value: 'apex' },
    { name: 'Rainbow Six Siege', value: 'r6' }
];

// Team sizes per game
const TEAM_SIZES = {
    valorant: [5],
    lol: [5],
    cs2: [5],
    rocket_league: [1, 2, 3],
    fortnite: [1, 2, 4],
    apex: [3],
    r6: [5]
};

// Wager types
const WAGER_TYPES = {
    SOLO: 'solo',
    TEAM: 'team',
    LFT: 'lft' // Looking for teammates
};

// Match types
const MATCH_TYPES = {
    RANKED: 'ranked',
    COMPETITIVE: 'competitive',
    CUSTOM: 'custom',
    CREATIVE: 'creative'
};

const MATCH_TYPE_CHOICES = [
    { name: 'Ranked/Competitive (API Verified)', value: 'ranked' },
    { name: 'Competitive Match', value: 'competitive' },
    { name: 'Custom/Private Match (Requires Proof)', value: 'custom' },
    { name: 'Creative Mode (Requires Proof)', value: 'creative' }
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

// URL validation helpers
function isValidProofUrl(url) {
    if (!url) return false;
    
    // Discord CDN attachments
    if (url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net')) {
        return true;
    }
    
    // Imgur
    if (url.match(/^https?:\/\/(i\.)?imgur\.com\//)) {
        return true;
    }
    
    // YouTube
    if (url.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)) {
        return true;
    }
    
    // Streamable
    if (url.match(/^https?:\/\/(www\.)?streamable\.com\//)) {
        return true;
    }
    
    return false;
}

// Payout calculation helper
function calculatePayout(amount) {
    return amount * 2 * (1 - PLATFORM_FEE);
}

function calculateFee(amount) {
    return amount * PLATFORM_FEE;
}

module.exports = {
    GAMES,
    GAME_CHOICES,
    TEAM_SIZES,
    WAGER_TYPES,
    MATCH_TYPES,
    MATCH_TYPE_CHOICES,
    WAGER_STATUS,
    PLATFORM_FEE,
    COLORS,
    isValidProofUrl,
    calculatePayout,
    calculateFee
};
