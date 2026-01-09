/**
 * Chess Wagering Hook - Phase 1 MVP
 * 
 * Handles:
 * - 1v1 tournament entry (10 XAH payment)
 * - Waiting room management
 * - Move validation
 * - Prize distribution (17 XAH to winner, 3 XAH rake)
 */

#include "hookapi.h"

// State key namespaces
#define NS_GAMES 0x01
#define NS_WAITING 0x02
#define NS_PROFILES 0x03
#define NS_GLOBAL 0xFF

// Game constants
#define ENTRY_FEE 10000000      // 10 XAH in drops
#define RAKE_PERCENT 15         // 15% rake
#define TIMEOUT_LEDGERS 150     // ~10 minutes
#define MAX_WAITING_PLAYERS 100 // Maximum players in waiting room

// Game states
#define GAME_WAITING 0
#define GAME_ACTIVE 1
#define GAME_FINISHED 2

// Chess piece types
#define EMPTY 0
#define PAWN 1
#define ROOK 2
#define KNIGHT 3
#define BISHOP 4
#define QUEEN 5
#define KING 6

// Colors
#define WHITE 0
#define BLACK 1

// Move result codes
#define MOVE_VALID 0
#define MOVE_INVALID 1
#define MOVE_CHECKMATE 2
#define MOVE_STALEMATE 3
#define MOVE_DRAW 4

/**
 * Game state structure (stored in Hook state)
 * Key: NS_GAMES || game_id (32 bytes)
 */
typedef struct {
    uint8_t board[8][8];        // Chess board state
    uint8_t colors[8][8];       // Piece colors
    uint8_t current_player;     // 0 = white, 1 = black
    uint8_t game_status;        // GAME_WAITING, GAME_ACTIVE, GAME_FINISHED
    uint8_t white_player[20];   // White player account ID
    uint8_t black_player[20];   // Black player account ID
    uint32_t start_ledger;      // Ledger when game started
    uint32_t last_move_ledger;  // Ledger of last move
    uint16_t move_count;        // Total moves made
    uint8_t winner;             // 0 = white, 1 = black, 2 = draw
} game_state_t;

/**
 * Waiting room entry structure
 * Key: NS_WAITING || player_account (20 bytes)
 */
typedef struct {
    uint8_t player_account[20]; // Player account ID
    uint32_t join_ledger;       // Ledger when joined waiting room
    uint64_t entry_fee_paid;    // Amount paid in drops
} waiting_entry_t;

/**
 * Player profile structure
 * Key: NS_PROFILES || player_account (20 bytes)
 */
typedef struct {
    uint8_t player_account[20]; // Player account ID
    uint32_t games_played;      // Total games played
    uint32_t games_won;         // Total games won
    uint64_t total_winnings;    // Total XAH won in drops
    uint32_t last_game_ledger;  // Last game ledger
} player_profile_t;

/**
 * Global statistics structure
 * Key: NS_GLOBAL || 0x00...00 (32 bytes of zeros)
 */
typedef struct {
    uint32_t total_games;       // Total games played
    uint64_t total_volume;      // Total XAH wagered
    uint64_t total_rake;        // Total rake collected
    uint32_t active_games;      // Currently active games
    uint32_t waiting_players;   // Players in waiting room
} global_stats_t;

// Forward declarations
int64_t handle_join(uint32_t reserved);
int64_t handle_move(uint32_t reserved);
int64_t handle_timeout(uint32_t reserved);
int64_t handle_forfeit(uint32_t reserved);
int64_t validate_chess_move(game_state_t* game, uint8_t from_row, uint8_t from_col, uint8_t to_row, uint8_t to_col);
int64_t check_game_end(game_state_t* game);
int64_t distribute_prize(game_state_t* game);
int64_t cleanup_waiting_room();
int64_t update_player_profile(uint8_t* player_account, int won, uint64_t winnings);
int64_t update_global_stats(int games_delta, uint64_t volume_delta, uint64_t rake_delta, int active_delta, int waiting_delta);

/**
 * Main hook entry point
 * Called for every transaction sent to this Hook account
 */
int64_t hook(uint32_t reserved) {
    TRACESTR("Chess Wagering Hook: Transaction received");
    
    // Get transaction type
    uint8_t tx_type[1];
    if (otxn_field(SBUF(tx_type), sfTransactionType) != 1) {
        TRACESTR("Chess Hook: Could not determine transaction type");
        return 0; // Accept but ignore
    }
    
    // Handle different transaction types
    switch (tx_type[0]) {
        case ttPAYMENT: {
            TRACESTR("Chess Hook: Processing Payment transaction");
            
            // Check if this is a tournament entry payment
            uint8_t memo_data[256];
            int64_t memo_len = otxn_field(SBUF(memo_data), sfMemos);
            
            if (memo_len > 0) {
                // Parse memo to determine action
                // Expected format: {"action": "JOIN", "mode": "1v1"}
                // For now, assume all payments are JOIN requests
                return handle_join(reserved);
            }
            
            TRACESTR("Chess Hook: Payment without valid memo");
            return 0;
        }
        
        case ttINVOKE: {
            TRACESTR("Chess Hook: Processing Invoke transaction");
            
            // Parse memo for action type
            uint8_t memo_data[256];
            int64_t memo_len = otxn_field(SBUF(memo_data), sfMemos);
            
            if (memo_len > 0) {
                // Parse memo to determine action
                // Expected actions: MOVE, FORFEIT, TIMEOUT
                // For now, assume all invokes are MOVE requests
                return handle_move(reserved);
            }
            
            TRACESTR("Chess Hook: Invoke without valid memo");
            return 0;
        }
        
        default:
            TRACESTR("Chess Hook: Unsupported transaction type");
            return 0; // Accept but ignore
    }
}

/**
 * Handle tournament entry (JOIN action)
 * Player sends 10 XAH payment to join waiting room
 */
int64_t handle_join(uint32_t reserved) {
    TRACESTR("Chess Hook: Handling JOIN request");
    
    // Get payment amount
    uint8_t amount_buf[8];
    if (otxn_field(SBUF(amount_buf), sfAmount) != 8) {
        TRACESTR("Chess Hook: Could not get payment amount");
        rollback(SBUF("Invalid payment amount"), 1);
        return 0;
    }
    
    uint64_t amount = UINT64_FROM_BUF(amount_buf);
    
    // Validate entry fee
    if (amount != ENTRY_FEE) {
        TRACESTR("Chess Hook: Invalid entry fee amount");
        rollback(SBUF("Entry fee must be exactly 10 XAH"), 2);
        return 0;
    }
    
    // Get sender account
    uint8_t sender_account[20];
    if (otxn_field(SBUF(sender_account), sfAccount) != 20) {
        TRACESTR("Chess Hook: Could not get sender account");
        rollback(SBUF("Could not identify sender"), 3);
        return 0;
    }
    
    // Check if player is already in waiting room
    uint8_t waiting_key[32];
    waiting_key[0] = NS_WAITING;
    for (int i = 0; i < 20; i++) {
        waiting_key[i + 1] = sender_account[i];
    }
    // Pad remaining bytes with zeros
    for (int i = 21; i < 32; i++) {
        waiting_key[i] = 0;
    }
    
    uint8_t existing_entry[sizeof(waiting_entry_t)];
    if (state(SBUF(existing_entry), SBUF(waiting_key)) == sizeof(waiting_entry_t)) {
        TRACESTR("Chess Hook: Player already in waiting room");
        rollback(SBUF("Already in waiting room"), 4);
        return 0;
    }
    
    // TODO: Check if player is already in an active game
    
    // Add player to waiting room
    waiting_entry_t new_entry;
    for (int i = 0; i < 20; i++) {
        new_entry.player_account[i] = sender_account[i];
    }
    new_entry.join_ledger = ledger_seq();
    new_entry.entry_fee_paid = amount;
    
    if (state_set(SBUF(new_entry), SBUF(waiting_key)) != sizeof(waiting_entry_t)) {
        TRACESTR("Chess Hook: Failed to add player to waiting room");
        rollback(SBUF("Failed to join waiting room"), 5);
        return 0;
    }
    
    TRACESTR("Chess Hook: Player added to waiting room");
    
    // TODO: Check if we can start a game (2 players waiting)
    // TODO: If yes, create new game and remove players from waiting room
    // TODO: Update global statistics
    
    // Emit event
    uint8_t event_data[64];
    event_data[0] = 'J'; // JOIN event
    for (int i = 0; i < 20; i++) {
        event_data[i + 1] = sender_account[i];
    }
    emit(SBUF(event_data));
    
    accept(SBUF("Joined waiting room"), 0);
    return 0;
}

/**
 * Handle chess move submission (MOVE action)
 * Player submits move via Invoke transaction
 */
int64_t handle_move(uint32_t reserved) {
    TRACESTR("Chess Hook: Handling MOVE request");
    
    // TODO: Parse memo for game_id and move notation (e.g., "e2e4")
    // TODO: Load game state from Hook storage
    // TODO: Validate it's the player's turn
    // TODO: Validate move is legal
    // TODO: Update board state
    // TODO: Check for checkmate/stalemate/draw
    // TODO: If game ends, distribute prizes
    // TODO: Update player profiles and global stats
    // TODO: Emit move event
    
    accept(SBUF("Move processed"), 0);
    return 0;
}

/**
 * Handle game timeout
 * Called when a player takes too long to move
 */
int64_t handle_timeout(uint32_t reserved) {
    TRACESTR("Chess Hook: Handling TIMEOUT");
    
    // TODO: Check waiting room for expired entries (refund)
    // TODO: Check active games for move timeouts (opponent wins)
    // TODO: Distribute prizes for timed-out games
    // TODO: Update statistics
    
    accept(SBUF("Timeout processed"), 0);
    return 0;
}

/**
 * Handle forfeit
 * Player forfeits the game
 */
int64_t handle_forfeit(uint32_t reserved) {
    TRACESTR("Chess Hook: Handling FORFEIT");
    
    // TODO: Load game state
    // TODO: Validate player is in the game
    // TODO: Award win to opponent
    // TODO: Distribute prizes
    // TODO: Update player profiles and global stats
    // TODO: Emit forfeit event
    
    accept(SBUF("Forfeit processed"), 0);
    return 0;
}

/**
 * Validate chess move legality
 * Returns MOVE_VALID, MOVE_INVALID, MOVE_CHECKMATE, etc.
 */
int64_t validate_chess_move(game_state_t* game, uint8_t from_row, uint8_t from_col, uint8_t to_row, uint8_t to_col) {
    // TODO: Implement chess move validation
    // - Check piece exists at from position
    // - Check piece belongs to current player
    // - Check move is legal for piece type
    // - Check path is clear (for sliding pieces)
    // - Check move doesn't leave king in check
    // - Check for special moves (castling, en passant)
    
    return MOVE_VALID;
}

/**
 * Check if game has ended (checkmate, stalemate, draw)
 * Returns game end status
 */
int64_t check_game_end(game_state_t* game) {
    // TODO: Implement game end detection
    // - Check for checkmate
    // - Check for stalemate
    // - Check for draw conditions (50-move rule, repetition, insufficient material)
    
    return 0; // Game continues
}

/**
 * Distribute prize money to winner
 * 85% to winner, 15% rake to Hook account
 */
int64_t distribute_prize(game_state_t* game) {
    TRACESTR("Chess Hook: Distributing prizes");
    
    uint64_t total_pot = ENTRY_FEE * 2; // 20 XAH total
    uint64_t rake_amount = (total_pot * RAKE_PERCENT) / 100; // 3 XAH rake
    uint64_t winner_amount = total_pot - rake_amount; // 17 XAH to winner
    
    // TODO: Send payment to winner
    // TODO: Keep rake in Hook account
    // TODO: Emit prize distribution event
    
    return 0;
}

/**
 * Clean up expired waiting room entries
 * Refund players who waited too long
 */
int64_t cleanup_waiting_room() {
    TRACESTR("Chess Hook: Cleaning up waiting room");
    
    // TODO: Iterate through waiting room entries
    // TODO: Check for expired entries (older than TIMEOUT_LEDGERS)
    // TODO: Refund expired entries
    // TODO: Remove from waiting room
    
    return 0;
}

/**
 * Update player profile statistics
 */
int64_t update_player_profile(uint8_t* player_account, int won, uint64_t winnings) {
    // TODO: Load existing profile or create new one
    // TODO: Update games_played, games_won, total_winnings
    // TODO: Save updated profile
    
    return 0;
}

/**
 * Update global statistics
 */
int64_t update_global_stats(int games_delta, uint64_t volume_delta, uint64_t rake_delta, int active_delta, int waiting_delta) {
    // TODO: Load global stats
    // TODO: Apply deltas
    // TODO: Save updated stats
    
    return 0;
}