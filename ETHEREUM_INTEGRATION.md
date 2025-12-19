# Ethereum Mainnet Integration - Implementation Guide

## Overview
This document describes the Ethereum mainnet integration implemented for Wager-Bot. The integration replaces fake/stubbed wallet addresses and transactions with real blockchain operations.

## Implementation Status: ✅ COMPLETE

All features have been implemented and tested. The system is ready for testnet validation before production deployment.

## Key Features

### 1. Real HD Wallet Generation
- Uses ethers.js v6.9.0 for Ethereum interactions
- Implements BIP44 HD wallet standard (m/44'/60'/0'/0/{index})
- Each user gets a unique, real Ethereum deposit address
- Addresses are deterministically generated from a master mnemonic
- Derivation index stored in database for address recovery

### 2. Deposit Monitoring Service
- Automatically monitors blockchain for incoming deposits
- Configurable check interval (default: 60 seconds)
- Waits for required confirmations (default: 12 blocks)
- Credits user balance and sends DM notification
- Prevents duplicate deposit processing with wei-based comparison
- Handles network errors gracefully with retries

### 3. Real Withdrawal Execution
- Executes actual on-chain ETH transfers
- Uses hot wallet (master wallet) to send payouts
- Handles gas estimation dynamically
- Validates gas price against configurable maximum
- Returns real transaction hashes
- Gracefully handles insufficient funds errors
- Validates destination addresses

### 4. Admin Monitoring Tools
- `/admin wallet-balance` - Check hot wallet ETH balance
- `/admin system-status` - View system configuration and health
- Helps administrators monitor system readiness
- Warns about low hot wallet balance

### 5. Security Features
- Private keys never logged or exposed
- Sensitive addresses redacted in logs (show only first/last chars)
- Environment variables for all sensitive data
- Address validation before sending transactions
- Gas price limits to prevent excessive costs
- Wei-based amount comparisons for precision
- Hot wallet balance monitoring

## Environment Variables

Add these to your `.env` file:

```env
# Ethereum Configuration (CRITICAL for Production)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
MASTER_WALLET_PRIVATE_KEY=your_master_wallet_private_key_here
HD_WALLET_MNEMONIC=your_twelve_word_mnemonic_phrase_here

# Deposit Monitoring
DEPOSIT_CHECK_INTERVAL_MS=60000
REQUIRED_CONFIRMATIONS=12
MIN_DEPOSIT_ETH=0.001

# Withdrawal Configuration
MIN_WITHDRAWAL=0.005
MAX_GAS_PRICE_GWEI=100
WITHDRAWAL_GAS_LIMIT=21000

# Network Selection (mainnet or sepolia for testing)
NETWORK=mainnet
```

### Generating Required Values

**HD Wallet Mnemonic:**
```bash
node -e "console.log(require('ethers').Wallet.createRandom().mnemonic.phrase)"
```
⚠️ **CRITICAL**: Back up this mnemonic securely offline. It controls all user deposit addresses!

**Master Wallet:**
```bash
node -e "const w = require('ethers').Wallet.createRandom(); console.log('Private Key:', w.privateKey, '\nAddress:', w.address)"
```
⚠️ **CRITICAL**: Keep this private key secure. It controls the hot wallet with user funds!

## Database Schema Updates

New columns added to `user_wallets` table:
- `derivation_index` (INTEGER) - HD wallet derivation index for each user
- `last_checked_block` (INTEGER) - Last blockchain block checked for deposits

These are automatically created when initializing the database.

## Testing

A comprehensive test suite is included in `test-ethereum-integration.cjs`:

```bash
node test-ethereum-integration.cjs
```

Tests verify:
- ✅ HD wallet generation with multiple indices
- ✅ Database wallet creation with unique addresses
- ✅ Balance operations (deposit, hold, release)
- ✅ Withdrawal validation
- ✅ Transaction history tracking
- ✅ Deposit monitor initialization
- ✅ Master wallet balance checking

## Deployment Steps

### Phase 1: Sepolia Testnet Testing
1. **Configure Testnet Settings:**
   ```env
   ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   NETWORK=sepolia
   ```

2. **Generate Test Wallets:**
   - Generate HD mnemonic and master wallet (use different ones than production!)
   - Add testnet ETH to master wallet from [Sepolia Faucet](https://sepoliafaucet.com)

3. **Deploy Bot:**
   ```bash
   npm run deploy  # Deploy slash commands
   npm start       # Start bot
   ```

4. **Test Complete Flow:**
   - User runs `/deposit` and gets real Sepolia address
   - Send test ETH to that address
   - Verify deposit is detected and credited (wait for confirmations)
   - Create a wager, complete it, receive payout
   - Run `/withdraw` to test withdrawal

5. **Monitor Logs:**
   ```bash
   # Look for these messages:
   # "✅ Master wallet initialized"
   # "🔍 Starting deposit monitor"
   # "💰 New deposit detected"
   # "✅ Credited X ETH to user"
   # "💸 Executing withdrawal"
   ```

### Phase 2: Mainnet Production
1. **Generate Production Wallets:**
   - Generate new HD mnemonic (NEVER reuse testnet mnemonic!)
   - Generate new master wallet
   - Back up both securely offline (paper backup, safe deposit box)

2. **Configure Production Settings:**
   ```env
   ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
   NETWORK=mainnet
   REQUIRED_CONFIRMATIONS=12
   MAX_GAS_PRICE_GWEI=100
   ```

3. **Fund Hot Wallet:**
   - Send initial ETH to master wallet for gas and withdrawals
   - Recommended: Start with 1-2 ETH, monitor and refill as needed

4. **Deploy to Production:**
   ```bash
   npm run deploy
   npm start
   ```

5. **Monitor System:**
   - Use `/admin wallet-balance` regularly
   - Set up alerts for low balance
   - Review logs for any errors
   - Monitor gas prices and adjust MAX_GAS_PRICE_GWEI if needed

## Security Best Practices

### Critical Security Rules
1. **NEVER commit `.env` file to version control**
2. **NEVER share or expose:**
   - Master wallet private key
   - HD wallet mnemonic
   - Discord bot token
3. **Always backup offline:**
   - HD wallet mnemonic (paper backup)
   - Master wallet private key (encrypted backup)

### Hot Wallet Management
- Keep only necessary ETH in hot wallet
- Store majority of funds in cold wallet
- Monitor balance using `/admin wallet-balance`
- Set up low balance alerts
- Regularly audit withdrawal transactions

### Gas Price Protection
- Set reasonable `MAX_GAS_PRICE_GWEI` (default: 100)
- Monitor Ethereum network conditions
- Adjust limit during high congestion
- Consider implementing withdrawal queues

### Additional Recommendations
- Enable 2FA on all accounts (Infura, GitHub, Discord)
- Use hardware security module (HSM) for production
- Implement rate limiting on withdrawals
- Add withdrawal cooldowns (e.g., 1 hour)
- Log all blockchain transactions for audit trail
- Consider multi-signature requirements for large amounts
- Regular security audits of the codebase

## Monitoring and Maintenance

### Daily Checks
- [ ] Hot wallet balance sufficient
- [ ] Deposit monitoring service running
- [ ] No stuck/failed transactions
- [ ] Discord bot online

### Weekly Checks
- [ ] Review transaction logs
- [ ] Check gas price trends
- [ ] Audit user balances vs blockchain
- [ ] Review deposit/withdrawal patterns

### Monthly Checks
- [ ] Security audit
- [ ] Update dependencies
- [ ] Review and optimize gas limits
- [ ] Backup verification (can you restore?)

## Troubleshooting

### Deposits Not Detected
- Check `ETHEREUM_RPC_URL` is configured
- Verify deposit monitoring service started
- Check user sent to correct address (from `/deposit`)
- Wait for required confirmations (default: 12 blocks ≈ 3 minutes)
- Check logs for errors

### Withdrawals Failing
- Verify hot wallet has sufficient balance (`/admin wallet-balance`)
- Check gas price not exceeding `MAX_GAS_PRICE_GWEI`
- Verify destination address is valid
- Check network connectivity to RPC endpoint
- Review error logs

### High Gas Costs
- Monitor gas prices on [Etherscan](https://etherscan.io/gastracker)
- Increase `MAX_GAS_PRICE_GWEI` temporarily if urgent
- Consider implementing withdrawal queuing during high gas
- Batch withdrawals if possible

### RPC Rate Limiting
- Upgrade Infura/Alchemy plan
- Implement request caching
- Increase `DEPOSIT_CHECK_INTERVAL_MS`
- Consider running own Ethereum node

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Discord Bot                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │            User Commands                          │  │
│  │  /deposit  /withdraw  /balance  /wager           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐   ┌───▼────┐  ┌───▼──────┐
    │ Wallet │   │Deposit │  │  Admin   │
    │Service │   │Monitor │  │ Commands │
    └────┬───┘   └───┬────┘  └──────────┘
         │           │
    ┌────▼───────────▼───────┐
    │   HD Wallet (BIP44)    │
    │  m/44'/60'/0'/0/{idx}  │
    └────┬───────────┬────────┘
         │           │
    ┌────▼──────┐   │
    │  Master   │   │
    │  Wallet   │   │
    │ (Hot)     │   │
    └────┬──────┘   │
         │          │
         └──────┬───┘
                │
         ┌──────▼─────────┐
         │   Ethereum     │
         │   Mainnet      │
         │  (via RPC)     │
         └────────────────┘
```

## File Changes

### Modified Files
- `src/services/wallet.js` - Real wallet generation and withdrawals
- `src/services/database.js` - Added derivation tracking columns
- `src/index.js` - Integrated deposit monitor
- `.env.example` - Added Ethereum configuration
- `README.md` - Updated documentation
- `package.json` - Added ethers.js dependency

### New Files
- `src/services/depositMonitor.js` - Blockchain monitoring service
- `src/commands/admin.js` - Admin monitoring commands
- `test-ethereum-integration.cjs` - Test suite
- `ETHEREUM_INTEGRATION.md` - This file

## Support and Resources

### Documentation
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [BIP44 Standard](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [Ethereum Gas Tracker](https://etherscan.io/gastracker)

### RPC Providers
- [Infura](https://infura.io) - Easy setup, free tier available
- [Alchemy](https://alchemy.com) - Enhanced APIs, free tier
- [Public RPC Endpoints](https://chainlist.org/) - Free but rate limited

### Testing Resources
- [Sepolia Testnet Faucet](https://sepoliafaucet.com)
- [Sepolia Etherscan](https://sepolia.etherscan.io)

## Conclusion

The Ethereum mainnet integration is complete and ready for deployment. Follow the testing and deployment steps carefully, prioritizing security at every stage. Start with testnet, verify everything works, then proceed to mainnet with proper monitoring in place.

For questions or issues, refer to the troubleshooting section or review the code comments in the implementation files.

**Remember:** With real money involved, take every security precaution seriously!
