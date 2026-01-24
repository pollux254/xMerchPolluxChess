# Tournament Hook Deployment Log

## Current Version: v2.0

---

## v2.0 - Prize Distribution (January 24, 2026)

### Features
- ✅ Automatic prize distribution via Invoke transaction
- ✅ 89% to winner, 11% to platform
- ✅ Two HookEmit transactions (winner + platform)
- ✅ State reset after distribution
- ✅ Handles variable prize pools

### Deployment Details
- **Network:** Xahau Testnet
- **Hook Account:** `rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh`
- **Deployed:** January 24, 2026
- **Status:** ✅ Active and tested

### Test Results
- ✅ Entry fee validation: Working perfectly
- ✅ Player count tracking: Increments correctly, persists across transactions
- ✅ Prize distribution: Both payments executed successfully
- ✅ Platform fee: Working (11% accurate - 4.4 XAH from 40 XAH pool)
- ✅ State reset: Player count reset to 0 after distribution
- ✅ Amount validation: Correctly rejects non-10 XAH payments

### Testing Accounts Used
- **Alice (Hook Account):** rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh
  - Initial Balance: 999.54 XAH
  - Used as: Hook deployment account
- **Bob (Test Player):** rpNkP1Vs9BcbaVibZWok5RL8zqjEPc6FtX
  - Initial Balance: 1000 XAH
  - Used as: Test player and Invoke transaction signer
- **Platform (Fee Receiver):** r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6
  - Used as: Platform fee destination (11%)

### Hook Configuration
- **Invoke Triggers:** ttPAYMENT, ttINVOKE
- **Deployment Fee:** 5890 drops (recommended for complex Hooks)
- **State Key:** PLX_PLAYER_COUNT (32 bytes, hex-padded)
- **Entry Fee:** 10 XAH (10,000,000 drops)

### Test Transactions
**Entry Fee Tests:**
- Test Payment 1 (Bob → Alice, 10 XAH): ✅ Accepted, player_count: 1
- Test Payment 2 (Bob → Alice, 10 XAH): ✅ Accepted, player_count: 2, "Tournament ready!"
- Test Payment 3 (Bob → Alice, 5 XAH): ❌ Rejected, "Entry fee is 10 XAH"
- Prize Pool Accumulated: 40 XAH (4 players total from multiple tests)

**Prize Distribution Test:**
- Invoke Transaction: ✅ SUCCESS (tesSUCCESS)
- Prize Pool: 40 XAH
- Winner Payment: 35.6 XAH (89%)
- Platform Payment: 4.4 XAH (11%)
- Two HookEmit Transactions: ✅ Executed
- Player Count Reset: ✅ Reset to 0

**Invoke Transaction JSON Used:**
```json
{
  "TransactionType": "Invoke",
  "Account": "rpNkP1Vs9BcbaVibZWok5RL8zqjEPc6FtX",
  "Destination": "rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh",
  "InvokeID": "0000000000000000000000000000000000000000000000000000000000000001",
  "Fee": "5890",
  "HookParameters": [{
    "HookParameter": {
      "HookParameterName": "77696E6E6572",
      "HookParameterValue": "FBA7C01447E7BC4ED14A2852897CE846E3700FA0"
    }
  }]
}
```

**Note:** Winner parameter value is the hex-encoded address of r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6 (platform wallet used for testing)

---

## v1.0 - Entry Fee Validation (January 24, 2026)

### Features
- ✅ Accept exactly 10 XAH payments
- ✅ Track player count in Hook state
- ✅ Reject invalid payment amounts
- ✅ Log "Tournament ready!" status

### Deployment Details
- **Network:** Xahau Testnet
- **Hook Account:** `rpbvh5LmrV17BVCu5fAc1ybKev1pFa8evh`
- **Deployed:** January 24, 2026
- **Status:** Replaced by v2.0

### Test Results
- ✅ Accepted 10 XAH payments
- ✅ Rejected 5 XAH payment (wrong amount)
- ✅ Player count incremented correctly
- ✅ State persisted across transactions

---

## Future Versions

### v3.0 - Planned Features
- [ ] Variable entry fees (parameter-based)
- [ ] Multiple simultaneous tournaments
- [ ] Multi-winner payouts (top 3)
- [ ] Refund mechanism for cancelled tournaments
- [ ] Admin controls via Invoke parameters

### Mainnet Deployment - Pending
- [ ] Create dedicated mainnet Hook account
- [ ] Fund with ~50 XAH reserve
- [ ] Deploy Hook to mainnet
- [ ] Test with small amounts (1 XAH tournaments)
- [ ] Monitor first 5-10 tournaments
- [ ] Update environment variables
- [ ] Update documentation

---

## Rollback Procedure

If Hook needs to be reverted:

1. **Identify Issue:**
   - Check transaction logs
   - Review error messages
   - Test on separate testnet account

2. **Deploy Previous Version:**
   - Get previous Hook code from Git
   - Compile in Hooks Builder
   - Deploy to same Hook account (overwrites)

3. **Notify Users:**
   - Post maintenance notice
   - Pause new tournament creation
   - Complete active tournaments

4. **Verify Rollback:**
   - Test entry fee payments
   - Test prize distribution
   - Monitor for 24 hours

---

## Notes

### Compilation
- **Language:** C
- **Compiler:** Hooks Builder (https://hooks-builder.xrpl.org/develop)
- **Output:** WASM (922 bytes)
- **Guard Function:** `_g(1,1)` required at line 11
- **Compilation Issues Resolved:**
  - Fixed state key to 32 bytes (was 1 byte initially)
  - Added proper guard function call
  - Fixed fee from 12 drops → 250-5890 drops
  - Fixed `PREPARE_PAYMENT_SIMPLE_SIZE` macro usage

### State Management
- **Key:** `PLX_PLAYER_COUNT` (32 bytes)
- **Value:** Integer (player count)
- **Reset:** After prize distribution

### Transaction Types
- **ttPAYMENT:** Entry fee validation
- **ttINVOKE:** Prize distribution trigger

### Platform Fee
- **Address:** `r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6`
- **Hardcoded:** Yes (requires redeployment to change)
- **Percentage:** 11% of prize pool

---

## Changelog Format

```markdown
## vX.Y - Feature Name (Date)

### Features
- Feature description

### Deployment Details
- Network:
- Hook Account:
- Deployed:
- Status: 

### Test Results
- Test description: Status

### Test Transactions
- Test name: TX hash
```

---

**Last Updated:** January 24, 2026 (23:00 UTC)  
**Maintainer:** PolluxChess Team  
**Hook Version:** v2.0 (Active on Testnet)  
**Next Milestone:** Mainnet deployment after frontend integration testing