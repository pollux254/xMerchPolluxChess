/**
 * Xahau Chess Wagering Hook
 *
 * Phase 1: Hook core structure
 * - Defines core on-chain state structures (TournamentState, MatchState, ChessBoard)
 * - Implements hook() entry point + memo/action dispatch skeleton
 * - Adds transaction handler skeletons (JOIN/MOVE/FORFEIT/TIMEOUT/etc.)
 *
 * Phase 2+: implement full chess validation + payout logic per requirements.
 */

#include "hookapi.h"
#include "chess-types.h"

// -----------------------------------------------------------------------------
// Hook state namespaces
// Key format for persisted objects:
//   key[0] = namespace
//   key[1..32] = id (32 bytes)
// total key length = 33
// -----------------------------------------------------------------------------

#define NS_TOURNAMENTS 0x01
#define NS_MATCHES     0x02
#define NS_PROFILES    0x03
#define NS_GLOBAL      0xFF

// Requirements constants
#define PLATFORM_FEE_BPS 1100       // 11.00% (basis points)
#define FILL_TIMEOUT_SEC 600        // 10 minutes
#define PLAYER_TIME_MS   1200000ULL // 20 minutes

// Basic action IDs (decoded from memo JSON)
typedef enum {
    ACT_UNKNOWN = 0,
    ACT_JOIN,
    ACT_MOVE,
    ACT_FORFEIT,
    ACT_TIMEOUT,
    ACT_CANCEL_CHECK,
    ACT_REFUND
} action_t;

// Parsed memo (decoded from MemoData JSON that arrives hex-encoded)
typedef struct {
    action_t action;
    uint8_t tournament_id[32];
    uint8_t match_id[32];
    Move move;
    uint64_t entry_fee;
} ParsedMemo;

static ParsedMemo g_parsed_memo;

// -----------------------------------------------------------------------------
// Minimal helpers (no libc)
// -----------------------------------------------------------------------------

static void memzero(void* p, uint32_t n)
{
    uint8_t* b = (uint8_t*)p;
    for (uint32_t i = 0; i < n; ++i)
        b[i] = 0;
}

static void memcopy(void* dst, const void* src, uint32_t n)
{
    uint8_t* d = (uint8_t*)dst;
    const uint8_t* s = (const uint8_t*)src;
    for (uint32_t i = 0; i < n; ++i)
        d[i] = s[i];
}

static int memcompare(const void* a, const void* b, uint32_t n)
{
    const uint8_t* x = (const uint8_t*)a;
    const uint8_t* y = (const uint8_t*)b;
    for (uint32_t i = 0; i < n; ++i)
        if (x[i] != y[i])
            return (int)x[i] - (int)y[i];
    return 0;
}

static uint8_t hex_nibble(uint8_t c)
{
    if (c >= '0' && c <= '9') return (uint8_t)(c - '0');
    if (c >= 'a' && c <= 'f') return (uint8_t)(c - 'a' + 10);
    if (c >= 'A' && c <= 'F') return (uint8_t)(c - 'A' + 10);
    return 0;
}

static int hex_to_32bytes(const uint8_t* hex64, uint8_t out32[32])
{
    // hex64 points at 64 ASCII hex chars
    if (!hex64 || !out32)
        return 0;
    for (uint8_t i = 0; i < 32; ++i)
    {
        uint8_t hi = hex_nibble(hex64[i * 2]);
        uint8_t lo = hex_nibble(hex64[i * 2 + 1]);
        out32[i] = (uint8_t)((hi << 4) | lo);
    }
    return 1;
}

static int find_pat(const uint8_t* buf, uint32_t len, const char* pat)
{
    if (!buf || !pat)
        return -1;
    uint32_t plen = 0;
    while (pat[plen] != 0)
        plen++;
    if (plen == 0 || plen > len)
        return -1;

    for (uint32_t i = 0; i + plen <= len; ++i)
    {
        uint32_t j = 0;
        for (; j < plen; ++j)
            if (buf[i + j] != (uint8_t)pat[j])
                break;
        if (j == plen)
            return (int)i;
    }
    return -1;
}

static int parse_json_hex32(const uint8_t* buf, uint32_t len, const char* key, uint8_t out32[32])
{
    // Looks for: "<key>":"<64 hex chars>"
    char pat[40];
    uint32_t klen = 0;
    while (key[klen] != 0 && klen < 28) klen++;
    if (klen == 0) return 0;

    // Build pattern: "key":"
    uint32_t p = 0;
    pat[p++] = '"';
    for (uint32_t i = 0; i < klen; ++i) pat[p++] = key[i];
    pat[p++] = '"';
    pat[p++] = ':';
    pat[p++] = '"';
    pat[p] = 0;

    int idx = find_pat(buf, len, pat);
    if (idx < 0)
        return 0;
    uint32_t start = (uint32_t)idx + p;
    if (start + 64 > len)
        return 0;
    return hex_to_32bytes(buf + start, out32);
}

static int parse_json_u64(const uint8_t* buf, uint32_t len, const char* key, uint64_t* out)
{
    // Looks for: "<key>":<digits>
    if (!out) return 0;
    char pat[40];
    uint32_t klen = 0;
    while (key[klen] != 0 && klen < 28) klen++;
    if (klen == 0) return 0;

    uint32_t p = 0;
    pat[p++] = '"';
    for (uint32_t i = 0; i < klen; ++i) pat[p++] = key[i];
    pat[p++] = '"';
    pat[p++] = ':';
    pat[p] = 0;

    int idx = find_pat(buf, len, pat);
    if (idx < 0)
        return 0;
    uint32_t i = (uint32_t)idx + p;
    if (i >= len) return 0;

    // Skip whitespace
    while (i < len && (buf[i] == ' ' || buf[i] == '\n' || buf[i] == '\r' || buf[i] == '\t')) i++;
    if (i >= len) return 0;

    uint64_t v = 0;
    uint32_t digits = 0;
    while (i < len && buf[i] >= '0' && buf[i] <= '9')
    {
        v = v * 10 + (uint64_t)(buf[i] - '0');
        i++;
        digits++;
        if (digits > 20) break;
    }
    if (digits == 0)
        return 0;
    *out = v;
    return 1;
}

static int parse_json_u8(const uint8_t* buf, uint32_t len, const char* key, uint8_t* out)
{
    uint64_t v = 0;
    if (!out) return 0;
    if (!parse_json_u64(buf, len, key, &v))
        return 0;
    if (v > 255) return 0;
    *out = (uint8_t)v;
    return 1;
}

// Forward declarations (Phase 1: skeleton)
static int has_token(const uint8_t* buf, uint32_t len, const char* tok);
static action_t parse_action_from_memos(uint8_t* out_buf, uint32_t out_len);

// Save/load tournament state
static int save_tournament(const TournamentState* t);
static int load_tournament(const uint8_t* id, TournamentState* t);

// Save/load match state
static int save_match(const MatchState* m);
static int load_match(const uint8_t* id, MatchState* m);

static void end_match(MatchState* m);
static int64_t handle_join(uint32_t reserved);
static int64_t handle_move(uint32_t reserved);
static int64_t handle_forfeit(uint32_t reserved);
static int64_t handle_timeout(uint32_t reserved);
static int64_t handle_cancel_check(uint32_t reserved);
static int64_t handle_refund(uint32_t reserved);

// Chess engine API (implemented in chess-engine.c)
void chess_init_startpos(ChessBoard* b);
int chess_is_legal_move(const ChessBoard* b, const Move* m);
void chess_make_move(ChessBoard* b, const Move* m);
int chess_is_in_check(const ChessBoard* b, uint8_t color);
int chess_is_checkmate(const ChessBoard* b);
int chess_is_forced_draw(const ChessBoard* b);
uint8_t chess_count_material(const ChessBoard* b, uint8_t color);

// Hook API time
int64_t ledger_last_time(void);

/**
 * hook()
 * Entry point called by the Hooks VM for each triggering transaction.
 */
int64_t hook(uint32_t reserved)
{
    TRACESTR("Xahau Chess Hook: tx received");

    uint8_t tx_type[1];
    if (otxn_field(SBUF(tx_type), sfTransactionType) != 1)
    {
        TRACESTR("Xahau Chess Hook: missing TransactionType");
        return 0;
    }

    // Attempt to parse memo(s) and extract action.
    // Phase 1 approach: best-effort string search on raw sfMemos blob.
    // Phase 2: use slot-based memo parsing if needed.
    uint8_t memo_blob[512];
    action_t act = parse_action_from_memos(memo_blob, sizeof(memo_blob));

    // Dispatch based on tx type + action.
    if (tx_type[0] == ttPAYMENT)
    {
        if (act == ACT_JOIN)
            return handle_join(reserved);

        // Payment without understood action: accept (non-fatal)
        TRACESTR("Xahau Chess Hook: PAYMENT w/ unknown action");
        return 0;
    }
    else if (tx_type[0] == ttINVOKE)
    {
        if (act == ACT_MOVE)
            return handle_move(reserved);
        if (act == ACT_FORFEIT)
            return handle_forfeit(reserved);
        if (act == ACT_TIMEOUT)
            return handle_timeout(reserved);
        if (act == ACT_CANCEL_CHECK)
            return handle_cancel_check(reserved);
        if (act == ACT_REFUND)
            return handle_refund(reserved);

        // Default invoke: accept (non-fatal)
        TRACESTR("Xahau Chess Hook: INVOKE w/ unknown action");
        return 0;
    }

    TRACESTR("Xahau Chess Hook: unsupported tx type");
    return 0;
}

/**
 * parse_action_from_memos
 *
 * Phase 1 implementation:
 * - Reads the sfMemos field raw bytes into out_buf.
 * - Searches for ASCII tokens for known actions.
 *
 * NOTE: xrpl-js sends MemoData hex of JSON like:
 *   {"action":"JOIN"}
 * in bytes; the hook receives binary; token search still often works.
 */
static action_t parse_action_from_memos(uint8_t* out_buf, uint32_t out_len)
{
    if (!out_buf || out_len == 0)
        return ACT_UNKNOWN;

    memzero(&g_parsed_memo, sizeof(g_parsed_memo));
    g_parsed_memo.move.from = 0xFF;
    g_parsed_memo.move.to = 0xFF;

    int64_t n = otxn_field(out_buf, out_len, sfMemos);
    if (n <= 0)
        return ACT_UNKNOWN;

    // crude token scan
    const char* tok_join = "JOIN";
    const char* tok_move = "MOVE";
    const char* tok_forfeit = "FORFEIT";
    const char* tok_timeout = "TIMEOUT";
    const char* tok_cancel = "CANCEL";
    const char* tok_refund = "REFUND";

    action_t act = ACT_UNKNOWN;
    if (has_token(out_buf, (uint32_t)n, tok_join)) act = ACT_JOIN;
    else if (has_token(out_buf, (uint32_t)n, tok_move)) act = ACT_MOVE;
    else if (has_token(out_buf, (uint32_t)n, tok_forfeit)) act = ACT_FORFEIT;
    else if (has_token(out_buf, (uint32_t)n, tok_timeout)) act = ACT_TIMEOUT;
    else if (has_token(out_buf, (uint32_t)n, tok_cancel)) act = ACT_CANCEL_CHECK;
    else if (has_token(out_buf, (uint32_t)n, tok_refund)) act = ACT_REFUND;

    g_parsed_memo.action = act;

    // Best-effort extraction of fields (JSON is embedded in memo blob)
    // JOIN
    if (act == ACT_JOIN)
    {
        (void)parse_json_hex32(out_buf, (uint32_t)n, "tournament_id", g_parsed_memo.tournament_id);
        (void)parse_json_u64(out_buf, (uint32_t)n, "entry_fee", &g_parsed_memo.entry_fee);
        // optional
        (void)parse_json_hex32(out_buf, (uint32_t)n, "match_id", g_parsed_memo.match_id);
    }
    // MOVE / FORFEIT use match_id
    if (act == ACT_MOVE || act == ACT_FORFEIT)
    {
        (void)parse_json_hex32(out_buf, (uint32_t)n, "match_id", g_parsed_memo.match_id);
        (void)parse_json_u8(out_buf, (uint32_t)n, "from", &g_parsed_memo.move.from);
        (void)parse_json_u8(out_buf, (uint32_t)n, "to", &g_parsed_memo.move.to);
    }

    return act;
}

// -----------------------------------------------------------------------------
// State persistence
// -----------------------------------------------------------------------------

static int save_tournament(const TournamentState* t)
{
    if (!t)
        return 0;
    uint8_t key[33];
    key[0] = NS_TOURNAMENTS;
    memcopy(key + 1, t->tournament_id, 32);
    int64_t r = state_set(key, sizeof(key), (uint8_t*)t, sizeof(TournamentState));
    return (r >= 0) ? 1 : 0;
}

static int load_tournament(const uint8_t* id, TournamentState* t)
{
    if (!id || !t)
        return 0;
    uint8_t key[33];
    key[0] = NS_TOURNAMENTS;
    memcopy(key + 1, id, 32);
    int64_t r = state((uint8_t*)t, sizeof(TournamentState), key, sizeof(key));
    return (r == (int64_t)sizeof(TournamentState)) ? 1 : 0;
}

static int save_match(const MatchState* m)
{
    if (!m)
        return 0;
    uint8_t key[33];
    key[0] = NS_MATCHES;
    memcopy(key + 1, m->match_id, 32);
    int64_t r = state_set(key, sizeof(key), (uint8_t*)m, sizeof(MatchState));
    return (r >= 0) ? 1 : 0;
}

static int load_match(const uint8_t* id, MatchState* m)
{
    if (!id || !m)
        return 0;
    uint8_t key[33];
    key[0] = NS_MATCHES;
    memcopy(key + 1, id, 32);
    int64_t r = state((uint8_t*)m, sizeof(MatchState), key, sizeof(key));
    return (r == (int64_t)sizeof(MatchState)) ? 1 : 0;
}

static uint64_t be64(const uint8_t* p)
{
    uint64_t v = 0;
    for (uint8_t i = 0; i < 8; ++i)
        v = (v << 8) | (uint64_t)p[i];
    return v;
}

static int read_xah_drops(uint64_t* out_drops)
{
    if (!out_drops)
        return 0;
    uint8_t amount_buf[48];
    int64_t n = otxn_field(amount_buf, sizeof(amount_buf), sfAmount);
    if (n != 8)
        return 0; // only XRP/XAH drops supported
    uint64_t raw = be64(amount_buf);
    // XRP Amount: high bit 0 indicates native; remaining bits are drops.
    *out_drops = raw & 0x7FFFFFFFFFFFFFFFULL;
    return 1;
}

// Minimal substring search (no libc)
static int has_token(const uint8_t* buf, uint32_t len, const char* tok)
{
    if (!buf || !tok)
        return 0;
    uint32_t tlen = 0;
    while (tok[tlen] != 0)
        tlen++;
    if (tlen == 0 || tlen > len)
        return 0;

    for (uint32_t i = 0; i + tlen <= len; ++i)
    {
        uint32_t j = 0;
        for (; j < tlen; ++j)
            if (buf[i + j] != (uint8_t)tok[j])
                break;
        if (j == tlen)
            return 1;
    }
    return 0;
}

/**
 * Handler skeletons (Phase 1)
 *
 * These handlers will be fully implemented across later phases:
 * - Join tournament (escrow entry fee, fill timer, start tournament)
 * - Move (legal move validation, time controls, game end detection)
 * - Forfeit (resignation)
 * - Timeout (clock enforcement + fill-time auto refunds)
 */
static int64_t handle_join(uint32_t reserved)
{
    (void)reserved;

    // 1) Extract payment amount from transaction (drops)
    uint64_t amt = 0;
    if (!read_xah_drops(&amt))
        rollback(SBUF("Invalid Amount"), 1);

    // 2) Load tournament state
    TournamentState t;
    if (!load_tournament(g_parsed_memo.tournament_id, &t))
        rollback(SBUF("Tournament not found"), 1);

    // 3) Validate entry fee
    if (t.entry_fee != amt)
        rollback(SBUF("Wrong entry fee"), 1);

    // 4) Get player account address
    uint8_t player_account[20];
    if (otxn_field(player_account, 20, sfAccount) != 20)
        rollback(SBUF("Missing Account"), 1);

    // 5) Validate tournament is joinable
    if (t.status != TOURNAMENT_WAITING)
        rollback(SBUF("Tournament not joinable"), 1);
    if (t.player_count >= t.tournament_size)
        rollback(SBUF("Tournament full"), 1);

    // Prevent duplicate joins
    for (uint8_t i = 0; i < t.player_count; ++i)
        if (memcompare(t.players[i], player_account, 20) == 0)
            rollback(SBUF("Already joined"), 1);

    // 6) Add player + update pool
    memcopy(t.players[t.player_count], player_account, 20);
    t.player_count++;
    t.prize_pool += amt;

    // 7) Check if tournament is full -> start
    if (t.player_count == t.tournament_size)
    {
        // Deduct platform fee
        uint64_t fee = (t.prize_pool * PLATFORM_FEE_BPS) / 10000ULL;
        t.prize_pool -= fee;
        // TODO: emit_payment to platform address

        t.status = TOURNAMENT_ACTIVE;
        t.created_at = (uint64_t)ledger_last_time();

        // TODO: create_matches(&t) and persist match state(s)
    }

    // 8) Save updated tournament
    if (!save_tournament(&t))
        rollback(SBUF("Save tournament failed"), 1);

    accept(SBUF("Joined tournament"), 0);
    return 0;
}

static int64_t handle_move(uint32_t reserved)
{
    (void)reserved;

    // Basic validation of parsed move
    if (g_parsed_memo.move.from > 63 || g_parsed_memo.move.to > 63)
        rollback(SBUF("Missing/invalid move"), 1);

    // 1) Load match state
    MatchState m;
    if (!load_match(g_parsed_memo.match_id, &m))
        rollback(SBUF("Match not found"), 1);

    if (m.status != MATCH_ACTIVE)
        rollback(SBUF("Match not active"), 1);

    // 2) Verify it's player's turn
    uint8_t player_account[20];
    if (otxn_field(player_account, 20, sfAccount) != 20)
        rollback(SBUF("Missing Account"), 1);

    uint8_t* current_player = (m.board.to_move == CHESS_WHITE) ? m.player1 : m.player2;
    if (memcompare(player_account, current_player, 20) != 0)
        rollback(SBUF("Not your turn"), 1);

    // 3) Update time control (20 min per player)
    uint64_t now_s = (uint64_t)ledger_last_time();
    uint64_t now_ms = now_s * 1000ULL;
    uint64_t last_ms = m.last_move_time * 1000ULL;
    uint64_t elapsed_ms = (now_ms > last_ms) ? (now_ms - last_ms) : 0ULL;

    if (m.board.to_move == CHESS_WHITE)
    {
        if (elapsed_ms >= m.player1_time_left)
        {
            // Time forfeit: black wins
            memcopy(m.winner, m.player2, 20);
            m.result_type = RESULT_TIME_FORFEIT;
            end_match(&m);
            accept(SBUF("Time forfeit"), 0);
            return 0;
        }
        m.player1_time_left -= elapsed_ms;
    }
    else
    {
        if (elapsed_ms >= m.player2_time_left)
        {
            // Time forfeit: white wins
            memcopy(m.winner, m.player1, 20);
            m.result_type = RESULT_TIME_FORFEIT;
            end_match(&m);
            accept(SBUF("Time forfeit"), 0);
            return 0;
        }
        m.player2_time_left -= elapsed_ms;
    }

    // 4) Validate move
    if (!chess_is_legal_move(&m.board, &g_parsed_memo.move))
        rollback(SBUF("Illegal move"), 1);

    // 5) Make move
    chess_make_move(&m.board, &g_parsed_memo.move);
    m.last_move_time = now_s;

    // 6) Check end conditions
    if (chess_is_checkmate(&m.board))
    {
        memcopy(m.winner, player_account, 20);
        m.result_type = RESULT_CHECKMATE;
        end_match(&m);
    }
    else if (chess_is_forced_draw(&m.board))
    {
        // Material tiebreaker: LOWER material wins
        uint8_t p1_mat = chess_count_material(&m.board, CHESS_WHITE);
        uint8_t p2_mat = chess_count_material(&m.board, CHESS_BLACK);

        if (p1_mat < p2_mat)
            memcopy(m.winner, m.player1, 20);
        else if (p2_mat < p1_mat)
            memcopy(m.winner, m.player2, 20);
        else
            memcopy(m.winner, m.player1, 20); // TODO: split prize or other rule

        m.result_type = RESULT_DRAW_MATERIAL;
        end_match(&m);
    }
    else
    {
        if (!save_match(&m))
            rollback(SBUF("Save match failed"), 1);
    }

    accept(SBUF("Move accepted"), 0);
    return 0;
}

static void end_match(MatchState* m)
{
    if (!m)
        return;
    m->status = MATCH_COMPLETE;
    (void)save_match(m);

    // TODO Phase 3/4:
    // - Load parent tournament
    // - Advance bracket / create next match
    // - If tournament complete, distribute prize_pool
}

static int64_t handle_forfeit(uint32_t reserved)
{
    (void)reserved;
    TRACESTR("handle_forfeit: stub");
    // TODO Phase 2:
    // - validate player is part of match
    // - set winner = opponent, result_type=RESULT_RESIGN
    accept(SBUF("FORFEIT accepted (stub)"), 0);
    return 0;
}

static int64_t handle_timeout(uint32_t reserved)
{
    (void)reserved;
    TRACESTR("handle_timeout: stub");
    // TODO Phase 2:
    // - process tournament fill timer: if not filled in 10m -> refund all
    // - process match timeouts: if player clock expired -> opponent wins
    accept(SBUF("TIMEOUT accepted (stub)"), 0);
    return 0;
}

static int64_t handle_cancel_check(uint32_t reserved)
{
    (void)reserved;
    TRACESTR("handle_cancel_check: stub");
    // TODO Phase 2:
    // - check tournament.created_at and player_count
    // - if expired and not filled -> refund and mark cancelled
    accept(SBUF("CANCEL_CHECK accepted (stub)"), 0);
    return 0;
}

static int64_t handle_refund(uint32_t reserved)
{
    (void)reserved;
    TRACESTR("handle_refund: stub");
    // TODO Phase 2:
    // - explicit refund request validation
    accept(SBUF("REFUND accepted (stub)"), 0);
    return 0;
}

