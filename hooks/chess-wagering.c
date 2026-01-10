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

// State key namespaces (match existing frontend readers where possible)
#define NS_GAMES     0x01
#define NS_WAITING   0x02
#define NS_PROFILES  0x03
#define NS_GLOBAL    0xFF

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

// Forward declarations (Phase 1: skeleton)
static int has_token(const uint8_t* buf, uint32_t len, const char* tok);
static action_t parse_action_from_memos(uint8_t* out_buf, uint32_t out_len);
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
int chess_is_forced_draw(const ChessBoard* b);
uint8_t chess_count_material(const ChessBoard* b, uint8_t color);

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

    if (has_token(out_buf, (uint32_t)n, tok_join)) return ACT_JOIN;
    if (has_token(out_buf, (uint32_t)n, tok_move)) return ACT_MOVE;
    if (has_token(out_buf, (uint32_t)n, tok_forfeit)) return ACT_FORFEIT;
    if (has_token(out_buf, (uint32_t)n, tok_timeout)) return ACT_TIMEOUT;
    if (has_token(out_buf, (uint32_t)n, tok_cancel)) return ACT_CANCEL_CHECK;
    if (has_token(out_buf, (uint32_t)n, tok_refund)) return ACT_REFUND;
    return ACT_UNKNOWN;
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
    TRACESTR("handle_join: stub");
    // TODO Phase 2:
    // - validate Amount vs entry_fee for chosen tournament
    // - add player to TournamentState.players
    // - if filled within 10min: start tournament and deduct 11% fee
    accept(SBUF("JOIN accepted (stub)"), 0);
    return 0;
}

static int64_t handle_move(uint32_t reserved)
{
    (void)reserved;
    TRACESTR("handle_move: stub");
    // TODO Phase 2:
    // - parse move + match id from memo
    // - load MatchState
    // - update clock (20 min/player) and auto-loss on timeout
    // - chess_is_legal_move + chess_make_move
    // - detect checkmate/stalemate/repetition/50-move
    // - resolve forced draws with material: LOWER material wins
    accept(SBUF("MOVE accepted (stub)"), 0);
    return 0;
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

