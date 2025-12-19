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

// Game modes with team sizes
const GAME_MODES = {
    fortnite: {
        name: 'Fortnite',
        modes: [
            { id: 'boxfight_1v1', name: 'Box Fight 1v1', teamSize: 1 },
            { id: 'boxfight_2v2', name: 'Box Fight 2v2', teamSize: 2 },
            { id: 'boxfight_3v3', name: 'Box Fight 3v3', teamSize: 3 },
            { id: 'boxfight_4v4', name: 'Box Fight 4v4', teamSize: 4 },
            { id: 'zonewars_1v1', name: 'Zone Wars 1v1', teamSize: 1 },
            { id: 'zonewars_2v2', name: 'Zone Wars 2v2', teamSize: 2 },
            { id: 'zonewars_3v3', name: 'Zone Wars 3v3', teamSize: 3 },
            { id: 'zonewars_4v4', name: 'Zone Wars 4v4', teamSize: 4 },
            { id: 'buildfight_1v1', name: 'Build Fight 1v1', teamSize: 1 },
            { id: 'realistics_1v1', name: 'Realistics 1v1', teamSize: 1 },
            { id: 'realistics_2v2', name: 'Realistics 2v2', teamSize: 2 },
            { id: 'killrace', name: 'Kill Race', teamSize: 1 }
        ]
    },
    rocket_league: {
        name: 'Rocket League',
        modes: [
            { id: 'duel_1v1', name: '1v1 Duel', teamSize: 1 },
            { id: 'doubles_2v2', name: '2v2 Doubles', teamSize: 2 },
            { id: 'standard_3v3', name: '3v3 Standard', teamSize: 3 },
            { id: 'chaos_4v4', name: '4v4 Chaos', teamSize: 4 }
        ]
    },
    valorant: {
        name: 'Valorant',
        modes: [
            { id: 'competitive_5v5', name: '5v5 Competitive', teamSize: 5 },
            { id: 'custom_1v1', name: '1v1 Custom', teamSize: 1 }
        ]
    },
    cs2: {
        name: 'CS2',
        modes: [
            { id: 'competitive_5v5', name: '5v5 Competitive', teamSize: 5 },
            { id: 'wingman_2v2', name: '2v2 Wingman', teamSize: 2 },
            { id: 'aim_1v1', name: '1v1 Aim Map', teamSize: 1 }
        ]
    },
    lol: {
        name: 'League of Legends',
        modes: [
            { id: 'ranked_5v5', name: '5v5 Ranked', teamSize: 5 },
            { id: 'custom_1v1', name: '1v1 Custom', teamSize: 1 }
        ]
    },
    apex: {
        name: 'Apex Legends',
        modes: [
            { id: 'trios', name: 'Trios', teamSize: 3 },
            { id: 'duos', name: 'Duos', teamSize: 2 },
            { id: 'arenas_3v3', name: '3v3 Arenas', teamSize: 3 }
        ]
    },
    r6: {
        name: 'Rainbow Six Siege',
        modes: [
            { id: 'ranked_5v5', name: '5v5 Ranked', teamSize: 5 }
        ]
    }
};

const GAME_CHOICES = Object.entries(GAME_MODES).map(([value, data]) => ({
    name: data.name,
    value: value
}));

// Team sizes per game (legacy support)
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

// Escrow statuses
const ESCROW_STATUS = {
    AWAITING_DEPOSITS: 'awaiting_deposits',
    FUNDED: 'funded',
    LOCKED: 'locked',
    RELEASED: 'released',
    REFUNDED: 'refunded'
};

// Transaction types
const TRANSACTION_TYPES = {
    DEPOSIT: 'deposit',
    RELEASE: 'release',
    REFUND: 'refund'
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
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Discord CDN attachments - must be exact hostname match
        if (hostname === 'cdn.discordapp.com' || hostname === 'media.discordapp.net') {
            return true;
        }
        
        // Imgur - exact hostname match
        if (hostname === 'imgur.com' || hostname === 'i.imgur.com') {
            return true;
        }
        
        // YouTube - exact hostname match
        if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtu.be') {
            return true;
        }
        
        // Streamable - exact hostname match
        if (hostname === 'streamable.com' || hostname === 'www.streamable.com') {
            return true;
        }
        
        return false;
    } catch (error) {
        // Invalid URL format
        return false;
    }
}

// Payout calculation helper
function calculatePayout(amount) {
    return amount * 2 * (1 - PLATFORM_FEE);
}

function calculateFee(amount) {
    return amount * PLATFORM_FEE;
}

// Helper to get mode choices for a game
function getModeChoices(game) {
    return GAME_MODES[game]?.modes.map(mode => ({
        name: mode.name,
        value: mode.id
    })) || [];
}

// Helper to get team size for a mode
function getTeamSizeForMode(game, modeId) {
    const mode = GAME_MODES[game]?.modes.find(m => m.id === modeId);
    return mode?.teamSize || 1;
}

// Helper to get mode name
function getModeName(game, modeId) {
    const mode = GAME_MODES[game]?.modes.find(m => m.id === modeId);
    return mode?.name || modeId;
}

// Verification methods for each game
const VERIFICATION_METHODS = {
    fortnite: [
        { id: 'match', name: 'Play a Match (Easiest)', description: 'Play 1 match of any mode, we detect automatically' },
        { id: 'tracker', name: 'Tracker Link', description: 'Paste your fortnite tracker profile link' },
        { id: 'screenshot', name: 'Screenshot', description: 'Screenshot lobby with verification code' }
    ],
    rocket_league: [
        { id: 'tracker', name: 'Tracker Link (Easiest)', description: 'Paste your RL tracker profile link' },
        { id: 'match', name: 'Play a Match', description: 'Play 1 match, we detect via tracker' },
        { id: 'steam', name: 'Steam Profile', description: 'Link your public Steam profile' }
    ],
    valorant: [
        { id: 'riot_auth', name: 'Riot Sign-In (Easiest)', description: 'One-click Riot account login' },
        { id: 'match', name: 'Play a Match', description: 'Play 1 match for API verification' },
        { id: 'tracker', name: 'Tracker Link', description: 'Paste your tracker.gg/valorant link' }
    ],
    cs2: [
        { id: 'steam', name: 'Steam Profile (Easiest)', description: 'Paste your Steam profile URL' },
        { id: 'tracker', name: 'Tracker Link', description: 'Paste your tracker.gg/cs2 link' }
    ],
    lol: [
        { id: 'riot_auth', name: 'Riot Sign-In (Easiest)', description: 'One-click Riot account login' },
        { id: 'tracker', name: 'Tracker Link', description: 'Paste your tracker link' }
    ],
    apex: [
        { id: 'tracker', name: 'Tracker Link (Easiest)', description: 'Paste your Apex tracker link' },
        { id: 'screenshot', name: 'Screenshot', description: 'Screenshot with verification code' }
    ],
    r6: [
        { id: 'tracker', name: 'Tracker Link (Easiest)', description: 'Paste your R6 tracker link' },
        { id: 'uplay', name: 'Uplay Profile', description: 'Link your Uplay profile' }
    ]
};

module.exports = {
    GAMES,
    GAME_MODES,
    GAME_CHOICES,
    TEAM_SIZES,
    WAGER_TYPES,
    MATCH_TYPES,
    MATCH_TYPE_CHOICES,
    WAGER_STATUS,
    ESCROW_STATUS,
    TRANSACTION_TYPES,
    PLATFORM_FEE,
    COLORS,
    VERIFICATION_METHODS,
    isValidProofUrl,
    calculatePayout,
    calculateFee,
    getModeChoices,
    getTeamSizeForMode,
    getModeName
};
