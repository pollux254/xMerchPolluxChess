#ifndef CHESS_TYPES_H
#define CHESS_TYPES_H

/**
 * Shared types for the Xahau Chess Hook.
 *
 * Phase 1: define stable structs and enums used by the hook core.
 * Phase 2+: the structs may be extended (carefully) while maintaining
 * deterministic, fixed-size storage.
 */

#include <stdint.h>

// Colors
typedef enum {
    CHESS_WHITE = 0,
    CHESS_BLACK = 1
} chess_color_t;

// Tournament status (per architecture doc)
typedef enum {
    TOURNAMENT_WAITING = 0,
    TOURNAMENT_ACTIVE = 1,
    TOURNAMENT_COMPLETE = 2,
    TOURNAMENT_CANCELLED = 3
} tournament_status_t;

// Match status
typedef enum {
    MATCH_WAITING = 0,
    MATCH_ACTIVE = 1,
    MATCH_COMPLETE = 2
} match_status_t;

// Result type (per architecture doc)
typedef enum {
    RESULT_CHECKMATE = 0,
    RESULT_RESIGN = 1,
    RESULT_DRAW_MATERIAL = 2,
    RESULT_TIME_FORFEIT = 3
} result_type_t;

// Game type (for bot vs ranked stats separation off-chain)
typedef enum {
    GAME_RANKED = 0,
    GAME_PRACTICE = 1
} game_type_t;

/**
 * ChessBoard
 *
 * Minimal bitboard-based board container.
 *
 * NOTE: This is intentionally conservative for Phase 1. Phase 2 will implement
 * full move legality + draw detection within hook constraints.
 */
typedef struct {
    uint64_t pieces[6];
    // Color occupancy bitboards (required because pieces[] are type-only boards)
    // color[CHESS_WHITE] = all white pieces occupancy
    // color[CHESS_BLACK] = all black pieces occupancy
    uint64_t color[2];
    uint8_t en_passant; // 0..63 or 0xFF
    uint8_t castling;   // bitmask: 1=WK 2=WQ 4=BK 8=BQ
    uint8_t to_move;    // CHESS_WHITE / CHESS_BLACK
    uint8_t halfmove;   // 50-move rule counter (half-moves)
} ChessBoard;

/**
 * Move
 *
 * Compact representation for on-chain parsing.
 * from/to are 0..63 (a1=0, b1=1 ... h8=63).
 */
typedef struct {
    uint8_t from;
    uint8_t to;
    uint8_t promo; // 0 none; 1=Q 2=R 3=B 4=N (TBD)
    uint8_t flags; // reserved
} Move;

typedef struct {
    uint8_t tournament_id[32];
    uint64_t entry_fee;
    char currency[3];
    uint8_t tournament_size; // 2,4,8,16
    uint8_t status;          // tournament_status_t
    uint8_t player_count;
    uint8_t players[16][20];
    uint64_t prize_pool;
    uint64_t created_at;     // ledger_time()
    uint8_t game_type;       // game_type_t
} TournamentState;

typedef struct {
    uint8_t match_id[32];
    uint8_t tournament_id[32];
    uint8_t player1[20];
    uint8_t player2[20];
    uint64_t player1_time_left; // milliseconds
    uint64_t player2_time_left;
    uint64_t last_move_time;    // ledger_time()
    ChessBoard board;
    uint8_t winner[20];
    uint8_t result_type;        // result_type_t
    uint8_t status;             // match_status_t
    uint8_t game_type;          // game_type_t
} MatchState;

#endif
