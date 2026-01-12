# 🤖 PolluxChess Bot Play System - Complete Specification

## 📋 Overview
The bot play system offers free practice against AI opponents with varying difficulty levels, XRP/XRPL-themed personalities, and NFT rewards. This is completely separate from ranked tournaments and provides a fun, educational way to improve chess skills while learning about the XRP ecosystem.

---

## 🎯 Core Features

### 1. Rank-Based Difficulty System (0-1000)

**Difficulty Tiers:**
```
Rookie (0-200):        Stockfish depth 1-3,  Beginner-friendly
Beginner (201-400):    Stockfish depth 4-6,  Learning phase
Intermediate (401-600): Stockfish depth 7-10, Challenging
Advanced (601-800):    Stockfish depth 11-15, Strong play
Expert (801-1000):     Stockfish depth 16-20, Near-perfect
```

**Implementation:**
- Player selects rank before game starts
- Bot strength determined by Stockfish evaluation depth
- Higher rank = deeper analysis = stronger moves
- Each tier has distinct playing characteristics

---

### 2. Bot Personalities & Themes

**Every bot is themed around XRP/XRPL ecosystem entities**

#### Example Bots (50+ total across all ranks):

**Rookie Tier (0-200):**
```typescript
{
  name: "Rookie Ripple",
  rank: 100,
  avatar: "💧",
  style: "Cautious",
  bio: "Just learning about cross-border payments! Ripple enables instant, low-cost international money transfers.",
  funFact: "Ripple was founded in 2012 as OpenCoin",
  gamesPlayed: 847,
  winRate: 23%,
  favoriteOpening: "Italian Game"
}

{
  name: "XRP Newbie",
  rank: 150,
  avatar: "🌊",
  style: "Random",
  bio: "Discovering the digital asset XRP! Used for liquidity in the RippleNet payment network.",
  funFact: "XRP has a max supply of 100 billion coins",
  gamesPlayed: 1203,
  winRate: 31%,
  favoriteOpening: "King's Pawn Opening"
}
```

**Beginner Tier (201-400):**
```typescript
{
  name: "Ledger Larry",
  rank: 300,
  avatar: "📒",
  style: "Defensive",
  bio: "Learning about the XRP Ledger! A decentralized, open-source blockchain optimized for payments.",
  funFact: "XRPL can process 1500 transactions per second",
  gamesPlayed: 2104,
  winRate: 45%,
  favoriteOpening: "French Defense"
}

{
  name: "Validator Vera",
  rank: 350,
  avatar: "✅",
  style: "Balanced",
  bio: "Validators secure the XRPL network through consensus, not mining!",
  funFact: "XRPL uses a unique consensus protocol, not Proof of Work",
  gamesPlayed: 1889,
  winRate: 49%,
  favoriteOpening: "Sicilian Defense"
}
```

**Intermediate Tier (401-600):**
```typescript
{
  name: "DEX Diana",
  rank: 500,
  avatar: "🔄",
  style: "Aggressive",
  bio: "Expert in XRPL's built-in Decentralized Exchange! Trade assets directly on-chain.",
  funFact: "XRPL DEX has been running since 2012",
  gamesPlayed: 3421,
  winRate: 58%,
  favoriteOpening: "King's Indian Attack"
}

{
  name: "Xahau Xavier",
  rank: 550,
  avatar: "🪝",
  style: "Tactical",
  bio: "Xahau is an XRPL sidechain with Hooks (smart contracts)! This game runs on Xahau Hooks.",
  funFact: "Hooks enable programmable logic on the XRPL",
  gamesPlayed: 2967,
  winRate: 61%,
  favoriteOpening: "Queen's Gambit"
}
```

**Advanced Tier (601-800):**
```typescript
{
  name: "PayString Pat",
  rank: 700,
  avatar: "💳",
  style: "Positional",
  bio: "PayString simplifies payment addressing across blockchains. One address for all!",
  funFact: "PayString was created by Ripple in 2020",
  gamesPlayed: 4582,
  winRate: 71%,
  favoriteOpening: "English Opening"
}

{
  name: "IOU Isaac",
  rank: 750,
  avatar: "🎫",
  style: "Strategic",
  bio: "IOUs on XRPL represent debt or credit between parties. Trust lines enable this!",
  funFact: "XRPL supports any currency as an IOU",
  gamesPlayed: 5203,
  winRate: 74%,
  favoriteOpening: "Ruy Lopez"
}
```

**Expert Tier (801-1000):**
```typescript
{
  name: "Consensus Carl",
  rank: 900,
  avatar: "🤝",
  style: "Precise",
  bio: "Master of XRPL's consensus protocol! Ledgers close in 3-5 seconds with finality.",
  funFact: "XRPL consensus doesn't fork - transactions are final",
  gamesPlayed: 7891,
  winRate: 82%,
  favoriteOpening: "Nimzo-Indian Defense"
}

{
  name: "GrandMaster Ripple",
  rank: 1000,
  avatar: "👑",
  style: "Perfect",
  bio: "The ultimate XRPL expert! Built for enterprise-grade global payments since 2012.",
  funFact: "Over 300 financial institutions use RippleNet",
  gamesPlayed: 12847,
  winRate: 89%,
  favoriteOpening: "Sicilian Najdorf"
}
```

**Additional Bot Themes:**
- Escrow Eddie (knows about XRPL escrow)
- NFT Nancy (XRPL NFT expert)
- AMM Amy (Automated Market Maker)
- Trustline Tommy (trust line mechanics)
- Multisign Mike (multi-signature accounts)
- Pathfinding Penny (payment paths)
- Evernode Eva (Evernode hosting)
- XUMM Uma (Xaman wallet)
- Ledger Lucy (ledger structure)
- Transaction Tim (transaction types)

---

### 3. Bot Thinking Time (Randomized & Rank-Scaled)

**Thinking Duration:**
```typescript
function getBotThinkingTime(rank: number): number {
  let baseMin: number;
  let baseMax: number;
  
  if (rank <= 200) {
    baseMin = 1;
    baseMax = 5;
  } else if (rank <= 400) {
    baseMin = 3;
    baseMax = 10;
  } else if (rank <= 600) {
    baseMin = 5;
    baseMax = 15;
  } else if (rank <= 800) {
    baseMin = 10;
    baseMax = 20;
  } else {
    baseMin = 15;
    baseMax = 30;
  }
  
  // Add slight randomization (±20%)
  const variance = 0.2;
  const min = baseMin * (1 - variance);
  const max = baseMax * (1 + variance);
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

**Visual Feedback:**
- Show "Bot is thinking..." message
- Animated thinking indicator (pulsing bot avatar)
- Optional: Show evaluation bar changing
- Show time elapsed: "Thinking... 3s"

---

### 4. NFT Reward System

**Earning Mechanics:**

#### A) Randomized Win Streak Rewards
```typescript
// NFT drops every ~25 bot wins (randomized 22-28)
const NFT_DROP_AVERAGE = 25;
const NFT_DROP_VARIANCE = 3; // ±3 games

function checkNFTDrop(playerWins: number): boolean {
  const nextDrop = NFT_DROP_AVERAGE + (Math.random() * NFT_DROP_VARIANCE * 2 - NFT_DROP_VARIANCE);
  return playerWins >= Math.floor(nextDrop);
}
```

#### B) Milestone Achievements
```typescript
const MILESTONES = [
  { rank: 200,  nft: "Rookie Master Badge",    rarity: "common" },
  { rank: 400,  nft: "Beginner Victor Medal",  rarity: "uncommon" },
  { rank: 600,  nft: "Intermediate Champion",  rarity: "rare" },
  { rank: 800,  nft: "Advanced Grandmaster",   rarity: "epic" },
  { rank: 1000, nft: "Legendary XRPL Master",  rarity: "legendary" }
];

// First-time beating each tier unlocks milestone NFT
```

#### C) Special Achievements
```typescript
const ACHIEVEMENTS = [
  {
    id: "first_blood",
    name: "First Victory",
    description: "Win your first bot game",
    nft: "Beginner's Trophy",
    rarity: "common"
  },
  {
    id: "speedrun",
    name: "Speed Demon",
    description: "Win in under 20 moves",
    nft: "Blitz Master Badge",
    rarity: "rare"
  },
  {
    id: "flawless",
    name: "Flawless Victory",
    description: "Win without losing any pieces",
    nft: "Perfect Game Medal",
    rarity: "epic"
  },
  {
    id: "gauntlet",
    name: "Bot Gauntlet",
    description: "Beat all 10 difficulty tiers in order",
    nft: "Gauntlet Champion Crown",
    rarity: "legendary"
  },
  {
    id: "streak_10",
    name: "Win Streak Master",
    description: "Win 10 games in a row",
    nft: "Streak Master Badge",
    rarity: "epic"
  }
];
```

#### D) Legendary Random Drops
```typescript
// ANY win against ANY rank has small chance for legendary NFT
const LEGENDARY_DROP_CHANCE = 0.001; // 0.1% per game

// Higher rank = slightly higher chance
function getLegendaryChance(botRank: number): number {
  const baseChance = 0.001;
  const rankBonus = (botRank / 1000) * 0.004; // +0.4% at rank 1000
  return baseChance + rankBonus;
}
```

**NFT Rarity Tiers:**
- Common (60%): Basic achievement badges
- Uncommon (25%): Milestone rewards
- Rare (10%): Special achievements
- Epic (4%): Difficult achievements
- Legendary (1%): Random drops, ultimate achievements

---

### 5. Bot Stats & History Tracking

**Per-Bot Stats (stored in Supabase):**
```typescript
interface BotProfile {
  bot_id: string;
  name: string;
  rank: number;
  avatar: string;
  style: string;
  bio: string;
  fun_fact: string;
  
  // Stats
  total_games_played: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  win_rate: number; // calculated
  
  // Patterns
  favorite_opening: string;
  avg_game_length_moves: number;
  longest_game_moves: number;
  shortest_win_moves: number;
  
  // Meta
  times_beaten: number;
  most_beaten_by: string; // player wallet who beat it most
  created_at: timestamp;
}
```

**Player vs Bot Stats:**
```typescript
interface PlayerBotRecord {
  player_address: string;
  bot_id: string;
  
  // Record
  wins: number;
  losses: number;
  draws: number;
  
  // Achievements
  current_streak: number;
  best_streak: number;
  fastest_win_moves: number;
  fastest_win_time: number; // seconds
  
  // Progress
  first_played: timestamp;
  last_played: timestamp;
  total_games: number;
}
```

**Global Bot Stats:**
```typescript
interface GlobalBotStats {
  // Most popular
  most_played_bot: string;
  most_beaten_bot: string;
  least_beaten_bot: string;
  
  // Difficulty insights
  avg_rank_played: number;
  most_common_rank_range: string; // "401-600"
  
  // Community
  total_bot_games_played: number;
  total_nfts_earned: number;
}
```

---

### 6. Playing Styles Implementation

**Bot behavior based on style:**

```typescript
enum BotStyle {
  CAUTIOUS = "Cautious",      // Defensive, piece safety priority
  RANDOM = "Random",           // Unpredictable, occasional mistakes
  DEFENSIVE = "Defensive",     // Solid, few risks
  BALANCED = "Balanced",       // Mix of attack/defense
  AGGRESSIVE = "Aggressive",   // Attacks king, sacrifices
  TACTICAL = "Tactical",       // Combination-focused
  POSITIONAL = "Positional",   // Long-term planning
  STRATEGIC = "Strategic",     // Endgame-focused
  PRECISE = "Precise",         // Optimal moves only
  PERFECT = "Perfect"          // Near-perfect play
}

// Stockfish parameters adjusted per style
function getStockfishParams(style: BotStyle, rank: number) {
  const baseDepth = Math.floor(rank / 50); // 0-20
  
  switch(style) {
    case BotStyle.CAUTIOUS:
      return { depth: baseDepth, contempt: -50 }; // Avoid risks
    case BotStyle.AGGRESSIVE:
      return { depth: baseDepth, contempt: 50 };  // Take risks
    case BotStyle.RANDOM:
      return { depth: Math.max(1, baseDepth - 2), randomness: 0.3 };
    case BotStyle.PERFECT:
      return { depth: Math.max(baseDepth, 18), contempt: 0 };
    default:
      return { depth: baseDepth, contempt: 0 };
  }
}
```

---

## 🔧 Technical Implementation

### Database Schema (Supabase)

```sql
-- Bot profiles table
CREATE TABLE bot_profiles (
  bot_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank INT NOT NULL CHECK (rank >= 0 AND rank <= 1000),
  avatar TEXT NOT NULL,
  style TEXT NOT NULL,
  bio TEXT NOT NULL,
  fun_fact TEXT NOT NULL,
  favorite_opening TEXT,
  
  -- Stats
  total_games_played INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  total_draws INT DEFAULT 0,
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player vs bot records
CREATE TABLE player_bot_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_address TEXT NOT NULL,
  bot_id TEXT NOT NULL REFERENCES bot_profiles(bot_id),
  
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  fastest_win_moves INT,
  fastest_win_time INT,
  
  first_played TIMESTAMPTZ DEFAULT NOW(),
  last_played TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(player_address, bot_id)
);

-- Bot game history
CREATE TABLE bot_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_address TEXT NOT NULL,
  bot_id TEXT NOT NULL REFERENCES bot_profiles(bot_id),
  
  result TEXT NOT NULL, -- 'win', 'loss', 'draw'
  moves_count INT NOT NULL,
  game_duration_seconds INT NOT NULL,
  pgn TEXT NOT NULL,
  final_fen TEXT NOT NULL,
  
  player_elo_before INT,
  player_elo_after INT,
  
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFT achievements (prepare for Hook integration)
CREATE TABLE nft_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_address TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  nft_name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  transaction_hash TEXT,
  
  -- For Hook integration later
  hook_state_key TEXT,
  nft_token_id TEXT
);

-- Indexes
CREATE INDEX idx_player_bot_records_player ON player_bot_records(player_address);
CREATE INDEX idx_bot_games_player ON bot_games(player_address);
CREATE INDEX idx_nft_achievements_player ON nft_achievements(player_address);
```

---

### Frontend Components

```typescript
// Bot selection component
interface BotSelectionProps {
  onSelectBot: (bot: BotProfile) => void;
}

// Bot game board component
interface BotGameBoardProps {
  bot: BotProfile;
  playerColor: 'white' | 'black';
  onGameEnd: (result: GameResult) => void;
}

// Bot stats display
interface BotStatsProps {
  bot: BotProfile;
  playerRecord?: PlayerBotRecord;
}

// NFT achievement popup
interface NFTAchievementPopupProps {
  achievement: NFTAchievement;
  onClaim: () => void;
}
```

---

### API Endpoints

```typescript
// Get all available bots (with filters)
GET /api/bots
  ?rank_min=0
  &rank_max=1000
  &style=Aggressive

// Get specific bot profile
GET /api/bots/:bot_id

// Get player's record vs specific bot
GET /api/bots/:bot_id/record
  ?player_address=rXXX...

// Start bot game
POST /api/bots/start-game
  body: { bot_id, player_address, player_color }

// Submit bot game result
POST /api/bots/end-game
  body: { game_id, result, pgn, moves_count, duration }

// Check for NFT rewards
GET /api/bots/check-nft-reward
  ?player_address=rXXX...

// Claim NFT (prepare for Hook)
POST /api/bots/claim-nft
  body: { achievement_id, player_address }
```

---

## 🪝 Xahau Hook Integration (Future)

**Prepare code skeleton for Hook-based NFT distribution:**

```c
// In chess-wagering.c (separate handler for bot NFTs)

#define ACT_CLAIM_BOT_NFT 10

typedef struct {
    uint8_t player[20];
    uint8_t achievement_id[32];
    uint8_t nft_token_id[32];
    uint8_t rarity; // 0=common, 1=uncommon, 2=rare, 3=epic, 4=legendary
    uint64_t earned_at;
    uint8_t claimed;
} BotNFTClaim;

static int64_t handle_claim_bot_nft(uint32_t reserved)
{
    // 1. Load achievement from Hook state
    BotNFTClaim claim;
    // load_bot_nft_claim(g_parsed_memo.achievement_id, &claim);
    
    // 2. Verify player earned this achievement
    // Check backend oracle signature
    
    // 3. Verify not already claimed
    if (claim.claimed != 0) {
        rollback(SBUF("NFT already claimed"), 1);
    }
    
    // 4. Send NFT to player
    // emit_nft_transfer(claim.player, claim.nft_token_id);
    
    // 5. Mark as claimed
    claim.claimed = 1;
    // save_bot_nft_claim(&claim);
    
    accept(SBUF("Bot NFT claimed"), 0);
    return 0;
}
```

**Backend Oracle:**
```typescript
// Verify player earned achievement
async function verifyBotNFTEarned(
  playerAddress: string,
  achievementId: string
): Promise<boolean> {
  // Check Supabase for achievement record
  const { data } = await supabase
    .from('nft_achievements')
    .select('*')
    .eq('player_address', playerAddress)
    .eq('achievement_id', achievementId)
    .single();
    
  return !!data && !data.claimed;
}

// Submit achievement to Hook
async function submitBotNFTToHook(
  playerAddress: string,
  achievement: NFTAchievement
) {
  // Create Hook transaction
  const tx = {
    TransactionType: "Invoke",
    Account: ORACLE_ACCOUNT,
    Memos: [{
      Memo: {
        MemoData: stringToHex(JSON.stringify({
          action: "CLAIM_BOT_NFT",
          player: playerAddress,
          achievement_id: achievement.id,
          nft_token_id: achievement.nft_token_id,
          rarity: achievement.rarity
        }))
      }
    }]
  };
  
  // Sign and submit
  // ...
}
```

---

## 🎮 User Experience Flow

### 1. Bot Selection Screen
```
┌─────────────────────────────────────┐
│  🤖 Choose Your Opponent            │
├─────────────────────────────────────┤
│                                     │
│  Difficulty: [Slider: 0 ──●── 1000] │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💧 Rookie Ripple            │   │
│  │ Rank: 100 | Cautious        │   │
│  │ Win Rate: 23%               │   │
│  │ "Learning about payments!"  │   │
│  │                             │   │
│  │ Your Record: 5-2-1          │   │
│  │ [Play] [View Stats]         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🌊 XRP Newbie               │   │
│  │ Rank: 150 | Random          │   │
│  │ ...                         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 2. In-Game Display
```
┌─────────────────────────────────────┐
│  💧 Rookie Ripple (Rank 100)        │
│  ⏱️ Bot is thinking... 3s            │
│  📊 Evaluation: +0.5                 │
├─────────────────────────────────────┤
│                                     │
│        [Chess Board Here]           │
│                                     │
├─────────────────────────────────────┤
│  You: ⏱️ 18:23                       │
│  Captures: ♟️♟️♞                     │
│                                     │
│  [Resign] [Offer Draw ❌]           │
└─────────────────────────────────────┘
```

### 3. Post-Game NFT Reward
```
┌─────────────────────────────────────┐
│  🎉 Victory!                        │
├─────────────────────────────────────┤
│  You defeated Rookie Ripple!        │
│  Your rank: 1215 → 1223 (+8)       │
│                                     │
│  ✨ NFT UNLOCKED! ✨                │
│                                     │
│  🏆 "Beginner's Trophy"             │
│  Rarity: Common                     │
│  Achievement: First bot win!        │
│                                     │
│  [Claim NFT] (Coming Soon via Hook) │
│  [Play Again] [Change Bot]          │
└─────────────────────────────────────┘
```

---

## 📊 Analytics & Tracking

**Metrics to track:**
- Most played bot rank range
- Average game length per rank
- Win rates by player ELO vs bot rank
- NFT distribution: common vs legendary ratio
- Peak play times
- Bot difficulty preferences

**Leaderboards:**
- Highest bot rank beaten
- Most bot games played
- Most NFTs earned
- Fastest wins per rank tier
- Current win streaks

---

## 🚀 Implementation Phases

### Phase 1: Core Bot System (Week 1)
- [ ] Create 50+ bot profiles with XRP/XRPL themes
- [ ] Implement rank-based Stockfish difficulty
- [ ] Add bot selection UI
- [ ] Integrate Stockfish.js for move generation
- [ ] Implement randomized thinking time
- [ ] Visual thinking indicator

### Phase 2: Stats & History (Week 2)
- [ ] Database schema setup
- [ ] Track per-bot stats
- [ ] Track player vs bot records
- [ ] Game history with PGN storage
- [ ] Bot profile pages
- [ ] Player's bot stats page

### Phase 3: NFT System (Week 3)
- [ ] Achievement tracking system
- [ ] Milestone detection
- [ ] Random NFT drop logic (every ~25 wins)
- [ ] Legendary drop chance calculation
- [ ] NFT achievement popup UI
- [ ] Prepare Hook integration skeleton

### Phase 4: Advanced Features (Week 4)
- [ ] Playing style variations
- [ ] Post-game analysis
- [ ] Bot challenges/achievements
- [ ] Bot leaderboards
- [ ] Fun facts/bios display
- [ ] Achievement showcase page

### Phase 5: Hook Integration (Future)
- [ ] Deploy NFT claim Hook
- [ ] Oracle service for achievement verification
- [ ] On-chain NFT minting
- [ ] Claim NFT UI integration
- [ ] Transaction verification

---

## 🎨 Bot Avatar & Theme Ideas

**Avatar Emojis:**
- 💧 🌊 📒 ✅ 🔄 🪝 💳 🎫 🤝 👑
- 🔐 🌐 ⚡ 📡 🛡️ 🎯 🧩 🔮 💎 🎪
- 🚀 🌟 ⭐ 💫 ✨ 🌈 🎨 🎭 🎪 🎡

**Theme Categories:**
1. Core XRPL (Ripple, XRP, Ledger, Validator)
2. DeFi (DEX, AMM, IOU, Escrow)
3. Technology (Hooks, Consensus, Pathfinding)
4. Ecosystem (Xahau, Evernode, XUMM, NFTs)
5. Features (Multisig, Trustlines, PayString)

---

## 🔐 Security Considerations

**NFT Distribution:**
- Backend verification before Hook claim
- Rate limiting on achievement checks
- Prevent duplicate NFT claims
- Validate achievement legitimacy

**Game Integrity:**
- Server-side move validation
- Prevent game state manipulation
- Stockfish randomness seed security
- Anti-cheat for bot games

---

## 📝 Notes & Future Ideas

**Potential Additions:**
- Bot tournaments (play gauntlet mode)
- Daily bot challenges
- Bot of the day (special rewards)
- Training mode (bot shows hints)
- Opening trainer (bot practices specific openings)
- Puzzle mode (bot creates positions)
- Seasonal bot skins
- Community-voted bot names
- Bot difficulty calibration based on player ELO

**Educational Integration:**
- Each bot teaches one XRPL concept
- Post-game fun fact about the bot's theme
- Links to XRPL documentation
- "Learn More" button for each bot topic

---

## ✅ Success Criteria

**Bot system is complete when:**
1. ✅ 50+ themed bots available across all ranks
2. ✅ Stockfish integration working smoothly
3. ✅ Randomized thinking time feels natural
4. ✅ Stats tracking accurately
5. ✅ NFT achievement system functional (UI ready)
6. ✅ Hook code skeleton prepared for future deployment
7. ✅ Players enjoy and learn from bot personalities
8. ✅ Separate practice stats working correctly

---

**Last Updated:** January 2025
**Version:** 1.0 (Initial Bot System Spec)
**Status:** Ready for Implementation