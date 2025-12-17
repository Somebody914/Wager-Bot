# Wager Bot

A comprehensive Discord bot for managing crypto gaming wagers on the Wager platform. Create, accept, and manage wagers across multiple games including Valorant, League of Legends, CS2, Rocket League, Fortnite, and Apex Legends.

## Features

### 🎮 Core Functionality
- **Wallet Verification**: Link Discord accounts to Ethereum wallets
- **Gaming Account Linking**: Connect accounts from supported games
- **Wager Creation**: Create direct challenges or open wagers
- **Match Verification**: Submit proof and track match results
- **Dispute System**: File and resolve disputes with moderators
- **Statistics Tracking**: View wins, losses, and earnings
- **Leaderboards**: See top players overall or by game

### 🤖 Automated Systems
- Real-time wager alerts in dedicated channels
- Match result notifications
- Dispute alerts for moderators
- DM notifications for all participants
- Automatic "Verified" role assignment

### 💎 Additional Features
- 3% platform fee calculation
- Escrow balance tracking
- Rich embeds for all messages
- Interactive buttons for quick actions
- Support for 6 major games

## Supported Games

- Valorant
- League of Legends
- CS2 (Counter-Strike 2)
- Rocket League
- Fortnite
- Apex Legends

## Commands

### Account Management
- `/verify <wallet>` - Link your Discord account to an ETH wallet address
- `/link <game> <username>` - Link your gaming account
- `/balance` - Check your escrow balance

### Wager Commands
- `/wager create <game> <amount> [opponent]` - Create a new wager
- `/wager accept <id>` - Accept an open challenge
- `/wager status <id>` - Check wager details and status
- `/wager submit <id> <match_id>` - Submit win proof with match ID
- `/wager dispute <id> <reason>` - File a dispute on a wager

### Statistics
- `/stats [@user]` - View user statistics
- `/leaderboard [game]` - View top players

### Help
- `/help` - Show all available commands

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
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_server_id_here

WAGER_ALERTS_CHANNEL=channel_id_for_wager_alerts
MATCH_RESULTS_CHANNEL=channel_id_for_match_results
DISPUTES_CHANNEL=channel_id_for_disputes

VERIFIED_ROLE_ID=role_id_for_verified_users
```

**Required Variables:**
- `DISCORD_TOKEN` - Your bot token from the Discord Developer Portal
- `CLIENT_ID` - Your application's client ID
- `GUILD_ID` - Your server ID (for development; optional for production)
- `WAGER_ALERTS_CHANNEL` - Channel ID where wager alerts will be posted
- `MATCH_RESULTS_CHANNEL` - Channel ID where match results will be posted
- `DISPUTES_CHANNEL` - Channel ID where disputes will be posted
- `VERIFIED_ROLE_ID` - Role ID for verified users

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
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Disputes
- `id` (Primary Key)
- `wager_id` (Foreign Key)
- `filer_id` (Foreign Key)
- `reason` (Text)
- `evidence` (Text, nullable)
- `status` (pending/resolved)
- `created_at` (Timestamp)
- `resolved_at` (Timestamp, nullable)

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

- Never commit your `.env` file to version control
- Keep your bot token secret
- Regularly update dependencies for security patches
- In production, implement additional validation for match IDs
- Consider adding rate limiting for wager creation

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - See LICENSE file for details
