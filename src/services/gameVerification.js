const https = require('https');

/**
 * Game account verification service
 * Verifies gaming accounts using various game APIs
 */

// Cache for verified accounts to avoid repeated API calls
const verificationCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Make an HTTPS GET request
 */
function httpsGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Check cache for a verified account
 */
function getCachedVerification(platform, username) {
    const cacheKey = `${platform}:${username.toLowerCase()}`;
    const cached = verificationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    return null;
}

/**
 * Store verification result in cache
 */
function setCachedVerification(platform, username, data) {
    const cacheKey = `${platform}:${username.toLowerCase()}`;
    verificationCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Verify Riot Games account (Valorant & League of Legends)
 * Username format: name#tag
 */
async function verifyRiotAccount(username, region = 'americas') {
    const apiKey = process.env.RIOT_API_KEY;
    
    if (!apiKey) {
        return {
            success: false,
            error: 'Riot API key not configured. Contact server administrator.',
            verified: false
        };
    }
    
    // Check cache first
    const cached = getCachedVerification('riot', username);
    if (cached) {
        return cached;
    }
    
    try {
        // Parse Riot ID (name#tag)
        const parts = username.split('#');
        if (parts.length !== 2) {
            return {
                success: false,
                error: 'Invalid Riot ID format. Use: name#tag (e.g., Player#NA1)',
                verified: false
            };
        }
        
        const [gameName, tagLine] = parts;
        
        // Call Riot API to get account by Riot ID
        const encodedName = encodeURIComponent(gameName);
        const encodedTag = encodeURIComponent(tagLine);
        const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;
        
        const data = await httpsGet(url, {
            'X-Riot-Token': apiKey
        });
        
        if (data && data.puuid) {
            const result = {
                success: true,
                verified: true,
                platformId: data.puuid,
                displayName: `${data.gameName}#${data.tagLine}`
            };
            
            setCachedVerification('riot', username, result);
            return result;
        }
        
        return {
            success: false,
            error: 'Account not found',
            verified: false
        };
    } catch (error) {
        console.error('Riot API error:', error);
        
        if (error.message.includes('404')) {
            return {
                success: false,
                error: 'Account not found. Please check your Riot ID.',
                verified: false
            };
        }
        
        if (error.message.includes('403')) {
            return {
                success: false,
                error: 'Invalid API key. Contact server administrator.',
                verified: false
            };
        }
        
        return {
            success: false,
            error: 'Failed to verify account. Please try again later.',
            verified: false
        };
    }
}

/**
 * Verify Steam account (CS2)
 * Username can be Steam ID64 or custom URL
 */
async function verifySteamAccount(username) {
    const apiKey = process.env.STEAM_API_KEY;
    
    if (!apiKey) {
        return {
            success: false,
            error: 'Steam API key not configured. Contact server administrator.',
            verified: false
        };
    }
    
    // Check cache first
    const cached = getCachedVerification('steam', username);
    if (cached) {
        return cached;
    }
    
    try {
        // Steam ID64 is always 17 digits
        const STEAM_ID64_LENGTH = 17;
        let steamId = username;
        
        // If username is not a Steam ID64, try to resolve it
        const steamIdPattern = new RegExp(`^\\d{${STEAM_ID64_LENGTH}}$`);
        if (!steamIdPattern.test(username)) {
            // Resolve custom URL to Steam ID
            const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(username)}`;
            const resolveData = await httpsGet(resolveUrl);
            
            if (resolveData.response && resolveData.response.success === 1) {
                steamId = resolveData.response.steamid;
            } else {
                return {
                    success: false,
                    error: 'Steam account not found. Use Steam ID64 or custom URL.',
                    verified: false
                };
            }
        }
        
        // Get player summary
        const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
        const summaryData = await httpsGet(summaryUrl);
        
        if (summaryData.response && summaryData.response.players && summaryData.response.players.length > 0) {
            const player = summaryData.response.players[0];
            
            // Check if CS2 is owned (App ID: 730)
            const CS2_APP_ID = 730;
            const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&appids_filter=${CS2_APP_ID}`;
            let ownsCS2 = false;
            
            try {
                const gamesData = await httpsGet(ownedGamesUrl);
                ownsCS2 = gamesData.response && gamesData.response.game_count > 0;
            } catch (err) {
                // If we can't check owned games (private profile), still verify the account exists
                console.log('Could not check CS2 ownership (likely private profile)');
            }
            
            const result = {
                success: true,
                verified: true,
                platformId: steamId,
                displayName: player.personaname,
                ownsCS2
            };
            
            setCachedVerification('steam', username, result);
            return result;
        }
        
        return {
            success: false,
            error: 'Steam account not found',
            verified: false
        };
    } catch (error) {
        console.error('Steam API error:', error);
        return {
            success: false,
            error: 'Failed to verify Steam account. Please try again later.',
            verified: false
        };
    }
}

/**
 * Verify account using Tracker.gg API
 * Used for: Rocket League, Rainbow Six Siege, Fortnite, Apex Legends
 */
async function verifyTrackerAccount(game, username, platform = 'pc') {
    const apiKey = process.env.TRACKER_API_KEY;
    
    if (!apiKey) {
        return {
            success: false,
            error: 'Tracker API key not configured. Contact server administrator.',
            verified: false
        };
    }
    
    // Check cache first
    const cached = getCachedVerification(`tracker_${game}`, username);
    if (cached) {
        return cached;
    }
    
    try {
        // Map game names to Tracker.gg endpoints
        const gameEndpoints = {
            'rocket_league': 'rocket-league',
            'r6': 'rainbow-six',
            'fortnite': 'fortnite',
            'apex': 'apex'
        };
        
        const endpoint = gameEndpoints[game];
        if (!endpoint) {
            return {
                success: false,
                error: 'Unsupported game for tracker verification',
                verified: false
            };
        }
        
        // Build API URL
        const encodedUsername = encodeURIComponent(username);
        const url = `https://api.tracker.gg/api/v2/${endpoint}/standard/profile/${platform}/${encodedUsername}`;
        
        const data = await httpsGet(url, {
            'TRN-Api-Key': apiKey
        });
        
        if (data && data.data && data.data.platformInfo) {
            const platformInfo = data.data.platformInfo;
            
            const result = {
                success: true,
                verified: true,
                platformId: platformInfo.platformUserId || username,
                displayName: platformInfo.platformUserHandle || username
            };
            
            setCachedVerification(`tracker_${game}`, username, result);
            return result;
        }
        
        return {
            success: false,
            error: 'Account not found on Tracker.gg',
            verified: false
        };
    } catch (error) {
        console.error('Tracker API error:', error);
        
        if (error.message.includes('404')) {
            return {
                success: false,
                error: 'Account not found. Please check your username and platform.',
                verified: false
            };
        }
        
        return {
            success: false,
            error: 'Failed to verify account. Please try again later.',
            verified: false
        };
    }
}

/**
 * Verify game account based on platform
 */
async function verifyGameAccount(platform, username) {
    console.log(`Verifying account for ${platform}: ${username}`);
    
    switch (platform) {
        case 'valorant':
        case 'lol':
            return await verifyRiotAccount(username);
        
        case 'cs2':
            return await verifySteamAccount(username);
        
        case 'rocket_league':
        case 'r6':
        case 'fortnite':
        case 'apex':
            return await verifyTrackerAccount(platform, username);
        
        default:
            return {
                success: false,
                error: 'Verification not supported for this game yet',
                verified: false
            };
    }
}

/**
 * Verify a Valorant match result
 * @param {string} matchId - The match ID from Riot API
 * @param {string} puuid - Player's PUUID
 * @param {string} region - Region (americas, europe, asia)
 * @returns {Promise<Object>} Verification result with match details
 */
async function verifyValorantMatch(matchId, puuid, region = 'americas') {
    const apiKey = process.env.RIOT_API_KEY;
    
    if (!apiKey) {
        return {
            success: false,
            error: 'Riot API key not configured.',
            verified: false
        };
    }

    try {
        // Get match details
        const matchUrl = `https://${region}.api.riotgames.com/val/match/v1/matches/${matchId}`;
        const matchData = await httpsGet(matchUrl, {
            'X-Riot-Token': apiKey
        });

        if (!matchData || !matchData.players) {
            return {
                success: false,
                error: 'Match not found or invalid match ID.',
                verified: false
            };
        }

        // Find player in match
        const player = matchData.players.find(p => p.puuid === puuid);
        
        if (!player) {
            return {
                success: false,
                error: 'Player not found in this match.',
                verified: false
            };
        }

        // Determine if player won
        const playerTeam = player.teamId;
        const winningTeam = matchData.teams.find(t => t.won)?.teamId;
        const playerWon = playerTeam === winningTeam;

        return {
            success: true,
            verified: true,
            matchId: matchId,
            playerWon: playerWon,
            playerTeam: playerTeam,
            winningTeam: winningTeam,
            gameMode: matchData.matchInfo?.mode || 'Unknown',
            mapName: matchData.matchInfo?.mapId || 'Unknown'
        };
    } catch (error) {
        console.error('Valorant match verification error:', error);
        
        if (error.message.includes('404')) {
            return {
                success: false,
                error: 'Match not found. Please check the match ID.',
                verified: false
            };
        }
        
        return {
            success: false,
            error: 'Failed to verify match. Please try again later.',
            verified: false
        };
    }
}

/**
 * Verify a League of Legends match result
 * @param {string} matchId - The match ID from Riot API
 * @param {string} puuid - Player's PUUID
 * @param {string} region - Region (americas, europe, asia)
 * @returns {Promise<Object>} Verification result with match details
 */
async function verifyLeagueMatch(matchId, puuid, region = 'americas') {
    const apiKey = process.env.RIOT_API_KEY;
    
    if (!apiKey) {
        return {
            success: false,
            error: 'Riot API key not configured.',
            verified: false
        };
    }

    try {
        // Get match details
        const matchUrl = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const matchData = await httpsGet(matchUrl, {
            'X-Riot-Token': apiKey
        });

        if (!matchData || !matchData.info) {
            return {
                success: false,
                error: 'Match not found or invalid match ID.',
                verified: false
            };
        }

        // Find player in match
        const participant = matchData.info.participants.find(p => p.puuid === puuid);
        
        if (!participant) {
            return {
                success: false,
                error: 'Player not found in this match.',
                verified: false
            };
        }

        return {
            success: true,
            verified: true,
            matchId: matchId,
            playerWon: participant.win,
            championName: participant.championName,
            gameMode: matchData.info.gameMode,
            gameDuration: matchData.info.gameDuration
        };
    } catch (error) {
        console.error('League match verification error:', error);
        
        if (error.message.includes('404')) {
            return {
                success: false,
                error: 'Match not found. Please check the match ID.',
                verified: false
            };
        }
        
        return {
            success: false,
            error: 'Failed to verify match. Please try again later.',
            verified: false
        };
    }
}

/**
 * Verify match result based on game
 * @param {string} game - Game identifier
 * @param {string} matchId - Match ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object>} Verification result
 */
async function verifyMatchResult(game, matchId, userId) {
    const { linkedAccountOps } = require('./database');
    
    // Get linked account for the game
    const linkedAccount = linkedAccountOps.get(userId, game);
    
    if (!linkedAccount || !linkedAccount.verified) {
        return {
            success: false,
            error: `No verified ${game} account linked. Please link your account first using /link.`,
            verified: false
        };
    }

    switch (game) {
        case 'valorant':
            return await verifyValorantMatch(matchId, linkedAccount.platform_id);
        
        case 'lol':
            return await verifyLeagueMatch(matchId, linkedAccount.platform_id);
        
        case 'cs2':
        case 'rocket_league':
        case 'fortnite':
        case 'apex':
        case 'r6':
            // These games either don't have public APIs for match verification
            // or require additional implementation
            return {
                success: false,
                error: `Automatic match verification not available for ${game}. Please use proof_url instead.`,
                verified: false,
                requiresManualProof: true
            };
        
        default:
            return {
                success: false,
                error: 'Unsupported game for automatic verification.',
                verified: false,
                requiresManualProof: true
            };
    }
}

module.exports = {
    verifyGameAccount,
    verifyRiotAccount,
    verifySteamAccount,
    verifyTrackerAccount,
    verifyValorantMatch,
    verifyLeagueMatch,
    verifyMatchResult
};
