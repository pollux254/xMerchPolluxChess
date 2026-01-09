# Xahau Hook Deployment Guide

Complete guide for deploying the Chess Wagering Hook to Xahau network.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Hook Compilation](#hook-compilation)
4. [Hook Deployment](#hook-deployment)
5. [Frontend Configuration](#frontend-configuration)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)
8. [Production Checklist](#production-checklist)

## Prerequisites

### Required Tools

- **Xahau Account**: Hook deployment account with sufficient XAH balance
- **Hook Toolchain**: Clang/LLVM with WebAssembly target support
- **Node.js**: For frontend integration testing
- **Git**: For version control

### Recommended Balance

- **Testnet**: 1,000+ XAH for testing
- **Mainnet**: 100+ XAH for deployment and initial operations

## Development Environment Setup

### 1. Install Hook Development Tools

#### Option A: Docker (Recommended)

```bash
# Pull Hook development container
docker pull xahau/hook-builder:latest

# Run container with project mounted
docker run -it -v $(pwd):/workspace xahau/hook-builder:latest
```

#### Option B: Manual Installation

```bash
# Install LLVM/Clang with WebAssembly support
sudo apt update
sudo apt install clang llvm lld

# Download Hook-specific toolchain
wget https://github.com/XRPLF/hook-toolchain/releases/latest/download/hook-toolchain-linux.tar.gz
sudo tar -xzf hook-toolchain-linux.tar.gz -C /opt/
```

### 2. Verify Installation

```bash
# Check toolchain
/opt/hook-toolchain/bin/clang --version
/opt/hook-toolchain/bin/wasm-ld --version

# Test compilation
cd hooks/
make help
```

## Hook Compilation

### 1. Build Hook WASM

```bash
cd hooks/

# Clean previous builds
make clean

# Compile Hook
make all

# Verify output
ls -la chess-wagering.wasm
```

### 2. Validate WASM File

```bash
# Check file integrity
make validate

# Expected output:
# ✅ WASM file exists: chess-wagering.wasm
# chess-wagering.wasm: WebAssembly (wasm) binary module version 0x1 (MVP)
```

### 3. Optimize for Production

```bash
# For mainnet deployment, ensure optimization
CFLAGS="-O3 -flto" make clean all
```

## Hook Deployment

### 1. Prepare Hook Account

```bash
# Set environment variables (DO NOT commit these!)
export HOOK_ACCOUNT="rYourHookAccountAddress..."
export HOOK_SECRET="sYourHookAccountSecret..."

# Verify account has sufficient balance
xrpl-cli account info --account $HOOK_ACCOUNT --server wss://xahau-test.net
```

### 2. Deploy to Testnet

```bash
# Deploy to testnet first
./deploy-hook.sh chess-wagering.wasm testnet

# Wait for confirmation
# Check deployment status
```

### 3. Deploy to Mainnet

```bash
# ⚠️ CAUTION: This costs real XAH!
./deploy-hook.sh chess-wagering.wasm mainnet

# Monitor deployment
xrpl-cli account tx --account $HOOK_ACCOUNT --server wss://xahau.network
```

### 4. Manual Deployment (Alternative)

If automated deployment fails:

```bash
# Generate deployment transaction
make deploy

# Sign and submit hook-deploy.json manually
# Use xrpl-py, xrpl-js, or Xaman for signing
```

## Frontend Configuration

### 1. Update Environment Variables

```bash
# Add to .env.local
echo "NEXT_PUBLIC_HOOK_ADDRESS=\"$HOOK_ACCOUNT\"" >> .env.local

# Verify configuration
grep HOOK_ADDRESS .env.local
```

### 2. Test Hook Integration

```bash
# Start development server
pnpm dev

# Test Hook functions in browser console:
# - Check Hook state reading
# - Test payment transactions
# - Verify move submissions
```

### 3. Update Frontend Code

The Hook integration is already implemented in:
- `lib/xahau-hooks.ts` - Hook transaction functions
- `lib/hook-state-reader.ts` - State reading utilities
- `app/chess/page.tsx` - UI integration (placeholder)

## Testing & Verification

### 1. Hook State Verification

```bash
# Check Hook is deployed
xrpl-cli account info --account $HOOK_ACCOUNT

# Verify Hook code hash
xrpl-cli account objects --account $HOOK_ACCOUNT --type hook
```

### 2. Functional Testing

#### Test 1: Join Tournament

```javascript
// In browser console
const { joinTournamentHook } = await import('/lib/xahau-hooks.ts')

// Test joining (requires wallet connection)
// await joinTournamentHook(wallet, 10)
```

#### Test 2: Read Hook State

```javascript
// Test state reading
const { getWaitingRoomState } = await import('/lib/xahau-hooks.ts')
const waitingRoom = await getWaitingRoomState()
console.log('Waiting room:', waitingRoom)
```

#### Test 3: Submit Move

```javascript
// Test move submission
const { submitMoveHook } = await import('/lib/xahau-hooks.ts')
// await submitMoveHook(wallet, 'game123', 'e2e4')
```

### 3. Integration Testing

```bash
# Test complete flow:
# 1. Connect wallet
# 2. Join tournament via Hook
# 3. Wait for opponent
# 4. Play game with Hook moves
# 5. Verify prize distribution
```

## Troubleshooting

### Common Issues

#### 1. Compilation Errors

```bash
# Error: hookapi.h not found
# Solution: Install Hook toolchain properly
export HOOK_TOOLCHAIN=/opt/hook-toolchain
make clean all
```

#### 2. Deployment Failures

```bash
# Error: Insufficient XAH balance
# Solution: Fund Hook account
xrpl-cli account info --account $HOOK_ACCOUNT

# Error: Invalid WASM
# Solution: Recompile with correct flags
make clean && CFLAGS="-O3" make all
```

#### 3. Frontend Integration Issues

```bash
# Error: Hook address not found
# Solution: Set environment variable
echo "NEXT_PUBLIC_HOOK_ADDRESS=\"$HOOK_ACCOUNT\"" >> .env.local

# Error: Cannot read Hook state
# Solution: Verify Hook is deployed and active
```

### Debug Commands

```bash
# Check Hook transactions
xrpl-cli account tx --account $HOOK_ACCOUNT --limit 10

# Monitor Hook events
xrpl-cli subscribe --accounts $HOOK_ACCOUNT

# Validate Hook state
xrpl-cli account namespace --account $HOOK_ACCOUNT --namespace_id 02020000...
```

## Production Checklist

### Pre-Deployment

- [ ] Hook code reviewed and tested
- [ ] WASM file optimized for production
- [ ] Hook account funded with sufficient XAH
- [ ] Backup of Hook account credentials
- [ ] Frontend integration tested on testnet

### Deployment

- [ ] Deploy to testnet first
- [ ] Verify all Hook functions work
- [ ] Test complete user flow
- [ ] Deploy to mainnet
- [ ] Update frontend environment variables
- [ ] Monitor initial transactions

### Post-Deployment

- [ ] Hook state monitoring setup
- [ ] Error logging and alerting
- [ ] Performance metrics tracking
- [ ] User documentation updated
- [ ] Support team trained on Hook operations

### Security Considerations

- [ ] Hook account private key secured
- [ ] Environment variables not committed to git
- [ ] Hook code audited for vulnerabilities
- [ ] Rate limiting and abuse prevention
- [ ] Emergency procedures documented

## Monitoring & Maintenance

### Hook Health Monitoring

```bash
# Check Hook status
curl -X POST https://xahau.network \
  -H "Content-Type: application/json" \
  -d '{
    "method": "account_info",
    "params": [{
      "account": "'$HOOK_ACCOUNT'"
    }]
  }'
```

### Performance Metrics

- Transaction success rate
- Average response time
- Hook state size growth
- Error frequency and types

### Maintenance Tasks

- Regular Hook state cleanup
- Performance optimization
- Security updates
- User feedback integration

## Support & Resources

### Documentation

- [Xahau Hook Documentation](https://xahau.network/docs/hooks)
- [XRPL.js Documentation](https://js.xrpl.org/)
- [Hook API Reference](https://xahau.network/docs/hooks/api)

### Community

- [Xahau Discord](https://discord.gg/xahau)
- [XRPL Developer Discord](https://discord.gg/xrpl)
- [GitHub Issues](https://github.com/your-repo/issues)

### Emergency Contacts

- Hook Developer: [Your Contact]
- System Administrator: [Admin Contact]
- Xahau Support: [Support Contact]

---

## Quick Reference

### Essential Commands

```bash
# Compile Hook
make clean all

# Deploy to testnet
./deploy-hook.sh chess-wagering.wasm testnet

# Deploy to mainnet
./deploy-hook.sh chess-wagering.wasm mainnet

# Check Hook status
xrpl-cli account info --account $HOOK_ACCOUNT

# Monitor transactions
xrpl-cli account tx --account $HOOK_ACCOUNT
```

### Environment Variables

```bash
# Required for deployment
export HOOK_ACCOUNT="rYourHookAccountAddress..."
export HOOK_SECRET="sYourHookAccountSecret..."

# Required for frontend
NEXT_PUBLIC_HOOK_ADDRESS="rYourHookAccountAddress..."
```

### File Structure

```
hooks/
├── README.md              # Hook overview
├── chess-wagering.c       # Main Hook code
├── Makefile              # Build configuration
├── deploy-hook.sh        # Deployment script
└── chess-wagering.wasm   # Compiled Hook (generated)

docs/
└── HOOK_DEPLOYMENT.md    # This guide

lib/
├── xahau-hooks.ts        # Hook integration functions
└── hook-state-reader.ts  # State reading utilities
```

---

**⚠️ Important**: Always test on testnet before mainnet deployment. Keep your Hook account credentials secure and never commit them to version control.