Tournament Cleanup System - Implementation Guide
🎯 Problem
Old tournaments with "waiting" status never get cleaned up, causing:

Database clutter
Confusing player counts (0/2)
Stale tournament rooms

✅ Solution - 3 New API Routes
1. Leave Route - Players manually leave tournaments
Path: /app/api/tournaments/leave/route.ts
File: tournament-leave-route.ts
When it's called:

Player clicks logout while in waiting room
Player manually leaves a tournament

2. Expire Route - Auto-expire old tournaments
Path: /app/api/tournaments/expire/route.ts
File: tournament-expire-route.ts
When it's called:

Every 5-10 minutes via cron job
OR when waiting room page loads (as a safety check)

3. Manual Cleanup - One-time cleanup of existing mess
Path: /app/api/tournaments/manual-cleanup/route.ts
File: tournament-manual-cleanup-route.ts
When to use: Run ONCE now to clean up existing stuck tournaments, then delete this file

🚀 Implementation Steps
Step 1: Add the Routes
Create these 3 files in your project:

/app/api/tournaments/leave/route.ts ← tournament-leave-route.ts
/app/api/tournaments/expire/route.ts ← tournament-expire-route.ts
/app/api/tournaments/manual-cleanup/route.ts ← tournament-manual-cleanup-route.ts

Step 2: Run Manual Cleanup (ONE TIME)
In your browser or Postman:
POST https://xmerch-polluxchess.vercel.app/api/tournaments/manual-cleanup
This will:

Find all "waiting" tournaments
Cancel them
Remove all players
Clean up your database

After running this once, DELETE the manual-cleanup route file!
Step 3: Update Waiting Room Page
The waiting room needs to call the expire endpoint periodically. Share your waiting room page file and I'll add this logic.
Step 4: (Optional) Set Up Cron Job
For automatic cleanup, set up a Vercel Cron Job:
Create: /vercel.json
json{
  "crons": [{
    "path": "/api/tournaments/expire",
    "schedule": "*/10 * * * *"
  }]
}
This runs expire every 10 minutes automatically.
Add to .env.local:
envCRON_SECRET=your-random-secret-here-abc123xyz

📋 What Each Route Does
Leave Route
POST /api/tournaments/leave
Body: { playerAddress, tournamentId }

Removes player from tournament
If last player, cancels tournament
Called when player logs out or manually leaves

Expire Route
POST /api/tournaments/expire

Finds tournaments in "waiting" status > 10 minutes old
Changes status to "expired"
Removes all players
Called automatically via cron or waiting room

Manual Cleanup (ONE TIME USE)
POST /api/tournaments/manual-cleanup

Cleans ALL waiting tournaments
Use once to fix current mess
Then delete this file


🔧 Database Changes Expected
After implementing:
Before:
tournaments table:
- XAH_2_10_MAINNET_ROOM1 | waiting | (created yesterday)
- XAH_2_10_TESTNET_ROOM1 | waiting | (created yesterday)
- XAH_2_10_TESTNET_ROOM2 | waiting | (created yesterday)
After manual cleanup:
tournaments table:
- XAH_2_10_MAINNET_ROOM1 | cancelled | "Manual cleanup - old waiting tournament"
- XAH_2_10_TESTNET_ROOM1 | cancelled | "Manual cleanup - old waiting tournament"
- XAH_2_10_TESTNET_ROOM2 | cancelled | "Manual cleanup - old waiting tournament"
Future tournaments will:

Auto-expire after 10 minutes if not filled
Get cancelled when all players leave
Stay clean automatically


✅ Testing Checklist
After implementation:

 Run manual cleanup → All old "waiting" tournaments become "cancelled"
 Create new tournament → Join → Wait 10 minutes
 Expire route runs → Tournament status becomes "expired"
 Join tournament → Logout → Tournament becomes "cancelled" (if only player)
 No stuck "waiting" tournaments in database


🎯 Next Steps

Add the 3 route files
Run manual cleanup once
Share your waiting room page file
I'll add auto-expire logic to waiting room
Test the full flow


This will keep your database clean and prevent stuck tournaments! 🚀