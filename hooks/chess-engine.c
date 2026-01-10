/**
 * Chess Validation Engine (Phase 1 skeleton)
 *
 * Phase 1 deliverable:
 * - Provide module + stable API signatures.
 * - No full chess validation yet (Phase 2).
 */

#include "hookapi.h"
#include "chess-types.h"

void chess_init_startpos(ChessBoard* b)
{
    if (!b)
        return;

    for (int i = 0; i < 6; ++i)
        b->pieces[i] = 0;

    b->en_passant = 0xFF;
    b->castling = 0x0F;
    b->to_move = CHESS_WHITE;
    b->halfmove = 0;
}

int chess_is_legal_move(const ChessBoard* b, const Move* m)
{
    (void)b;
    if (!m)
        return 0;
    if (m->from > 63 || m->to > 63)
        return 0;
    if (m->from == m->to)
        return 0;
    return 1;
}

void chess_make_move(ChessBoard* b, const Move* m)
{
    (void)m;
    if (!b)
        return;
    b->to_move = (b->to_move == CHESS_WHITE) ? CHESS_BLACK : CHESS_WHITE;
    if (b->halfmove < 255)
        b->halfmove++;
}

int chess_is_forced_draw(const ChessBoard* b)
{
    (void)b;
    return 0;
}

uint8_t chess_count_material(const ChessBoard* b, uint8_t color)
{
    (void)b;
    (void)color;
    return 0;
}
