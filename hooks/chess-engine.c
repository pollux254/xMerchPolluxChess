/**
 * Chess Validation Engine (Phase 1 skeleton)
 *
 * Phase 1 deliverable:
 * - Provide module + stable API signatures.
 * - No full chess validation yet (Phase 2).
 */

#include "chess-types.h"

// -----------------------------------------------------------------------------
// Forward declarations (avoid implicit decl warnings with -Werror)
// -----------------------------------------------------------------------------

int chess_is_legal_move(const ChessBoard* b, const Move* m);

// -----------------------------------------------------------------------------
// Bitboard helpers (deterministic, no libc)
// -----------------------------------------------------------------------------

static inline uint64_t bb_mask(uint8_t sq)
{
    return (sq < 64) ? (1ULL << sq) : 0ULL;
}

static inline void set_bit(uint64_t* bb, uint8_t sq)
{
    if (!bb || sq > 63)
        return;
    *bb |= (1ULL << sq);
}

static inline void clear_bit(uint64_t* bb, uint8_t sq)
{
    if (!bb || sq > 63)
        return;
    *bb &= ~(1ULL << sq);
}

static inline uint8_t get_bit(uint64_t bb, uint8_t sq)
{
    if (sq > 63)
        return 0;
    return (uint8_t)((bb >> sq) & 1ULL);
}

static inline uint8_t file_of(uint8_t sq) { return (uint8_t)(sq & 7); }
static inline uint8_t rank_of(uint8_t sq) { return (uint8_t)(sq >> 3); }
static inline int abs_i(int x) { return (x < 0) ? -x : x; }

static inline uint64_t occ_all(const ChessBoard* b)
{
    if (!b) return 0;
    return b->color[CHESS_WHITE] | b->color[CHESS_BLACK];
}

static inline uint64_t occ_color(const ChessBoard* b, uint8_t color)
{
    if (!b) return 0;
    return b->color[color];
}

typedef enum {
    PT_PAWN = 0,
    PT_KNIGHT = 1,
    PT_BISHOP = 2,
    PT_ROOK = 3,
    PT_QUEEN = 4,
    PT_KING = 5,
    PT_NONE = 255
} piece_type_t;

static piece_type_t piece_at(const ChessBoard* b, uint8_t sq)
{
    if (!b || sq > 63)
        return PT_NONE;
    for (uint8_t i = 0; i < 6; ++i)
        if (get_bit(b->pieces[i], sq))
            return (piece_type_t)i;
    return PT_NONE;
}

static uint8_t find_king_sq(const ChessBoard* b, uint8_t color)
{
    if (!b) return 0xFF;
    uint64_t k = b->pieces[PT_KING] & occ_color(b, color);
    if (!k) return 0xFF;
#if defined(__GNUC__) || defined(__clang__)
    return (uint8_t)__builtin_ctzll(k);
#else
    for (uint8_t i = 0; i < 64; ++i)
        if (k & (1ULL << i))
            return i;
    return 0xFF;
#endif
}

static int is_square_attacked(const ChessBoard* b, uint8_t sq, uint8_t attacker)
{
    // Returns 1 if `sq` is attacked by side `attacker`.
    if (!b || sq > 63)
        return 0;

    uint8_t victim = (attacker == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;
    (void)victim;

    uint64_t occ = occ_all(b);
    uint64_t att_occ = occ_color(b, attacker);

    uint8_t f = file_of(sq);
    uint8_t r = rank_of(sq);

    // Pawn attacks
    // White pawns attack +7/+9 from their square. So target sq is attacked if
    // a white pawn exists at sq-7 or sq-9 (with file bounds).
    if (attacker == CHESS_WHITE)
    {
        if (r > 0)
        {
            if (f < 7)
            {
                uint8_t p = (uint8_t)(sq - 7);
                if (get_bit(b->pieces[PT_PAWN] & att_occ, p)) return 1;
            }
            if (f > 0)
            {
                uint8_t p = (uint8_t)(sq - 9);
                if (get_bit(b->pieces[PT_PAWN] & att_occ, p)) return 1;
            }
        }
    }
    else // attacker == CHESS_BLACK
    {
        if (r < 7)
        {
            if (f < 7)
            {
                uint8_t p = (uint8_t)(sq + 9);
                if (get_bit(b->pieces[PT_PAWN] & att_occ, p)) return 1;
            }
            if (f > 0)
            {
                uint8_t p = (uint8_t)(sq + 7);
                if (get_bit(b->pieces[PT_PAWN] & att_occ, p)) return 1;
            }
        }
    }

    // Knight attacks
    static const int8_t kofs[8] = { 17, 15, 10, 6, -6, -10, -15, -17 };
    for (uint8_t i = 0; i < 8; ++i)
    {
        int nsq = (int)sq + (int)kofs[i];
        if (nsq < 0 || nsq > 63) continue;
        uint8_t nf = file_of((uint8_t)nsq);
        uint8_t nr = rank_of((uint8_t)nsq);
        int df = abs_i((int)nf - (int)f);
        int dr = abs_i((int)nr - (int)r);
        if (!((df == 1 && dr == 2) || (df == 2 && dr == 1)))
            continue;
        if (get_bit(b->pieces[PT_KNIGHT] & att_occ, (uint8_t)nsq))
            return 1;
    }

    // King attacks (adjacent)
    for (int drk = -1; drk <= 1; ++drk)
    {
        for (int dfk = -1; dfk <= 1; ++dfk)
        {
            if (drk == 0 && dfk == 0) continue;
            int nf = (int)f + dfk;
            int nr = (int)r + drk;
            if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
            uint8_t nsq = (uint8_t)(nr * 8 + nf);
            if (get_bit(b->pieces[PT_KING] & att_occ, nsq))
                return 1;
        }
    }

    // Sliding attacks: bishops/queens (diagonals)
    static const int8_t diag_steps[4] = { 9, 7, -7, -9 };
    for (uint8_t d = 0; d < 4; ++d)
    {
        int step = diag_steps[d];
        int cur = (int)sq;
        while (1)
        {
            int next = cur + step;
            if (next < 0 || next > 63) break;
            // prevent wrap across files
            int cf = (int)file_of((uint8_t)cur);
            int nf = (int)file_of((uint8_t)next);
            if (abs_i(nf - cf) != 1) break;

            cur = next;
            uint64_t m = (1ULL << (uint8_t)cur);
            if (occ & m)
            {
                if ((att_occ & m) && ((b->pieces[PT_BISHOP] & m) || (b->pieces[PT_QUEEN] & m)))
                    return 1;
                break;
            }
        }
    }

    // Sliding attacks: rooks/queens (orthogonal)
    static const int8_t ortho_steps[4] = { 8, -8, 1, -1 };
    for (uint8_t d = 0; d < 4; ++d)
    {
        int step = ortho_steps[d];
        int cur = (int)sq;
        while (1)
        {
            int next = cur + step;
            if (next < 0 || next > 63) break;
            if (step == 1 || step == -1)
            {
                int cf = (int)file_of((uint8_t)cur);
                int nf = (int)file_of((uint8_t)next);
                if (abs_i(nf - cf) != 1) break;
            }
            cur = next;
            uint64_t m = (1ULL << (uint8_t)cur);
            if (occ & m)
            {
                if ((att_occ & m) && ((b->pieces[PT_ROOK] & m) || (b->pieces[PT_QUEEN] & m)))
                    return 1;
                break;
            }
        }
    }

    return 0;
}

int chess_is_in_check(const ChessBoard* b, uint8_t color)
{
    uint8_t ksq = find_king_sq(b, color);
    if (ksq == 0xFF)
        return 0;
    uint8_t attacker = (color == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;
    return is_square_attacked(b, ksq, attacker);
}

static void apply_move_unchecked(ChessBoard* b, const Move* m)
{
    // Applies move without legality checking.
    // Keeps logic consistent with chess_make_move for self-check testing.
    if (!b || !m || m->from > 63 || m->to > 63)
        return;

    uint8_t us = b->to_move;
    uint8_t them = (us == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;

    piece_type_t pt = piece_at(b, m->from);
    if (pt == PT_NONE)
        return;

    uint64_t occ_before = occ_all(b);

    // Reset en passant by default; set again for double pawn moves.
    uint8_t new_ep = 0xFF;

    // Captures: normal capture or en-passant capture.
    uint8_t captured_sq = m->to;
    piece_type_t captured_pt = piece_at(b, m->to);
    int did_capture = 0;

    if (pt == PT_PAWN && b->en_passant != 0xFF && m->to == b->en_passant && !get_bit(occ_before, m->to))
    {
        int dir = (us == CHESS_WHITE) ? 1 : -1;
        captured_sq = (uint8_t)((int)m->to - dir * 8);
        captured_pt = piece_at(b, captured_sq);
    }

    if (captured_pt != PT_NONE && get_bit(b->color[them], captured_sq))
    {
        clear_bit(&b->pieces[captured_pt], captured_sq);
        clear_bit(&b->color[them], captured_sq);
        did_capture = 1;
    }

    // Move piece bit + color occupancy
    clear_bit(&b->pieces[pt], m->from);
    clear_bit(&b->color[us], m->from);
    set_bit(&b->pieces[pt], m->to);
    set_bit(&b->color[us], m->to);

    // Castling rook move
    if (pt == PT_KING)
    {
        if (us == CHESS_WHITE && m->from == 4)
        {
            if (m->to == 6)
            {
                clear_bit(&b->pieces[PT_ROOK], 7);
                clear_bit(&b->color[CHESS_WHITE], 7);
                set_bit(&b->pieces[PT_ROOK], 5);
                set_bit(&b->color[CHESS_WHITE], 5);
            }
            else if (m->to == 2)
            {
                clear_bit(&b->pieces[PT_ROOK], 0);
                clear_bit(&b->color[CHESS_WHITE], 0);
                set_bit(&b->pieces[PT_ROOK], 3);
                set_bit(&b->color[CHESS_WHITE], 3);
            }
        }
        else if (us == CHESS_BLACK && m->from == 60)
        {
            if (m->to == 62)
            {
                clear_bit(&b->pieces[PT_ROOK], 63);
                clear_bit(&b->color[CHESS_BLACK], 63);
                set_bit(&b->pieces[PT_ROOK], 61);
                set_bit(&b->color[CHESS_BLACK], 61);
            }
            else if (m->to == 58)
            {
                clear_bit(&b->pieces[PT_ROOK], 56);
                clear_bit(&b->color[CHESS_BLACK], 56);
                set_bit(&b->pieces[PT_ROOK], 59);
                set_bit(&b->color[CHESS_BLACK], 59);
            }
        }
    }

    // Set en passant square after pawn double move
    if (pt == PT_PAWN)
    {
        int dr = (int)rank_of(m->to) - (int)rank_of(m->from);
        if (us == CHESS_WHITE && dr == 2)
            new_ep = (uint8_t)(m->from + 8);
        else if (us == CHESS_BLACK && dr == -2)
            new_ep = (uint8_t)(m->from - 8);
    }
    b->en_passant = new_ep;

    if (pt == PT_PAWN || did_capture)
        b->halfmove = 0;
    else if (b->halfmove < 255)
        b->halfmove++;

    // switch turn (important for stalemate/checkmate search)
    b->to_move = them;
}

static int has_any_legal_move(const ChessBoard* b)
{
    // Brute force search: for each from-square of side-to-move, try all targets.
    if (!b) return 0;
    uint8_t us = b->to_move;
    uint64_t froms = occ_color(b, us);
    if (!froms) return 0;

    for (uint8_t from = 0; from < 64; ++from)
    {
        if (!get_bit(froms, from))
            continue;
        for (uint8_t to = 0; to < 64; ++to)
        {
            if (to == from) continue;
            Move m;
            m.from = from;
            m.to = to;
            m.promo = 0;
            m.flags = 0;
            if (chess_is_legal_move(b, &m))
                return 1;
        }
    }
    return 0;
}

int chess_is_checkmate(const ChessBoard* b)
{
    // Checkmate is defined for the side to move.
    if (!b) return 0;
    if (!chess_is_in_check(b, b->to_move))
        return 0;
    return has_any_legal_move(b) ? 0 : 1;
}

static int is_stalemate(const ChessBoard* b)
{
    if (!b) return 0;
    if (chess_is_in_check(b, b->to_move))
        return 0;
    return has_any_legal_move(b) ? 0 : 1;
}

static int is_clear_path(const ChessBoard* b, uint8_t from, uint8_t to, int step)
{
    // from and to are assumed valid squares, step is signed delta in [ -9..9 ] etc.
    uint64_t occ = occ_all(b);
    int sfrom = (int)from;
    int sto = (int)to;
    for (int sq = sfrom + step; sq != sto; sq += step)
    {
        if (sq < 0 || sq > 63)
            return 0;
        if (occ & (1ULL << (uint8_t)sq))
            return 0;
    }
    return 1;
}

static inline uint32_t popcount64(uint64_t x)
{
#if defined(__GNUC__) || defined(__clang__)
    return (uint32_t)__builtin_popcountll(x);
#else
    uint32_t cnt = 0;
    while (x) { x &= (x - 1); ++cnt; }
    return cnt;
#endif
}

static inline uint8_t square_color(uint8_t sq)
{
    // 0 = dark, 1 = light (arbitrary but consistent)
    return (uint8_t)((file_of(sq) + rank_of(sq)) & 1);
}

void chess_init_startpos(ChessBoard* b)
{
    if (!b)
        return;

    for (int i = 0; i < 6; ++i)
        b->pieces[i] = 0ULL;

    b->color[CHESS_WHITE] = 0ULL;
    b->color[CHESS_BLACK] = 0ULL;

    // a1=0 ... h1=7, a2=8 ... h2=15
    // White
    b->pieces[PT_PAWN]   |= 0x000000000000FF00ULL; // rank 2
    b->pieces[PT_ROOK]   |= 0x0000000000000081ULL; // a1,h1
    b->pieces[PT_KNIGHT] |= 0x0000000000000042ULL; // b1,g1
    b->pieces[PT_BISHOP] |= 0x0000000000000024ULL; // c1,f1
    b->pieces[PT_QUEEN]  |= 0x0000000000000008ULL; // d1
    b->pieces[PT_KING]   |= 0x0000000000000010ULL; // e1
    b->color[CHESS_WHITE] = 0x000000000000FFFFULL; // ranks 1-2

    // Black
    b->pieces[PT_PAWN]   |= 0x00FF000000000000ULL; // rank 7
    b->pieces[PT_ROOK]   |= 0x8100000000000000ULL; // a8,h8
    b->pieces[PT_KNIGHT] |= 0x4200000000000000ULL; // b8,g8
    b->pieces[PT_BISHOP] |= 0x2400000000000000ULL; // c8,f8
    b->pieces[PT_QUEEN]  |= 0x0800000000000000ULL; // d8
    b->pieces[PT_KING]   |= 0x1000000000000000ULL; // e8
    b->color[CHESS_BLACK] = 0xFFFF000000000000ULL; // ranks 7-8

    b->en_passant = 0xFF;
    b->castling = 0x0F;
    b->to_move = CHESS_WHITE;
    b->halfmove = 0;
}

int chess_is_legal_move(const ChessBoard* b, const Move* m)
{
    if (!b || !m)
        return 0;
    if (m->from > 63 || m->to > 63)
        return 0;
    if (m->from == m->to)
        return 0;

    uint8_t us = b->to_move;
    uint8_t them = (us == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;

    // Must move our own piece
    if (!get_bit(b->color[us], m->from))
        return 0;

    // Can't capture our own piece
    if (get_bit(b->color[us], m->to))
        return 0;

    piece_type_t pt = piece_at(b, m->from);
    if (pt == PT_NONE)
        return 0;

    uint8_t ff = file_of(m->from);
    uint8_t fr = rank_of(m->from);
    uint8_t tf = file_of(m->to);
    uint8_t tr = rank_of(m->to);
    int df = (int)tf - (int)ff;
    int dr = (int)tr - (int)fr;
    int adf = abs_i(df);
    int adr = abs_i(dr);

    uint64_t occ = occ_all(b);
    uint8_t to_is_enemy = get_bit(b->color[them], m->to);

    int pseudo_ok = 0;
    int is_castle = 0;
    uint8_t castle_mid_sq = 0xFF;   // square king passes through
    uint8_t castle_from_sq = m->from;

    switch (pt)
    {
        case PT_PAWN:
        {
            // No promotions enforced yet; legality is about movement pattern.
            // White pawns go +1 rank (sq +8). Black go -1 rank (sq -8).
            int dir = (us == CHESS_WHITE) ? 1 : -1;

            // Single push
            if (df == 0 && dr == dir)
            {
                pseudo_ok = !get_bit(occ, m->to);
                break;
            }

            // Double push from start rank
            if (df == 0 && dr == 2 * dir)
            {
                if (us == CHESS_WHITE && fr != 1) return 0;
                if (us == CHESS_BLACK && fr != 6) return 0;

                uint8_t mid = (uint8_t)((int)m->from + dir * 8);
                if (get_bit(occ, mid)) { pseudo_ok = 0; break; }
                if (get_bit(occ, m->to)) { pseudo_ok = 0; break; }
                pseudo_ok = 1;
                break;
            }

            // Capture
            if (adr == 1 && dr == dir)
            {
                // normal capture
                if (to_is_enemy)
                {
                    pseudo_ok = 1;
                    break;
                }

                // en passant capture (target square empty, matches en_passant)
                if (b->en_passant != 0xFF && m->to == b->en_passant)
                {
                    // captured pawn is behind the ep square
                    uint8_t cap_sq = (uint8_t)((int)m->to - dir * 8);
                    if (get_bit(b->color[them], cap_sq) && get_bit(b->pieces[PT_PAWN], cap_sq))
                    {
                        pseudo_ok = 1;
                        break;
                    }
                }
            }
            break;
        }

        case PT_KNIGHT:
            pseudo_ok = ((adf == 1 && adr == 2) || (adf == 2 && adr == 1)) ? 1 : 0;
            break;

        case PT_BISHOP:
        {
            if (adf != adr || adf == 0)
            {
                pseudo_ok = 0;
                break;
            }
            // Determine step: NE(+9), NW(+7), SE(-7), SW(-9)
            int step = 0;
            if (df > 0 && dr > 0) step = 9;
            else if (df < 0 && dr > 0) step = 7;
            else if (df > 0 && dr < 0) step = -7;
            else if (df < 0 && dr < 0) step = -9;
            else { pseudo_ok = 0; break; }
            pseudo_ok = is_clear_path(b, m->from, m->to, step);
            break;
        }

        case PT_ROOK:
        {
            if (!(df == 0 || dr == 0) || (df == 0 && dr == 0))
            {
                pseudo_ok = 0;
                break;
            }
            int step = 0;
            if (df == 0) step = (dr > 0) ? 8 : -8;
            else step = (df > 0) ? 1 : -1;

            // Rook horizontal moves must not wrap across files.
            // The df/dr checks ensure we're on same rank for horizontal.
            pseudo_ok = is_clear_path(b, m->from, m->to, step);
            break;
        }

        case PT_QUEEN:
        {
            // Combine rook+bishop
            if (adf == adr && adf != 0)
            {
                int step = 0;
                if (df > 0 && dr > 0) step = 9;
                else if (df < 0 && dr > 0) step = 7;
                else if (df > 0 && dr < 0) step = -7;
                else if (df < 0 && dr < 0) step = -9;
                else { pseudo_ok = 0; break; }
                pseudo_ok = is_clear_path(b, m->from, m->to, step);
                break;
            }
            if ((df == 0 || dr == 0) && !(df == 0 && dr == 0))
            {
                int step = 0;
                if (df == 0) step = (dr > 0) ? 8 : -8;
                else step = (df > 0) ? 1 : -1;
                pseudo_ok = is_clear_path(b, m->from, m->to, step);
                break;
            }
            pseudo_ok = 0;
            break;
        }

        case PT_KING:
        {
            // Basic king moves
            if (adf <= 1 && adr <= 1)
            {
                pseudo_ok = 1;
                break;
            }

            // Basic castling pattern checks
            // White king: e1(4) -> g1(6) or c1(2)
            // Black king: e8(60) -> g8(62) or c8(58)
            if (us == CHESS_WHITE && m->from == 4)
            {
                // King-side
                if (m->to == 6)
                {
                    if (!(b->castling & 0x01)) return 0;
                    if ((occ & (bb_mask(5) | bb_mask(6))) != 0) return 0;
                    // rook presence at h1
                    if (!get_bit(b->pieces[PT_ROOK], 7) || !get_bit(b->color[CHESS_WHITE], 7)) return 0;
                    is_castle = 1;
                    castle_mid_sq = 5;
                    pseudo_ok = 1;
                    break;
                }
                // Queen-side
                if (m->to == 2)
                {
                    if (!(b->castling & 0x02)) return 0;
                    if ((occ & (bb_mask(1) | bb_mask(2) | bb_mask(3))) != 0) return 0;
                    if (!get_bit(b->pieces[PT_ROOK], 0) || !get_bit(b->color[CHESS_WHITE], 0)) return 0;
                    is_castle = 1;
                    castle_mid_sq = 3;
                    pseudo_ok = 1;
                    break;
                }
            }
            if (us == CHESS_BLACK && m->from == 60)
            {
                if (m->to == 62)
                {
                    if (!(b->castling & 0x04)) return 0;
                    if ((occ & (bb_mask(61) | bb_mask(62))) != 0) return 0;
                    if (!get_bit(b->pieces[PT_ROOK], 63) || !get_bit(b->color[CHESS_BLACK], 63)) return 0;
                    is_castle = 1;
                    castle_mid_sq = 61;
                    pseudo_ok = 1;
                    break;
                }
                if (m->to == 58)
                {
                    if (!(b->castling & 0x08)) return 0;
                    if ((occ & (bb_mask(57) | bb_mask(58) | bb_mask(59))) != 0) return 0;
                    if (!get_bit(b->pieces[PT_ROOK], 56) || !get_bit(b->color[CHESS_BLACK], 56)) return 0;
                    is_castle = 1;
                    castle_mid_sq = 59;
                    pseudo_ok = 1;
                    break;
                }
            }
            break;
        }

        default:
            pseudo_ok = 0;
            break;
    }

    if (!pseudo_ok)
        return 0;

    // Castling legality: king cannot be in check, and cannot pass through or
    // land on an attacked square.
    if (is_castle)
    {
        if (chess_is_in_check(b, us))
            return 0;
        if (castle_mid_sq != 0xFF && is_square_attacked(b, castle_mid_sq, them))
            return 0;
        if (is_square_attacked(b, m->to, them))
            return 0;
        (void)castle_from_sq;
    }

    // Self-check validation: simulate move and ensure our king is not attacked.
    ChessBoard tmp = *b;
    apply_move_unchecked(&tmp, m);
    if (chess_is_in_check(&tmp, us))
        return 0;

    return 1;
}

void chess_make_move(ChessBoard* b, const Move* m)
{
    if (!b || !m)
        return;

    // If caller doesn't validate legality, fail-safe: do nothing.
    if (!chess_is_legal_move(b, m))
        return;

    uint8_t us = b->to_move;
    uint8_t them = (us == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;

    piece_type_t pt = piece_at(b, m->from);
    if (pt == PT_NONE)
        return;

    uint64_t occ_before = occ_all(b);

    // Reset en passant by default; set again for double pawn moves.
    uint8_t new_ep = 0xFF;

    // Captures: normal capture (piece exists on 'to')
    // or en-passant capture (pawn to en_passant square).
    uint8_t captured_sq = m->to;
    piece_type_t captured_pt = piece_at(b, m->to);
    int did_capture = 0;

    // En passant capture detection
    if (pt == PT_PAWN && b->en_passant != 0xFF && m->to == b->en_passant && !get_bit(occ_before, m->to))
    {
        int dir = (us == CHESS_WHITE) ? 1 : -1;
        captured_sq = (uint8_t)((int)m->to - dir * 8);
        captured_pt = piece_at(b, captured_sq);
    }

    if (captured_pt != PT_NONE && get_bit(b->color[them], captured_sq))
    {
        clear_bit(&b->pieces[captured_pt], captured_sq);
        clear_bit(&b->color[them], captured_sq);
        did_capture = 1;

        // Capturing a rook from its initial square removes opponent castling right.
        if (captured_pt == PT_ROOK)
        {
            if (captured_sq == 0)  b->castling &= (uint8_t)~0x02;
            if (captured_sq == 7)  b->castling &= (uint8_t)~0x01;
            if (captured_sq == 56) b->castling &= (uint8_t)~0x08;
            if (captured_sq == 63) b->castling &= (uint8_t)~0x04;
        }
    }

    // Move piece bit + color occupancy
    clear_bit(&b->pieces[pt], m->from);
    clear_bit(&b->color[us], m->from);
    set_bit(&b->pieces[pt], m->to);
    set_bit(&b->color[us], m->to);

    // Special: castling rook move (if king moved two files)
    if (pt == PT_KING)
    {
        // Remove our castling rights when king moves
        if (us == CHESS_WHITE) b->castling &= (uint8_t)~(0x01 | 0x02);
        else                  b->castling &= (uint8_t)~(0x04 | 0x08);

        // White
        if (us == CHESS_WHITE && m->from == 4)
        {
            // O-O: rook h1 -> f1
            if (m->to == 6)
            {
                clear_bit(&b->pieces[PT_ROOK], 7);
                clear_bit(&b->color[CHESS_WHITE], 7);
                set_bit(&b->pieces[PT_ROOK], 5);
                set_bit(&b->color[CHESS_WHITE], 5);
            }
            // O-O-O: rook a1 -> d1
            else if (m->to == 2)
            {
                clear_bit(&b->pieces[PT_ROOK], 0);
                clear_bit(&b->color[CHESS_WHITE], 0);
                set_bit(&b->pieces[PT_ROOK], 3);
                set_bit(&b->color[CHESS_WHITE], 3);
            }
        }
        // Black
        if (us == CHESS_BLACK && m->from == 60)
        {
            // O-O: rook h8 -> f8
            if (m->to == 62)
            {
                clear_bit(&b->pieces[PT_ROOK], 63);
                clear_bit(&b->color[CHESS_BLACK], 63);
                set_bit(&b->pieces[PT_ROOK], 61);
                set_bit(&b->color[CHESS_BLACK], 61);
            }
            // O-O-O: rook a8 -> d8
            else if (m->to == 58)
            {
                clear_bit(&b->pieces[PT_ROOK], 56);
                clear_bit(&b->color[CHESS_BLACK], 56);
                set_bit(&b->pieces[PT_ROOK], 59);
                set_bit(&b->color[CHESS_BLACK], 59);
            }
        }
    }

    // Special: moving a rook from initial square clears that side's castling.
    if (pt == PT_ROOK)
    {
        if (m->from == 0)  b->castling &= (uint8_t)~0x02;
        if (m->from == 7)  b->castling &= (uint8_t)~0x01;
        if (m->from == 56) b->castling &= (uint8_t)~0x08;
        if (m->from == 63) b->castling &= (uint8_t)~0x04;
    }

    // Special: pawn double-move creates en passant square
    if (pt == PT_PAWN)
    {
        int dr = (int)rank_of(m->to) - (int)rank_of(m->from);
        if (us == CHESS_WHITE && dr == 2)
            new_ep = (uint8_t)(m->from + 8);
        else if (us == CHESS_BLACK && dr == -2)
            new_ep = (uint8_t)(m->from - 8);
    }
    b->en_passant = new_ep;

    // Halfmove clock: reset on pawn move or capture; else increment
    if (pt == PT_PAWN || did_capture)
        b->halfmove = 0;
    else if (b->halfmove < 255)
        b->halfmove++;

    // Switch side to move
    b->to_move = them;
}

int chess_is_forced_draw(const ChessBoard* b)
{
    if (!b)
        return 0;

    // 50-move rule (half-moves >= 100)
    if (b->halfmove >= 100)
        return 1;

    // Stalemate
    if (is_stalemate(b))
        return 1;

    // Insufficient material
    uint64_t wp = b->pieces[PT_PAWN] & b->color[CHESS_WHITE];
    uint64_t bp = b->pieces[PT_PAWN] & b->color[CHESS_BLACK];
    uint64_t wr = b->pieces[PT_ROOK] & b->color[CHESS_WHITE];
    uint64_t br = b->pieces[PT_ROOK] & b->color[CHESS_BLACK];
    uint64_t wq = b->pieces[PT_QUEEN] & b->color[CHESS_WHITE];
    uint64_t bq = b->pieces[PT_QUEEN] & b->color[CHESS_BLACK];

    if ((wp | bp | wr | br | wq | bq) != 0)
        return 0;

    uint64_t wn = b->pieces[PT_KNIGHT] & b->color[CHESS_WHITE];
    uint64_t bn = b->pieces[PT_KNIGHT] & b->color[CHESS_BLACK];
    uint64_t wb = b->pieces[PT_BISHOP] & b->color[CHESS_WHITE];
    uint64_t bb = b->pieces[PT_BISHOP] & b->color[CHESS_BLACK];

    uint32_t wn_c = popcount64(wn);
    uint32_t bn_c = popcount64(bn);
    uint32_t wb_c = popcount64(wb);
    uint32_t bb_c = popcount64(bb);

    // K vs K
    if (wn_c == 0 && bn_c == 0 && wb_c == 0 && bb_c == 0)
        return 1;

    // K + minor vs K
    if ((wn_c + wb_c == 1) && (bn_c + bb_c == 0))
        return 1;
    if ((bn_c + bb_c == 1) && (wn_c + wb_c == 0))
        return 1;

    // K+B vs K+B with bishops on same color
    if (wn_c == 0 && bn_c == 0 && wb_c == 1 && bb_c == 1)
    {
        uint8_t wbsq = 0xFF;
        uint8_t bbsq = 0xFF;
#if defined(__GNUC__) || defined(__clang__)
        wbsq = (uint8_t)__builtin_ctzll(wb);
        bbsq = (uint8_t)__builtin_ctzll(bb);
#else
        for (uint8_t i = 0; i < 64; ++i) { if (wb & (1ULL << i)) { wbsq = i; break; } }
        for (uint8_t i = 0; i < 64; ++i) { if (bb & (1ULL << i)) { bbsq = i; break; } }
#endif
        if (wbsq != 0xFF && bbsq != 0xFF && square_color(wbsq) == square_color(bbsq))
            return 1;
    }

    return 0;
}

uint8_t chess_count_material(const ChessBoard* b, uint8_t color)
{
    if (!b)
        return 0;
    if (color != CHESS_WHITE && color != CHESS_BLACK)
        return 0;

    uint64_t occ = b->color[color];
    // Count bits in (pieces[type] & occ)
    // Use builtin if available; fallback is deterministic loop.
    uint8_t total = 0;
    static const uint8_t val[6] = { 1, 3, 3, 5, 9, 0 };

    for (uint8_t pt = 0; pt < 6; ++pt)
    {
        uint64_t x = b->pieces[pt] & occ;
#if defined(__GNUC__) || defined(__clang__)
        uint32_t cnt = (uint32_t)__builtin_popcountll(x);
#else
        uint32_t cnt = 0;
        while (x) { x &= (x - 1); ++cnt; }
#endif
        // total fits in uint8_t for chess material (max 39)
        total = (uint8_t)(total + (uint8_t)(cnt * val[pt]));
    }
    return total;
}
