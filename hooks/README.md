# 🪝 Chess Wagering Hook

## ⚠️ Development Status
**Phase 1:** Hook core structure (in progress)
**Phase 2:** Full chess engine + tournament logic (planned)

## 📁 Files in This Directory

- `README.md` - This file
- `chess-wagering.c` - Main Hook entry point + transaction dispatch + handler skeletons
- `chess-types.h` - Shared structs/enums (TournamentState / MatchState / ChessBoard)
- `chess-engine.c` - Chess validation engine module (Phase 1: API stubs)
- `Makefile` - Build configuration (produces `chess-wagering.wasm`)
- `deploy-hook.sh` - Helper for deploying the compiled wasm

## 🛠️ Safe to Modify

✅ **YES - Modify freely:**
- `chess-wagering.c` - Hook logic
- `Makefile` - Build config
- This `README.md`

✅ **YES - New files:**
- `chess-engine.c` / `chess-types.h`

❌ **NO - Do not modify:**
- Files in `app/` (routing structure)
- Core pages (`app/page.tsx`, etc.)

## 🔗 Related Files

Hook integration functions are in:
- `lib/xahau-hooks.ts` - Frontend Hook calls

Frontend memo actions currently expected:
- `Payment` + memo JSON `{ action: "JOIN", ... }`
- `Invoke` + memo JSON `{ action: "MOVE" | "FORFEIT" | ... }`

## 📋 Next Steps

1. Implement robust memo parsing (slot-based) for `action`, `game_id`, `move`
2. Implement tournament state persistence and fill timer (10 min -> auto-refund)
3. Implement match state persistence, clocks (20 min/player), and move validation
4. Implement forced draw detection + material tiebreaker (LOWER material wins)
5. Implement prize distribution including 11% platform fee at tournament start

---

See `PROJECT_STRUCTURE.md` for full project layout.
