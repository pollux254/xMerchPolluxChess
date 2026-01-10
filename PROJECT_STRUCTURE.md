# 🏗️ Project Structure - DO NOT MODIFY

## 🚨 CRITICAL FILES (Never Delete/Replace)

### **Core Pages** (defines routing)
```
app/
├── page.tsx                    # HOMEPAGE - Landing page with FAQ
├── chess/page.tsx              # Chess lobby (tournament entry)
├── waiting-room/page.tsx       # Waiting room (matchmaking)
└── gamechessboard/page.tsx     # Active game board
```

**⚠️ WARNING:** Deleting or replacing these breaks the entire site routing!

---

## ✅ Safe to Modify

### **Hook Integration**
```
hooks/
├── README.md                   # Hook documentation
├── chess-wagering.c            # Hook C code (in development)
└── Makefile                    # Build instructions
```

### **Libraries**
```
lib/
├── xahau-hooks.ts              # Hook interaction functions ✅
├── xahau-payload.ts            # Payment utilities
└── hook-state-reader.ts        # State reading (future)
```

### **API Routes**
```
app/api/
├── auth/xaman/                 # Payment/signin endpoints
└── tournaments/                # Tournament management
```

---

## 📋 Page Purposes

| File | Purpose | Can Modify? |
|------|---------|-------------|
| `app/page.tsx` | Landing page with FAQ, features | ❌ NO |
| `app/chess/page.tsx` | Tournament lobby | ⚠️ Carefully |
| `app/waiting-room/page.tsx` | Player matching | ⚠️ Carefully |
| `app/gamechessboard/page.tsx` | Active game | ⚠️ Carefully |
| `lib/xahau-hooks.ts` | Hook functions | ✅ YES (add functions) |
| `hooks/chess-wagering.c` | Hook logic | ✅ YES (in development) |

---

## 🛡️ Protection Rules

1. **Never replace `app/page.tsx`** - This is the homepage
2. **Never delete routing pages** - Breaks navigation
3. **Always ask before modifying core pages**
4. **Hook files (`hooks/`, `lib/xahau-hooks.ts`) are safe to develop**

---

## 🔄 If You Accidentally Break Something
```bash
# Restore a specific file from git
git checkout HEAD~1 -- app/page.tsx

# Or restore from specific commit
git checkout 4b086af -- app/page.tsx
```

---

## 📞 When in Doubt

Ask before modifying:
- Any file in `app/*.tsx` (routing pages)
- `.env` files
- `next.config.ts`

Safe to modify without asking:
- Files in `hooks/`
- Adding new functions to `lib/xahau-hooks.ts`
- API routes for new features
- Documentation files
