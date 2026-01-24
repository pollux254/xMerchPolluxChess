/**
 * PolluxChess Tournament Hook v2.0
 * - Accepts 10 XAH entry fees
 * - Tracks players in state
 * - Distributes prizes via Invoke transaction
 */

#include "hookapi.h"

int64_t hook(uint32_t reserved) {
    
    _g(1,1); // Guard function
    
    // Get transaction type
    uint32_t tt = otxn_type();
    
    //=============================================================
    // HANDLE INCOMING PAYMENTS (Entry Fees)
    //=============================================================
    if (tt == ttPAYMENT) {
        
        // Get payment amount
        uint8_t amount_buffer[48];
        int64_t amount_len = otxn_field(SBUF(amount_buffer), sfAmount);
        
        if (amount_len < 0)
            rollback(SBUF("PolluxChess: No amount"), 1);
        
        // Check if native XAH (8 bytes)
        if (amount_len != 8)
            rollback(SBUF("PolluxChess: Only XAH"), 2);
        
        // Convert to drops
        int64_t drops = AMOUNT_TO_DROPS(amount_buffer);
        int64_t required_entry = 10000000; // 10 XAH
        
        // Validate amount
        if (drops != required_entry)
            rollback(SBUF("PolluxChess: Entry fee is 10 XAH"), 3);
        
        // State key (32 bytes)
        uint8_t state_key[32] = {
            'P','L','X','_','P','L','A','Y','E','R','_','C','O','U','N','T',
            0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        };
        
        // Get current player count
        uint8_t player_count[1] = {0};
        state(SBUF(player_count), SBUF(state_key));
        
        // Increment
        player_count[0]++;
        
        // Save
        state_set(SBUF(player_count), SBUF(state_key));
        
        // Log
        TRACESTR("PolluxChess: Player joined!");
        TRACEHEX(player_count);
        
        if (player_count[0] >= 2) {
            TRACESTR("PolluxChess: Tournament ready!");
        }
        
        accept(SBUF("PolluxChess: Entry accepted"), 0);
    }
    
    //=============================================================
    // HANDLE PRIZE DISTRIBUTION (Invoke Transaction)
    //=============================================================
    if (tt == ttINVOKE) {
        
        TRACESTR("PolluxChess: Prize distribution triggered!");
        
        // Reserve slots for 2 emitted transactions
        etxn_reserve(2);
        
        // Get winner address from Invoke parameters
        uint8_t winner_addr[20];
        int64_t winner_len = otxn_param(SBUF(winner_addr), "winner", 6);
        
        if (winner_len != 20)
            rollback(SBUF("PolluxChess: Invalid winner address"), 10);
        
        // Platform fee address (your Xaman wallet: r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6)
        uint8_t platform_addr[20] = {
            0xFB, 0xA7, 0xC0, 0x14, 0x47, 0xE7, 0xBC, 0x4E, 0xD1, 0x4A,
            0x28, 0x52, 0x89, 0x7C, 0xE8, 0x46, 0xE3, 0x70, 0x0F, 0xA0
        };
        
        // Get hook account address
        uint8_t hook_accid[20];
        hook_account(SBUF(hook_accid));
        
        // Calculate prizes (assume 20 XAH pool = 2 players × 10 XAH)
        int64_t total_pool = 20000000; // 20 XAH in drops
        int64_t platform_fee = (total_pool * 11) / 100; // 2.2 XAH (11%)
        int64_t winner_prize = total_pool - platform_fee; // 17.8 XAH (89%)
        
        TRACESTR("PolluxChess: Distributing prizes...");
        TRACEHEX(&winner_prize);
        TRACEHEX(&platform_fee);
        
        // Convert amounts to XRP amount format
        uint8_t winner_amt[8];
        uint8_t platform_amt[8];
        UINT64_TO_BUF(winner_amt, winner_prize);
        UINT64_TO_BUF(platform_amt, platform_fee);
        
        // Payment 1: Winner
        uint8_t tx_winner[PREPARE_PAYMENT_SIMPLE_SIZE];
        PREPARE_PAYMENT_SIMPLE(tx_winner, winner_amt, winner_addr, 0, 0);
        
        uint8_t emithash1[32];
        int64_t emit_result1 = emit(SBUF(emithash1), SBUF(tx_winner));
        
        if (emit_result1 < 0)
            rollback(SBUF("PolluxChess: Winner payment failed"), 11);
        
        TRACESTR("PolluxChess: Winner paid!");
        
        // Payment 2: Platform
        uint8_t tx_platform[PREPARE_PAYMENT_SIMPLE_SIZE];
        PREPARE_PAYMENT_SIMPLE(tx_platform, platform_amt, platform_addr, 0, 0);
        
        uint8_t emithash2[32];
        int64_t emit_result2 = emit(SBUF(emithash2), SBUF(tx_platform));
        
        if (emit_result2 < 0)
            rollback(SBUF("PolluxChess: Platform fee failed"), 12);
        
        TRACESTR("PolluxChess: Platform fee paid!");
        
        // Reset player count for next tournament
        uint8_t count_key[32] = {
            'P','L','X','_','P','L','A','Y','E','R','_','C','O','U','N','T',
            0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        };
        uint8_t reset_count[1] = {0};
        state_set(SBUF(reset_count), SBUF(count_key));
        
        accept(SBUF("PolluxChess: Tournament complete!"), 0);
    }
    
    // Reject any other transaction types
    rollback(SBUF("PolluxChess: Invalid transaction type"), 99);
    
    return 0;
}