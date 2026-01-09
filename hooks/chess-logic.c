/**
 * Chess Logic - Phase 1 (Stub)
 *
 * This file is intended to encapsulate chess-specific rules and move validation
 * so that the main hook file (chess-wagering.c) stays focused on:
 * - transaction parsing
 * - state read/write
 * - payouts
 *
 * In Phase 1 we only provide placeholders. In Phase 2 we will:
 * - implement piece move rules
 * - implement check/checkmate verification
 * - implement special moves (castling, en passant, promotion)
 * - implement draw rules
 *
 * NOTE:
 * Xahau Hooks run in a constrained environment. Avoid dynamic allocation.
 * Keep functions deterministic and defensive.
 */

#include "hookapi.h"

// Mirror constants from chess-wagering.c (kept local for now).
#define EMPTY 0
#define PAWN 1
#define ROOK 2
#define KNIGHT 3
#define BISHOP 4
#define QUEEN 5
#define KING 6

#define WHITE 0
#define BLACK 1

#define MOVE_VALID 0
#define MOVE_INVALID 1

/**
 * Minimal helper to validate bounds.
 */
static inline int in_bounds(uint8_t r, uint8_t c)
{
    return (r < 8 && c < 8);
}

/**
 * validate_move_stub
 *
 * Phase 1 placeholder that accepts any in-bounds move.
 *
 * TODO:
 * - validate turn ownership
 * - validate piece movement
 * - prevent illegal king exposure
 */
int64_t validate_move_stub(
    uint8_t board[8][8],
    uint8_t colors[8][8],
    uint8_t current_player,
    uint8_t from_row,
    uint8_t from_col,
    uint8_t to_row,
    uint8_t to_col)
{
    (void)board;
    (void)colors;
    (void)current_player;

    if (!in_bounds(from_row, from_col) || !in_bounds(to_row, to_col))
        return MOVE_INVALID;

    // Phase 1: accept any in-bounds move.
    return MOVE_VALID;
}
