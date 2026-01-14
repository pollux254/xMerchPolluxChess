# 🚀 Phase 1 Complete - Supabase Backend Setup

## ✅ What We Built

Phase 1 establishes the **Supabase backend architecture** that will handle all off-chain state management while the Xahau Hook handles on-chain validation and prize distribution.

### Deliverables

1. **ARCHITECTURE.md** - Complete system architecture documentation
2. **initial_schema.sql** - Full database schema with tables, views, functions, and policies
3. **chess-oracle.ts** - Edge function that syncs Xahau Hook state to Supabase
4. **chess-wagering.c** - Hook skeleton (from earlier work)

---

## 📊 Database Schema Overview

### Core Tables

#### 🏆 Tournaments
- Stores tournament metadata
- Syncs from Xahau Hook state
- Tracks status: waiting → active → complete

#### 👥 Tournament Players  
- Links players to tournaments
- Tracks placement and prizes
- Unique constraint per tournament

#### ♟️ Matches
- Individual chess games
- Stores board state (FEN notation)
- Time control tracking
- Result types: checkmate, resignation, time forfeit, material tiebreak

#### 📝 Moves
- Complete move history
- Algebraic notation (e4, Nf3, O-O)
- Time tracking per move
- Special move flags (castling, en passant, etc.)

#### 📊 Stats Tables
**ranked_stats** - Real money games:
- ELO rating & rank (Bronze → Diamond)
- Win/loss records
- Financial tracking (wagered, won, profit)

**practice_stats** - Bot games (completely separate):
- Practice ELO & rank (Beginner → Expert)
- Win/loss records
- No financial data

#### 🎮 Game History
- Complete games in PGN format
- Opening classification
- Time analysis
- Linked to tournaments or practice

---

## 🔧 Setup Instructions

### Step 1: Initialize Supabase Project

If you haven't already:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your existing project
cd /path/to/xMerchPolluxChess
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Run Database Migration

```bash
# Copy the migration file to your repo
cp initial_schema.sql supabase/migrations/20250115000000_initial_schema.sql

# Apply migration locally first (for testing)
supabase db reset

# Push to production when ready
supabase db push
```

### Step 3: Deploy Edge Functions

```bash
# Create edge function directories
mkdir -p supabase/functions/chess-oracle

# Copy oracle function
cp chess-oracle.ts supabase/functions/chess-oracle/index.ts

# Set required secrets
supabase secrets set \
  XAHAU_WSS="wss://xahau.network" \
  HOOK_ACCOUNT="rYourHookAccountAddress..." \
  SB_URL="https://your-project.supabase.co" \
  SB_SERVICE_ROLE_KEY="your-service-role-key"

# Deploy the oracle function
supabase functions deploy chess-oracle
```

### Step 4: Set Up Cron Job (Oracle)

The oracle should run every 5-10 seconds to keep Supabase in sync with the Hook.

**Option A: Using Supabase Edge Functions (recommended)**
```typescript
// In supabase/functions/chess-oracle/index.ts
// Add periodic trigger via pg_cron or external service
```

**Option B: Using external cron (Vercel Cron, GitHub Actions)**
```yaml
# .github/workflows/oracle-sync.yml
name: Oracle Sync
on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Oracle
        run: |
          curl -X POST https://your-project.supabase.co/functions/v1/chess-oracle \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

### Step 5: Verify Setup

```bash
# Check tables were created
supabase db dump

# Test edge function locally
supabase functions serve chess-oracle

# Trigger it manually
curl http://localhost:54321/functions/v1/chess-oracle
```

---

## 🗂️ File Structure in Your Repo

```
xMerchPolluxChess/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20250115000000_initial_schema.sql    ← NEW
│   └── functions/
│       ├── xaman-createPayload/
│       │   └── index.ts                          ← UPDATE (coming in Phase 2)
│       ├── xaman-webhook/
│       │   └── index.ts                          ← UPDATE (coming in Phase 2)
│       └── chess-oracle/                         ← NEW
│           └── index.ts
├── app/
│   └── (your Next.js pages)
└── lib/
    └── xahau-payload.ts
```

---

## 🔐 Environment Variables

### Supabase Secrets (set via `supabase secrets set`)
```bash
XAHAU_WSS=wss://xahau.network
HOOK_ACCOUNT=rYourHookAccount...
SB_URL=https://your-project.supabase.co
SB_SERVICE_ROLE_KEY=your-service-role-key
XUMM_API_KEY=your-xaman-key
XUMM_API_SECRET=your-xaman-secret
```

### Vercel Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_XAHAU_NETWORK_ID=21337
NEXT_PUBLIC_HOOK_ACCOUNT=rYourHookAccount...
```

---

## 📝 Database Features

### Views
- `leaderboard_ranked` - Top ranked players by ELO
- `leaderboard_practice` - Top practice players
- `active_matches` - Currently in-progress games

### Functions
- `update_ranked_stats()` - Updates stats after game completion
- `calculate_elo_change()` - ELO rating calculation

### Triggers
- Auto-create player profiles on first join
- Update last_active_at on every move

### Row Level Security (RLS)
- Public read access for leaderboards and game data
- Service role (edge functions) only for writes
- Users can update their own profiles

---

## 🎯 Next Steps (Phase 2)

Now that the backend is set up, Phase 2 will focus on:

1. **Update Xaman Edge Functions**
   - Create proper transaction payloads for JOIN, MOVE, RESIGN
   - Handle webhook events and update Supabase

2. **Frontend Integration**
   - Tournament lobby UI
   - Real-time match updates
   - Chess board with move validation
   - Xaman wallet integration

3. **Chess Engine (Hook)**
   - Complete the C code for move validation
   - Compile to WASM
   - Deploy to Xahau testnet

---

## 🧪 Testing Checklist

- [ ] Database tables created successfully
- [ ] Sample data inserted (test players)
- [ ] Leaderboard views working
- [ ] Oracle function deploys without errors
- [ ] Oracle can connect to Xahau network
- [ ] RLS policies allow public reads
- [ ] Edge functions can write to database
- [ ] Cron job triggers oracle periodically

---

## 🆘 Troubleshooting

### "Cannot connect to Xahau network"
- Check XAHAU_WSS is set correctly
- Verify network is reachable: `wscat -c wss://xahau.network`

### "Permission denied" when writing to tables
- Ensure you're using service role key in edge functions
- Check RLS policies allow service role writes

### "Migration already applied"
- Supabase tracks migrations by timestamp
- If you need to reapply, use `supabase db reset` locally
- For production, create a new migration file

### Oracle not syncing
- Check edge function logs: `supabase functions logs chess-oracle`
- Verify secrets are set: `supabase secrets list`
- Test manually: `curl YOUR_FUNCTION_URL`

---

## 📚 Resources

- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Xahau Network Docs](https://docs.xahau.network)

---

## ✅ Phase 1 Status

- [x] Architecture documented
- [x] Database schema designed
- [x] Migration file created
- [x] Oracle edge function created
- [x] RLS policies defined
- [x] Setup instructions written
- [ ] Phase 2: Frontend & Xaman integration (next)

---

**Great work!** 🎉 Your backend is now ready. When you're ready for Phase 2, we'll wire up the frontend and complete the Xaman integration.
