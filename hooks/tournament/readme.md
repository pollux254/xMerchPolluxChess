# PolluxChess Xahau Hooks

This directory contains all smart contract (Hook) code for PolluxChess.

## 🎯 Overview

PolluxChess uses Xahau Hooks for trustless tournament escrow and automated prize distribution. No centralized server holds funds - everything is managed by on-chain smart contracts.

## 📦 Deployed Hooks

### Tournament Hook
- **Location:** [`/hooks/tournament/`](./tournament/)
- **Purpose:** Trustless tournament escrow and prize distribution
- **Status:** ✅ Active on testnet
- **Version:** v2.0
- **Docs:** [tournament/README.md](./tournament/README.md)

## 🔧 Development

### Hooks Builder
All Hooks are developed using the official Hooks Builder:
- **URL:** https://hooks-builder.xrpl.org/develop
- **Repo:** https://github.com/Handy4ndy/XahauHooks101

### Testing
- **Network:** Xahau Testnet
- **Explorer:** https://explorer.xahau-test.net
- **Faucet:** https://xahau-test.net/

### Deployment Workflow
1. Write Hook code in Hooks Builder
2. Compile to WASM
3. Deploy to testnet Hook account
4. Test thoroughly with multiple scenarios
5. Update documentation with deployment details
6. Deploy to mainnet when ready

## 🌐 Networks

### Testnet (Current)
- **Hook Account:** `rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh`
- **Platform Wallet:** `r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6`
- **Explorer:** https://explorer.xahau-test.net

### Mainnet (Future)
- **Hook Account:** `[TO BE DEPLOYED]`
- **Platform Wallet:** `r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6`
- **Explorer:** https://explorer.xahau.network

## 📚 Resources

- **Hooks Documentation:** https://docs.xahau.network/technical/hooks
- **Hooks Examples:** https://github.com/Handy4ndy/XahauHooks101
- **Xahau Network:** https://xahau.network
- **Hooks Builder:** https://hooks-builder.xrpl.org

## 🔐 Security

- Hook accounts hold active tournament prize pools
- Private keys stored securely (never in Git)
- Admin wallet only signs Invoke transactions
- Platform fees automatically distributed to secure wallet

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for the Xahau ecosystem**