# Wager Bot

A comprehensive Discord bot for managing crypto gaming wagers on the Wager platform. Create, accept, and manage wagers across multiple games including Valorant, League of Legends, CS2, Rocket League, Fortnite, Apex Legends, and Rainbow Six Siege.

## Features

### 🎮 Core Functionality
- **Wallet Verification**: Link Discord accounts to Ethereum wallets
- **Gaming Account Linking**: Connect and verify accounts from supported games with real API verification
- **Solo & Team Wagers**: Create 1v1 wagers or team-based matches (2v2, 3v3, 5v5 depending on game)
- **LFT System**: Looking For Teammates - join team wagers as individual players
- **Match Verification**: Automatic API verification for ranked matches OR proof upload for custom/creative modes
- **Proof Upload System**: Screenshot/video proof support for custom matches via Discord, Imgur, YouTube, Streamable
- **Enhanced Dispute System**: Counter-proof submission, community voting, and moderator resolution
- **Statistics Tracking**: View wins, losses, and earnings
- **Leaderboards**: See top players overall or by game
- **Team Management**: Create, manage, and organize teams

### 🤖 Automated Systems
- Real-time wager alerts in dedicated channels with interactive buttons
- Match result notifications
- Dispute alerts for moderators
- DM notifications for all participants
- Automatic "Verified" role assignment
- Channel moderation for wager-alerts and disputes channels

### 💰 Real Ethereum Wallet System
- **Real ETH Deposits**: Each user gets a unique Ethereum address for deposits
- **HD Wallet Generation**: BIP44/BIP32 hierarchical deterministic wallet derivation
- **Automatic Deposit Detection**: Blockchain monitoring service detects and credits deposits
- **Real On-Chain Withdrawals**: Actual ETH transfers to your verified wallet
- **Pre-Funded Balance**: Deposit funds once, use for all wagers
- **Instant Wager Creation**: Funds automatically held when creating/accepting wagers
- **Automatic Payouts**: Winners receive payouts automatically to their balance
- **Transaction History**: Track all deposits, wagers, wins, losses, and withdrawals
- **Real-Time Balance**: View available balance, held balance, and total at any time

### 💎 Additional Features
- 3% platform fee calculation
- Rich embeds for all messages
- Interactive buttons for quick actions
- Support for 7 major games
- Real game account verification via official APIs
- Team roster management
- Multi-player wager support

### 🔒 Security & Verification
- **Real Account Verification**: Verify game accounts using official APIs
  - Riot Games API (Valorant & League of Legends)
  - Steam API (CS2)
  - Tracker.gg API (Rocket League, R6, Fortnite, Apex Legends)
- **Match Verification System**: Game-specific verification methods
  - **Ranked/Competitive**: Automatic API verification (Valorant, LoL)
  - **Custom/Creative**: Manual proof upload with screenshot/video
- **Proof Validation**: Supports Discord attachments, Imgur, YouTube, and Streamable links
- **Channel Moderation**: Auto-delete non-bot messages in dedicated channels
- **Warning System**: Automatic DM warnings for users who post in moderated channels

## Supported Games

- **Valorant** (5v5) - Riot ID verification
- **League of Legends** (5v5) - Riot ID verification
- **CS2 (Counter-Strike 2)** (5v5) - Steam account verification
- **Rocket League** (1v1, 2v2, 3v3) - Tracker.gg verification
- **Fortnite** (1v1, 2v2, 4v4) - Tracker.gg verification
- **Apex Legends** (3v3) - Tracker.gg verification
- **Rainbow Six Siege** (5v5) - Tracker.gg verification

## Commands

### Account Management
- `/verify <wallet>` - Link your Discord account to an ETH wallet address
- `/link <game> <username>` - Link and verify your gaming account (format varies by game)
  - Valorant/LoL: Use Riot ID format `name#tag` (e.g., `Player#NA1`)
  - CS2: Use Steam ID64 or custom URL
  - Other games: Use in-game username

### Wallet Management
- `/deposit` - Get your unique deposit address to add funds to your bot balance
- `/balance` - Check your wallet balance, stats, and transaction history
- `/withdraw <amount>` - Withdraw funds from your balance to your verified wallet

### Wager Commands
- `/wager create <game> <amount> [opponent] [team_size] [team_id] [match_type]` - Create a new wager
  - Solo Ranked: `/wager create game:Valorant amount:0.1 match_type:ranked`
  - Custom Match: `/wager create game:Fortnite amount:0.05 match_type:custom`
  - Team (with existing team): `/wager create game:CS2 amount:0.2 team_size:5 team_id:1`
  - LFT (Looking For Teammates): `/wager create game:Rocket_League amount:0.15 team_size:3`
- `/wager accept <id>` - Accept an open challenge
- `/wager lft-join <id> <side>` - Join an LFT wager (creator or opponent side)
- `/wager status <id>` - Check wager details and status
- `/wager submit <id> [match_id] [proof_url]` - Submit win proof
  - Ranked/Competitive: `/wager submit id:1 match_id:VAL-NA1-12345`
  - Custom/Creative: `/wager submit id:1 proof_url:https://imgur.com/abc123`
- `/wager dispute <id> <reason>` - File a dispute on a wager

### Dispute Commands
- `/dispute counter-proof <dispute_id> <proof_url>` - Submit counter evidence for a dispute
- `/dispute vote <dispute_id> <side>` - Vote on a disputed wager (community members)
- `/dispute resolve <dispute_id> <winner> [reason]` - Resolve a dispute (Moderators only)

### Team Commands
- `/team create <name> <game>` - Create a new team
- `/team invite <team_id> <@user>` - Invite a user to your team (captain only)
- `/team leave <team_id>` - Leave a team
- `/team roster [team_id]` - View team roster or list your teams
- `/team disband <team_id>` - Disband your team (captain only)

### Statistics
- `/stats [@user]` - View user statistics
- `/leaderboard [game]` - View top players

### Admin Commands (Administrator Only)
- `/admin wallet-balance` - Check hot wallet ETH balance
- `/admin system-status` - View system configuration and health status

### Help
- `/help` - Show all available commands

## Match Types & Verification

The bot supports different match types with appropriate verification methods:

| Match Type | Description | Verification Method | Supported Games |
|------------|-------------|---------------------|-----------------|
| **Ranked/Competitive** | Official ranked matches | ✅ Automatic API verification | Valorant, League of Legends |
| **Competitive** | Competitive mode matches | ⚠️ Manual verification required | CS2, Rocket League, R6 |
| **Custom** | Private/Custom matches | 📸 Screenshot/Video proof required | All games |
| **Creative** | Creative mode matches | 📸 Screenshot/Video proof required | Fortnite |

### Proof Requirements

**For Custom/Creative matches**, you must provide a proof_url when submitting:
- **Discord Attachments**: Upload screenshot to Discord and copy the attachment URL
- **Imgur**: Upload to imgur.com and share the link
- **YouTube**: Upload video and share the link
- **Streamable**: Upload video to streamable.com and share the link

**Example:**
```
/wager submit id:1 proof_url:https://i.imgur.com/abc123.png
```

### API-Verified Games

Games with automatic match verification:

**Valorant & League of Legends** (Riot Games API):
- Ranked and competitive matches can be verified automatically
- Provide the match ID when submitting: `/wager submit id:1 match_id:VAL-NA1-12345`
- Creative/custom matches require proof URL

**Other Games** (CS2, Rocket League, Fortnite, etc.):
- Currently require manual proof for all match types
- Future updates may add tracker-based verification

## Setup Instructions

### Prerequisites
- Node.js v16.9.0 or higher
- A Discord account
- A Discord server where you have administrator permissions

### 1. Create Discord Bot Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot" and confirm
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent
   - Message Content Intent
6. Click "Reset Token" and copy your bot token (save this for later)
7. Go to the "OAuth2" section and copy your "Client ID"

### 2. Invite Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Select the following scopes:
   - `bot`
   - `applications.commands`
3. Select the following bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
   - Manage Roles
   - Read Messages/View Channels
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 3. Configure Discord Server

Create the following channels in your Discord server:
- `#wager-alerts` - For new wager notifications
- `#match-results` - For completed match results
- `#disputes` - For dispute alerts

Create a role:
- `Verified` - Automatically assigned to verified users

Get the IDs for these channels and the role:
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on each channel/role and select "Copy ID"

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your values:
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_server_id_here

# Channel IDs
WAGER_ALERTS_CHANNEL=channel_id_for_wager_alerts
MATCH_RESULTS_CHANNEL=channel_id_for_match_results
DISPUTES_CHANNEL=channel_id_for_disputes

# Channel Moderation
MODERATION_ENABLED=true
OPEN_CHALLENGES_CHANNEL=channel_id_for_wager_alerts

# Role IDs
VERIFIED_ROLE_ID=role_id_for_verified_users

# Game API Keys (for account verification)
RIOT_API_KEY=your_riot_api_key
STEAM_API_KEY=your_steam_api_key
TRACKER_API_KEY=your_tracker_gg_api_key

# Ethereum Configuration (Real Blockchain Integration)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
MASTER_WALLET_PRIVATE_KEY=your_master_wallet_private_key_here
MASTER_WALLET_ADDRESS=0x_your_master_wallet_address_here
HD_WALLET_MNEMONIC=your_twelve_word_mnemonic_phrase_here

# Deposit Monitoring
DEPOSIT_CHECK_INTERVAL_MS=60000
REQUIRED_CONFIRMATIONS=12
MIN_DEPOSIT_ETH=0.001

# Withdrawal Configuration
MIN_WITHDRAWAL=0.005
MAX_GAS_PRICE_GWEI=100

# Network Selection (mainnet or sepolia for testing)
NETWORK=mainnet
```

**Required Variables:**
- `DISCORD_TOKEN` - Your bot token from the Discord Developer Portal
- `CLIENT_ID` - Your application's client ID
- `GUILD_ID` - Your server ID (for development; optional for production)
- `WAGER_ALERTS_CHANNEL` - Channel ID where wager alerts will be posted
- `MATCH_RESULTS_CHANNEL` - Channel ID where match results will be posted
- `DISPUTES_CHANNEL` - Channel ID where disputes will be posted
- `VERIFIED_ROLE_ID` - Role ID for verified users

**Ethereum Configuration (CRITICAL for Production):**
- `ETHEREUM_RPC_URL` - RPC endpoint for Ethereum (Infura, Alchemy, or public RPC)
  - Get free API key from [Infura](https://infura.io) or [Alchemy](https://alchemy.com)
- `MASTER_WALLET_PRIVATE_KEY` - Private key for hot wallet that sends withdrawals (KEEP SECURE!)
  - This wallet needs ETH for gas fees and user withdrawals
- `MASTER_WALLET_ADDRESS` - Public address of the master wallet
- `HD_WALLET_MNEMONIC` - 12-word mnemonic phrase for generating user deposit addresses
  - Generate using: `node -e "console.log(require('ethers').Wallet.createRandom().mnemonic.phrase)"`
  - **NEVER share this phrase!** It controls all user deposit addresses

**Deposit & Withdrawal Settings:**
- `DEPOSIT_CHECK_INTERVAL_MS` - How often to check for deposits (default: 60000ms = 1 minute)
- `REQUIRED_CONFIRMATIONS` - Block confirmations before crediting deposit (default: 12 blocks)
- `MIN_DEPOSIT_ETH` - Minimum deposit amount (default: 0.001 ETH)
- `MIN_WITHDRAWAL` - Minimum withdrawal amount (default: 0.005 ETH)
- `MAX_GAS_PRICE_GWEI` - Maximum gas price for withdrawals (default: 100 gwei)
- `NETWORK` - Network to use: `mainnet` (real ETH) or `sepolia` (testnet)

**Optional Variables (for enhanced features):**
- `MODERATION_ENABLED` - Enable/disable channel moderation (default: false)
- `OPEN_CHALLENGES_CHANNEL` - Alias for WAGER_ALERTS_CHANNEL used by moderation
- `RIOT_API_KEY` - For verifying Valorant and League of Legends accounts
- `STEAM_API_KEY` - For verifying CS2/Steam accounts
- `TRACKER_API_KEY` - For verifying Rocket League, R6, Fortnite, and Apex accounts

**How to get API keys:**
- **Riot API**: Visit [Riot Developer Portal](https://developer.riotgames.com/)
- **Steam API**: Visit [Steam Web API Key](https://steamcommunity.com/dev/apikey)
- **Tracker.gg API**: Visit [Tracker.gg](https://tracker.gg/developers)

### 6. Deploy Slash Commands

Before running the bot, you need to register the slash commands:

```bash
npm run deploy
```

This command will register all slash commands with Discord. During development, commands are registered to your specific guild (instant). For production, you can remove `GUILD_ID` from `.env` to register globally (takes up to 1 hour).

### 7. Run the Bot

```bash
npm start
```

You should see:
```
✅ Loaded command: verify
✅ Loaded command: link
✅ Loaded command: wager
✅ Loaded command: stats
✅ Loaded command: leaderboard
✅ Loaded command: balance
✅ Loaded command: help
✅ Loaded event: ready
✅ Loaded event: interactionCreate
✅ Database initialized successfully
✅ Bot is ready! Logged in as YourBot#1234
```

## Project Structure

```
wager-bot/
├── src/
│   ├── index.js              # Bot entry point
│   ├── deploy-commands.js    # Register slash commands
│   ├── commands/             # Slash command implementations
│   │   ├── verify.js         # Wallet verification
│   │   ├── link.js           # Gaming account linking
│   │   ├── wager.js          # Wager management (create, accept, status, submit, dispute)
│   │   ├── stats.js          # User statistics
│   │   ├── leaderboard.js    # Top players leaderboard
│   │   ├── balance.js        # Balance checking
│   │   └── help.js           # Help command
│   ├── events/               # Discord event handlers
│   │   ├── ready.js          # Bot ready event
│   │   └── interactionCreate.js  # Command and button interactions
│   ├── handlers/             # Interaction handlers
│   │   └── buttonHandler.js  # Button interaction handling
│   ├── services/             # Business logic
│   │   ├── database.js       # SQLite database operations
│   │   └── notifications.js  # Channel and DM notifications
│   └── utils/                # Utility functions
│       ├── embeds.js         # Rich embed creators
│       └── constants.js      # Game lists and constants
├── .env.example              # Example environment variables
├── .gitignore               # Git ignore file
├── package.json             # Project dependencies
└── README.md                # This file
```

## Database Schema

The bot uses SQLite with the following tables:

### Users
- `discord_id` (Primary Key)
- `wallet_address` (Unique)
- `verified` (Boolean)
- `balance` (Decimal)
- `created_at` (Timestamp)

### Linked Accounts
- `id` (Primary Key)
- `discord_id` (Foreign Key)
- `platform` (Game platform)
- `username` (In-game username)
- `verified` (Boolean)
- `created_at` (Timestamp)

### Wagers
- `id` (Primary Key)
- `creator_id` (Foreign Key)
- `opponent_id` (Foreign Key, nullable)
- `game` (Game type)
- `amount` (Decimal)
- `status` (open/accepted/in_progress/pending_verification/disputed/completed/cancelled)
- `winner_id` (Foreign Key, nullable)
- `match_id` (String, nullable)
- `proof` (String, nullable)
- `proof_url` (String, nullable) - NEW: Screenshot/video proof URL
- `match_type` (String) - NEW: ranked/competitive/custom/creative
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Disputes
- `id` (Primary Key)
- `wager_id` (Foreign Key)
- `filer_id` (Foreign Key)
- `reason` (Text)
- `evidence` (Text, nullable)
- `counter_proof` (Text, nullable) - NEW: Counter evidence URL
- `status` (pending/resolved)
- `created_at` (Timestamp)
- `resolved_at` (Timestamp, nullable)

### Dispute Votes
- `id` (Primary Key)
- `dispute_id` (Foreign Key)
- `voter_id` (Foreign Key)
- `vote` (creator/opponent)
- `created_at` (Timestamp)

### User Wallets (NEW - Simplified System)
- `discord_id` (Primary Key, Foreign Key)
- `deposit_address` (Unique) - Personal deposit address for each user
- `available_balance` (Decimal) - Funds available to wager or withdraw
- `held_balance` (Decimal) - Funds locked in active wagers
- `total_deposited` (Decimal) - Lifetime deposits
- `total_withdrawn` (Decimal) - Lifetime withdrawals
- `total_won` (Decimal) - Total winnings
- `total_lost` (Decimal) - Total losses
- `created_at` (Timestamp)

### Wallet Transactions (NEW)
- `id` (Primary Key)
- `discord_id` (Foreign Key)
- `type` (deposit/withdraw/wager_hold/wager_release/wager_win/wager_loss/refund)
- `amount` (Decimal)
- `wager_id` (Foreign Key, nullable) - Linked wager if applicable
- `tx_hash` (String, nullable) - Blockchain transaction hash
- `status` (completed/pending)
- `description` (Text)
- `created_at` (Timestamp)

## Quick Start Guide

### First Time Setup

1. **Verify Your Wallet**
   ```
   /verify 0xYourEthereumWalletAddress
   ```
   Link your Discord account to your Ethereum wallet.

2. **Add Funds**
   ```
   /deposit
   ```
   Get your unique deposit address. Send ETH to this address from your verified wallet.

3. **Check Balance**
   ```
   /balance
   ```
   Confirm your deposit has been detected and is available.

4. **Create Your First Wager**
   ```
   /wager create game:Valorant amount:0.1
   ```
   Funds are automatically held from your balance!

### Daily Usage

Once you have funds in your balance, wagering is simple:

1. **Create or Accept Wagers** - Funds automatically held
2. **Play Your Match** - Have fun!
3. **Submit Results** - Use `/wager submit`
4. **Get Paid** - Winnings automatically added to your balance

**Cash Out Anytime:**
```
/withdraw 0.5
```
Withdraw unused funds back to your verified wallet.

## Usage Examples

### Creating a Wager

**Open Challenge:**
```
/wager create game:Valorant amount:0.1
```
Creates an open wager that anyone can accept.

**Direct Challenge:**
```
/wager create game:CS2 amount:0.05 opponent:@Friend
```
Creates a direct challenge to a specific user.

### Accepting a Wager

```
/wager accept id:1
```
Accept wager #1 (must be an open challenge).

### Submitting a Win

```
/wager submit id:1 match_id:VAL-MATCH-12345
```
Submit proof of winning wager #1 with the match ID.

### Filing a Dispute

```
/wager dispute id:1 reason:Opponent cheated, have video proof
```
File a dispute for wager #1.

### Dispute Resolution Process

**1. File Dispute:**
```
/wager dispute id:1 reason:Match result is incorrect
```

**2. Submit Counter-Proof (Opposing Party):**
```
/dispute counter-proof dispute_id:1 proof_url:https://imgur.com/proof123
```

**3. Community Voting (Optional):**
```
/dispute vote dispute_id:1 side:creator
```
- Non-participants can vote on disputes
- Helps moderators make informed decisions

**4. Moderator Resolution:**
```
/dispute resolve dispute_id:1 winner:creator reason:Original proof clearly shows victory
```
- Moderators with "Manage Messages" permission can resolve disputes
- Options: Award to creator, award to opponent, or cancel wager
- Both parties are notified of the decision

## Platform Fee

The bot automatically calculates a 3% platform fee on all wagers:
- If a wager is created for 0.1 ETH (0.2 ETH total pot)
- Platform fee: 0.006 ETH (3% of total pot)
- Winner receives: 0.194 ETH (97% of total pot)

## Development

### Adding New Games

To add support for a new game:

1. Edit `src/utils/constants.js`:
```javascript
const GAME_CHOICES = [
    // ... existing games
    { name: 'New Game', value: 'new_game' }
];
```

2. Redeploy commands:
```bash
npm run deploy
```

### Testing

During development, set `GUILD_ID` in `.env` to your test server's ID. This makes command updates instant instead of taking up to an hour.

## Troubleshooting

### Bot doesn't respond to commands
- Ensure slash commands are deployed (`npm run deploy`)
- Check that the bot has proper permissions
- Verify `DISCORD_TOKEN` is correct in `.env`

### Database errors
- Ensure the bot has write permissions in the project directory
- Delete `wager.db` and restart to reset the database

### Channel notifications not working
- Verify channel IDs in `.env` are correct
- Ensure bot has permissions to post in those channels

### Role assignment not working
- Verify `VERIFIED_ROLE_ID` in `.env` is correct
- Ensure bot has "Manage Roles" permission
- Ensure bot's role is above the "Verified" role in the server settings

## Security Notes

### Critical Security Requirements
- **NEVER commit your `.env` file to version control**
- **NEVER share or expose these sensitive values:**
  - `MASTER_WALLET_PRIVATE_KEY` - Controls the hot wallet with real funds
  - `HD_WALLET_MNEMONIC` - Controls all user deposit addresses
  - `DISCORD_TOKEN` - Controls your Discord bot
- Keep your bot token secret
- Regularly update dependencies for security patches

### Wallet Security Best Practices
1. **Hot Wallet Management:**
   - Keep only necessary ETH in the hot wallet for withdrawals
   - Store majority of funds in a cold wallet
   - Monitor hot wallet balance using `/admin wallet-balance`
   - Set up alerts for low balance or suspicious activity

2. **Private Key Storage:**
   - Use environment variables, never hardcode keys
   - Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - For production, consider using a Hardware Security Module (HSM)
   - Backup your mnemonic phrase securely offline

3. **Gas Price Protection:**
   - Set reasonable `MAX_GAS_PRICE_GWEI` to prevent excessive gas costs
   - Monitor Ethereum network conditions
   - Consider implementing withdrawal queues during high gas periods

4. **Testing:**
   - **ALWAYS test on Sepolia testnet first** before mainnet
   - Use `NETWORK=sepolia` in `.env` for testing
   - Get free Sepolia ETH from faucets
   - Never use real funds for testing

5. **Additional Security:**
   - Implement rate limiting for withdrawals
   - Add withdrawal cooldowns or limits per user
   - Log all blockchain transactions for audit trail
   - Consider adding multi-signature requirements for large withdrawals
   - Validate all addresses before sending transactions

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - See LICENSE file for details
