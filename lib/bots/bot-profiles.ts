import type { BotProfile } from "./types";

// Phase 1 “database”: in-repo static profiles.
// Later phases can move this to Supabase and keep this as seed data.
export const BOT_PROFILES: BotProfile[] = [
  // Rookie (0-200)
  {
    botId: "rookie_ripple",
    name: "Rookie Ripple",
    rank: 100,
    avatar: "💧",
    style: "Cautious",
    bio: "Just learning about cross-border payments! Ripple enables instant, low-cost international money transfers.",
    funFact: "Ripple was founded in 2012 as OpenCoin",
    favoriteOpening: "Italian Game",
  },
  {
    botId: "xrp_newbie",
    name: "XRP Newbie",
    rank: 150,
    avatar: "🌊",
    style: "Random",
    bio: "Discovering the digital asset XRP! Used for liquidity in the RippleNet payment network.",
    funFact: "XRP has a max supply of 100 billion coins",
    favoriteOpening: "King's Pawn Opening",
  },
  { botId: "faucet_fred", name: "Faucet Fred", rank: 80, avatar: "🚰", style: "Random", bio: "Hands out tiny amounts and tiny tactics. Great for first games.", funFact: "Testnets often use faucets so devs can experiment", favoriteOpening: "Four Knights Game" },
  { botId: "memo_mina", name: "Memo Mina", rank: 120, avatar: "📝", style: "Cautious", bio: "Always reads the memo field… and your threats.", funFact: "XRPL transactions can include memos for arbitrary data", favoriteOpening: "London System" },
  { botId: "bridge_ben", name: "Bridge Ben", rank: 190, avatar: "🌉", style: "Defensive", bio: "Loves safe development: testnet → devnet → mainnet.", funFact: "Bridges can move assets across networks", favoriteOpening: "Caro-Kann Defense" },
  { botId: "airdrop_ava", name: "Airdrop Ava", rank: 60, avatar: "🎁", style: "Random", bio: "Surprise tactics like surprise drops.", funFact: "Airdrops distribute tokens to many accounts", favoriteOpening: "Italian Game" },
  { botId: "xrp_xander", name: "XRP Xander", rank: 140, avatar: "💎", style: "Balanced", bio: "Bullish on development, cautious on tactics.", funFact: "XRP is often used as a bridge asset", favoriteOpening: "King's Pawn Opening" },
  { botId: "fee_fiona", name: "Fee Fiona", rank: 170, avatar: "🪙", style: "Cautious", bio: "Always counts the cost before trading pieces.", funFact: "XRPL fees are tiny and burn XRP", favoriteOpening: "French Defense" },
  { botId: "sequence_sid", name: "Sequence Sid", rank: 110, avatar: "🔢", style: "Defensive", bio: "Makes moves in strict order.", funFact: "XRPL uses Sequence numbers to order transactions", favoriteOpening: "London System" },
  { botId: "testnet_tara", name: "Testnet Tara", rank: 90, avatar: "🧪", style: "Random", bio: "Breaks positions so you learn to fix them.", funFact: "Testnets are for experimentation without risk", favoriteOpening: "Scotch Game" },

  // Beginner (201-400)
  {
    botId: "ledger_larry",
    name: "Ledger Larry",
    rank: 300,
    avatar: "📒",
    style: "Defensive",
    bio: "Learning about the XRP Ledger! A decentralized, open-source blockchain optimized for payments.",
    funFact: "XRPL can process ~1500 transactions per second",
    favoriteOpening: "French Defense",
  },
  {
    botId: "validator_vera",
    name: "Validator Vera",
    rank: 350,
    avatar: "✅",
    style: "Balanced",
    bio: "Validators secure the XRPL network through consensus, not mining!",
    funFact: "XRPL uses a unique consensus protocol, not Proof of Work",
    favoriteOpening: "Sicilian Defense",
  },
  { botId: "trustline_tommy", name: "Trustline Tommy", rank: 260, avatar: "🧾", style: "Cautious", bio: "Only accepts lines of play he trusts.", funFact: "Trust lines are required to hold most IOUs on XRPL", favoriteOpening: "Queen's Pawn" },
  { botId: "tagged_tina", name: "DestinationTag Tina", rank: 330, avatar: "🏷️", style: "Balanced", bio: "Keeps everything organized—especially pieces.", funFact: "Destination tags help exchanges route deposits correctly", favoriteOpening: "Scandinavian Defense" },
  { botId: "reserve_ron", name: "Reserve Ron", rank: 390, avatar: "🧊", style: "Defensive", bio: "Plays solid—he hates unnecessary reserves.", funFact: "XRPL has account/owner reserves to prevent spam", favoriteOpening: "Slav Defense" },
  { botId: "issuer_ivan", name: "Issuer Ivan", rank: 240, avatar: "🏛️", style: "Balanced", bio: "Issues threats and IOUs.", funFact: "Issued currencies can represent fiat, points, or assets", favoriteOpening: "Queen's Pawn" },
  { botId: "gateway_gina", name: "Gateway Gina", rank: 280, avatar: "🚪", style: "Defensive", bio: "Lets only safe pieces through.", funFact: "Gateways/issuers enable IOU ecosystems", favoriteOpening: "Slav Defense" },
  { botId: "market_moe", name: "Market Moe", rank: 310, avatar: "📈", style: "Aggressive", bio: "Buys low, sacs high.", funFact: "XRPL has a native order book DEX", favoriteOpening: "Sicilian Defense" },
  { botId: "ledger_lucy", name: "Ledger Lucy", rank: 370, avatar: "📚", style: "Balanced", bio: "Keeps the position tidy like a ledger.", funFact: "Ledgers close every few seconds", favoriteOpening: "Caro-Kann Defense" },
  { botId: "ticket_toby", name: "Ticket Toby", rank: 400, avatar: "🎟️", style: "Positional", bio: "Plays with tickets so he can sign later.", funFact: "XRPL Tickets allow sending txns without using Sequence", favoriteOpening: "Queen's Gambit Declined" },

  // Intermediate (401-600)
  {
    botId: "dex_diana",
    name: "DEX Diana",
    rank: 500,
    avatar: "🔄",
    style: "Aggressive",
    bio: "Expert in XRPL's built-in Decentralized Exchange! Trade assets directly on-chain.",
    funFact: "XRPL DEX has been running since 2012",
    favoriteOpening: "King's Indian Attack",
  },
  {
    botId: "xahau_xavier",
    name: "Xahau Xavier",
    rank: 550,
    avatar: "🪝",
    style: "Tactical",
    bio: "Xahau is an XRPL sidechain with Hooks (smart contracts)! This game runs on Xahau Hooks.",
    funFact: "Hooks enable programmable logic on the XRPL",
    favoriteOpening: "Queen's Gambit",
  },
  { botId: "amm_amy", name: "AMM Amy", rank: 480, avatar: "⚖️", style: "Balanced", bio: "Balances trades and balances positions.", funFact: "XRPL AMMs provide on-chain liquidity pools", favoriteOpening: "Italian Game" },
  { botId: "escrow_eddie", name: "Escrow Eddie", rank: 520, avatar: "🔐", style: "Positional", bio: "Locks things up until the moment is right.", funFact: "XRPL Escrow can release funds at a time or condition", favoriteOpening: "Queen's Indian Defense" },
  { botId: "pathfinding_penny", name: "Pathfinding Penny", rank: 590, avatar: "🧭", style: "Strategic", bio: "Always finds a route—even in messy positions.", funFact: "XRPL can pathfind through order books and IOUs", favoriteOpening: "Catalan Opening" },
  { botId: "hook_hannah", name: "Hook Hannah", rank: 410, avatar: "🪝", style: "Tactical", bio: "Sets traps like on-ledger Hooks.", funFact: "Hooks add programmable execution on Xahau", favoriteOpening: "Sicilian Defense" },
  { botId: "amm_arthur", name: "AMM Arthur", rank: 460, avatar: "🔁", style: "Balanced", bio: "Swaps advantage back and forth.", funFact: "AMMs quote prices based on pool ratios", favoriteOpening: "English Opening" },
  { botId: "nft_nancy", name: "NFT Nancy", rank: 540, avatar: "🖼️", style: "Aggressive", bio: "Collects pieces like collectibles.", funFact: "XRPL supports NFTs via XLS-20", favoriteOpening: "King's Indian Defense" },
  { botId: "burn_benji", name: "Burn Benji", rank: 600, avatar: "🔥", style: "Aggressive", bio: "Sacrifices first, asks later.", funFact: "XRPL burns a tiny fee each transaction", favoriteOpening: "Scotch Game" },
  { botId: "orderbook_olga", name: "Orderbook Olga", rank: 580, avatar: "📊", style: "Positional", bio: "Improves slowly, like building depth.", funFact: "Order books match bids/asks on XRPL DEX", favoriteOpening: "Queen's Gambit" },

  // Advanced (601-800)
  {
    botId: "paystring_pat",
    name: "PayString Pat",
    rank: 700,
    avatar: "💳",
    style: "Positional",
    bio: "PayString simplifies payment addressing across blockchains. One address for all!",
    funFact: "PayString was created by Ripple in 2020",
    favoriteOpening: "English Opening",
  },
  {
    botId: "iou_isaac",
    name: "IOU Isaac",
    rank: 750,
    avatar: "🎫",
    style: "Strategic",
    bio: "IOUs on XRPL represent debt or credit between parties. Trust lines enable this!",
    funFact: "XRPL supports any currency as an IOU",
    favoriteOpening: "Ruy Lopez",
  },
  { botId: "multisign_mike", name: "Multisign Mike", rank: 640, avatar: "🛡️", style: "Defensive", bio: "Requires more than one threat to take action.", funFact: "XRPL multisign allows multiple signers for one account", favoriteOpening: "Petrov Defense" },
  { botId: "oracle_olivia", name: "Oracle Olivia", rank: 780, avatar: "🔮", style: "Precise", bio: "Reads the board like an oracle reads ledgers.", funFact: "Oracles bring off-chain data on-chain (future Hook phase)", favoriteOpening: "Nimzo-Indian Defense" },
  { botId: "rlusd_riley", name: "RLUSD Riley", rank: 690, avatar: "💵", style: "Balanced", bio: "Stable and steady—until a tactic appears.", funFact: "Stablecoins on XRPL use issued currencies and trust lines", favoriteOpening: "Queen's Gambit Declined" },
  { botId: "liquidity_luke", name: "Liquidity Luke", rank: 610, avatar: "💦", style: "Positional", bio: "Keeps pieces flowing to open files.", funFact: "Liquidity reduces slippage in markets", favoriteOpening: "English Opening" },
  { botId: "bridge_bella", name: "Bridge Bella", rank: 680, avatar: "🌉", style: "Strategic", bio: "Connects plans across phases.", funFact: "Sidechains can extend XRPL functionality", favoriteOpening: "Ruy Lopez" },
  { botId: "payments_paul", name: "Payments Paul", rank: 720, avatar: "💸", style: "Balanced", bio: "Direct, fast, and low-cost.", funFact: "XRPL is optimized for payments", favoriteOpening: "Italian Game" },
  { botId: "cluster_cleo", name: "Cluster Cleo", rank: 800, avatar: "🧩", style: "Precise", bio: "Sees patterns before you do.", funFact: "Validators form a network for consensus", favoriteOpening: "Nimzo-Indian Defense" },
  { botId: "reserve_rae", name: "Reserve Rae", rank: 760, avatar: "🧱", style: "Defensive", bio: "Locks down squares like reserves lock down spam.", funFact: "Owner reserve scales with objects on ledger", favoriteOpening: "Slav Defense" },

  // Expert (801-1000)
  {
    botId: "consensus_carl",
    name: "Consensus Carl",
    rank: 900,
    avatar: "🤝",
    style: "Precise",
    bio: "Master of XRPL's consensus protocol! Ledgers close in 3-5 seconds with finality.",
    funFact: "XRPL consensus doesn't fork - transactions are final",
    favoriteOpening: "Nimzo-Indian Defense",
  },
  {
    botId: "grandmaster_ripple",
    name: "GrandMaster Ripple",
    rank: 1000,
    avatar: "👑",
    style: "Perfect",
    bio: "The ultimate XRPL expert! Built for enterprise-grade global payments since 2012.",
    funFact: "Over 300 financial institutions use RippleNet",
    favoriteOpening: "Sicilian Najdorf",
  },
  { botId: "evernode_eva", name: "Evernode Eva", rank: 860, avatar: "🌐", style: "Strategic", bio: "Hosts strong endgames with serious uptime.", funFact: "Evernode is an XRPL ecosystem project for decentralized hosting", favoriteOpening: "Caro-Kann Defense" },
  { botId: "xaman_uma", name: "Xaman Uma", rank: 820, avatar: "📱", style: "Positional", bio: "Signs moves like she signs transactions.", funFact: "Xaman (formerly XUMM) is a popular XRPL wallet", favoriteOpening: "London System" },
  { botId: "finality_finn", name: "Finality Finn", rank: 940, avatar: "⚡", style: "Precise", bio: "No takebacks. No forks. Just final moves.", funFact: "XRPL is designed for fast settlement and finality", favoriteOpening: "Queen's Gambit" },
  { botId: "validators_val", name: "Validators Val", rank: 810, avatar: "🛰️", style: "Precise", bio: "High-uptime, high-accuracy.", funFact: "UNL lists validators you trust", favoriteOpening: "Queen's Indian Defense" },
  { botId: "consensus_cora", name: "Consensus Cora", rank: 880, avatar: "🤝", style: "Strategic", bio: "Every move reaches agreement.", funFact: "Consensus voting closes each ledger", favoriteOpening: "Catalan Opening" },
  { botId: "whale_wyatt", name: "Whale Wyatt", rank: 930, avatar: "🐋", style: "Aggressive", bio: "Huge pressure, huge tactics.", funFact: "Large holders can move markets (be careful)", favoriteOpening: "Sicilian Defense" },
  { botId: "final_boss_xrpl", name: "Final Boss XRPL", rank: 970, avatar: "🧠", style: "Perfect", bio: "No blunders. No mercy.", funFact: "XRPL has been running since 2012", favoriteOpening: "Sicilian Najdorf" },
  { botId: "proofless_pete", name: "Proofless Pete", rank: 845, avatar: "⛏️", style: "Positional", bio: "Wins without mining.", funFact: "XRPL does not use Proof-of-Work mining", favoriteOpening: "Ruy Lopez" },

  // More themed bots (to reach 50+)
  { botId: "hooks_hugo", name: "Hooks Hugo", rank: 610, avatar: "🪝", style: "Tactical", bio: "Deploys tactics like Hooks deploy logic.", funFact: "Hooks can enforce custom rules on-ledger", favoriteOpening: "Sicilian Defense" },
  { botId: "unl_uma", name: "UNL Uma", rank: 740, avatar: "📡", style: "Strategic", bio: "Only trusts validators on her UNL.", funFact: "UNL = Unique Node List (trusted validators)", favoriteOpening: "Queen's Indian Defense" },
  { botId: "xrpl_explorer_eli", name: "Explorer Eli", rank: 420, avatar: "🔎", style: "Balanced", bio: "Sees every move like an explorer sees every transaction.", funFact: "Explorers index ledger history for humans", favoriteOpening: "Italian Game" },
  { botId: "token_tess", name: "Token Tess", rank: 360, avatar: "🪙", style: "Balanced", bio: "Creates threats like new tokens.", funFact: "Issued currencies are tokens on XRPL", favoriteOpening: "London System" },
  { botId: "amm_arbitrage_andy", name: "Arbitrage Andy", rank: 790, avatar: "⚡", style: "Precise", bio: "Punishes inaccuracies instantly.", funFact: "Arbitrage keeps markets efficient", favoriteOpening: "English Opening" },
  { botId: "liquidity_lila", name: "Liquidity Lila", rank: 650, avatar: "💧", style: "Positional", bio: "Prefers smooth, flowing positions.", funFact: "Liquidity reduces spreads and volatility", favoriteOpening: "Catalan Opening" },
  { botId: "escrow_ella", name: "Escrow Ella", rank: 560, avatar: "⏳", style: "Positional", bio: "Waits… then strikes when conditions are met.", funFact: "Escrow can release after FinishAfter time", favoriteOpening: "Queen's Gambit" },
  { botId: "multisig_maya", name: "Multisig Maya", rank: 710, avatar: "🛡️", style: "Defensive", bio: "Needs multiple confirmations before sacrificing.", funFact: "Multisign boosts account security", favoriteOpening: "Petrov Defense" },
  { botId: "signer_sam", name: "Signer Sam", rank: 230, avatar: "✍️", style: "Cautious", bio: "Signs only safe moves.", funFact: "Every XRPL txn is cryptographically signed", favoriteOpening: "Queen's Pawn" },
  { botId: "sequence_sarah", name: "Sequence Sarah", rank: 270, avatar: "🔢", style: "Defensive", bio: "Plays in perfect order.", funFact: "Sequence numbers prevent replay attacks", favoriteOpening: "Slav Defense" },
  { botId: "ripplenet_ryan", name: "RippleNet Ryan", rank: 670, avatar: "🌐", style: "Balanced", bio: "Moves fast across the board.", funFact: "RippleNet connects financial institutions", favoriteOpening: "Ruy Lopez" },
  { botId: "payment_path_piper", name: "Payment Path Piper", rank: 520, avatar: "🧭", style: "Strategic", bio: "Always finds a conversion line.", funFact: "XRPL paths can route through multiple order books", favoriteOpening: "Catalan Opening" },
  { botId: "lines_of_trust_lou", name: "Trustline Lou", rank: 410, avatar: "🧾", style: "Cautious", bio: "Won't enter your territory without trust.", funFact: "TrustSet enables holding issued assets", favoriteOpening: "London System" },
  { botId: "offer_oliver", name: "Offer Oliver", rank: 480, avatar: "📄", style: "Balanced", bio: "Posts offers and positional threats.", funFact: "OfferCreate places orders on the XRPL DEX", favoriteOpening: "English Opening" },
  { botId: "clawback_claire", name: "Clawback Claire", rank: 590, avatar: "🦞", style: "Tactical", bio: "Takes back blunders quickly.", funFact: "Some issued currencies support clawback", favoriteOpening: "Sicilian Defense" },
  { botId: "amm_amelia", name: "AMM Amelia", rank: 450, avatar: "⚖️", style: "Balanced", bio: "Always rebalances the position.", funFact: "AMMs rebalance via swaps", favoriteOpening: "Italian Game" },
  { botId: "dex_derek", name: "DEX Derek", rank: 530, avatar: "🔄", style: "Aggressive", bio: "Trades pieces like a market maker.", funFact: "XRPL has both AMM and order book trading", favoriteOpening: "King's Indian Attack" },
  { botId: "nft_nora", name: "NFT Nora", rank: 620, avatar: "🖼️", style: "Aggressive", bio: "Collects material and mints wins.", funFact: "NFTs on XRPL are XLS-20 tokens", favoriteOpening: "Ruy Lopez" },
  { botId: "burner_bryce", name: "Burner Bryce", rank: 340, avatar: "🔥", style: "Random", bio: "Burns pawns like tiny fees.", funFact: "Fees are destroyed, reducing supply slightly", favoriteOpening: "Scotch Game" },
  { botId: "ledger_close_cody", name: "Ledger Close Cody", rank: 830, avatar: "⏱️", style: "Precise", bio: "Closes games like ledgers: fast and final.", funFact: "Ledgers close in ~3-5 seconds on XRPL", favoriteOpening: "Nimzo-Indian Defense" },
  { botId: "bridge_brianna", name: "Bridge Brianna", rank: 770, avatar: "🌉", style: "Strategic", bio: "Connects tactics across phases.", funFact: "Bridges connect assets across chains", favoriteOpening: "Queen's Gambit Declined" },
  { botId: "wallet_wendy", name: "Wallet Wendy", rank: 210, avatar: "👛", style: "Balanced", bio: "Protects her king like she protects keys.", funFact: "Self-custody means you control private keys", favoriteOpening: "Caro-Kann Defense" },
  { botId: "cold_storage_cal", name: "Cold Storage Cal", rank: 260, avatar: "🧊", style: "Defensive", bio: "Keeps everything locked down.", funFact: "Cold storage keeps keys offline", favoriteOpening: "French Defense" },
  { botId: "hot_wallet_hank", name: "Hot Wallet Hank", rank: 300, avatar: "📱", style: "Aggressive", bio: "Fast moves, fast transfers.", funFact: "Hot wallets prioritize convenience", favoriteOpening: "Sicilian Defense" },
  { botId: "network_nina", name: "Network Nina", rank: 410, avatar: "🛰️", style: "Balanced", bio: "Sees the whole board as a network.", funFact: "XRPL is a peer-to-peer network of validators", favoriteOpening: "English Opening" },
  { botId: "node_nathan", name: "Node Nathan", rank: 510, avatar: "🖥️", style: "Positional", bio: "Solid infrastructure, solid chess.", funFact: "Running a node helps decentralization", favoriteOpening: "Queen's Gambit" },
  { botId: "genesis_gwen", name: "Genesis Gwen", rank: 140, avatar: "🌟", style: "Cautious", bio: "Plays the classics.", funFact: "XRPL genesis dates back to 2012", favoriteOpening: "Italian Game" },
  { botId: "settlement_sage", name: "Settlement Sage", rank: 880, avatar: "📜", style: "Strategic", bio: "Turns small edges into final settlement.", funFact: "Settlement finality is key for payments", favoriteOpening: "Catalan Opening" },
  { botId: "onchain_owen", name: "On-chain Owen", rank: 580, avatar: "⛓️", style: "Tactical", bio: "Every tactic is verifiable.", funFact: "On-chain data is public and auditable", favoriteOpening: "Sicilian Defense" },
  { botId: "dev_daphne", name: "Dev Daphne", rank: 450, avatar: "🧑‍💻", style: "Balanced", bio: "Iterates fast and punishes slow moves.", funFact: "Open-source dev keeps XRPL evolving", favoriteOpening: "London System" },
  { botId: "codius_cara", name: "Codius Cara", rank: 620, avatar: "📦", style: "Positional", bio: "Deploys plans like containers.", funFact: "Codius was an early Ripple smart contract concept", favoriteOpening: "Queen's Gambit Declined" },
  { botId: "evernode_emmett", name: "Evernode Emmett", rank: 760, avatar: "🌐", style: "Strategic", bio: "Hosts endgames with confidence.", funFact: "Evernode focuses on decentralized app hosting", favoriteOpening: "Ruy Lopez" },
  { botId: "xahau_xena", name: "Xahau Xena", rank: 690, avatar: "🪝", style: "Tactical", bio: "Hooks and forks—her favorites.", funFact: "Hooks are native smart contracts on Xahau", favoriteOpening: "Sicilian Defense" },
];

export const BOT_PROFILE_BY_ID = new Map(BOT_PROFILES.map((b) => [b.botId, b]));

/**
 * Determine bot difficulty based on rank (1-1000 system)
 * Easy: 1-300
 * Medium: 301-600
 * Hard: 601-1000
 */
export function getBotDifficultyByRank(rank: number): 'easy' | 'medium' | 'hard' {
  if (rank <= 300) return 'easy'
  if (rank <= 600) return 'medium'
  return 'hard'
}

/**
 * Generate a random bot rank for the specified difficulty
 * Easy: Random 1-300
 * Medium: Random 301-600
 * Hard: Random 601-1000
 */
export function generateBotRankForDifficulty(difficulty: 'easy' | 'medium' | 'hard'): number {
  switch (difficulty) {
    case 'easy':
      return Math.floor(Math.random() * 300) + 1 // 1-300
    case 'medium':
      return Math.floor(Math.random() * 300) + 301 // 301-600
    case 'hard':
      return Math.floor(Math.random() * 400) + 601 // 601-1000
    default:
      return 300 // fallback to easy-medium boundary
  }
}
