-- SQL Script to Clean Up Stuck Tournament
-- Tournament ID: 745ecb46-0a24-47a4-a71b-214675049c36
-- Player Address: r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6

-- Step 1: Remove the stuck player from the tournament
DELETE FROM tournament_players 
WHERE tournament_id = '745ecb46-0a24-47a4-a71b-214675049c36' 
AND player_address = 'r4ksbYjcHPzTnYu62qkFh73BtnGM6oYLQ6';

-- Step 2: Check if tournament is now empty and cancel it if so
-- First, let's see how many players remain
SELECT COUNT(*) as remaining_players 
FROM tournament_players 
WHERE tournament_id = '745ecb46-0a24-47a4-a71b-214675049c36';

-- Step 3: If the count above is 0, cancel the tournament
UPDATE tournaments 
SET 
  status = 'cancelled',
  cancelled_reason = 'Manual cleanup - stuck tournament with invalid tournamentSize=1'
WHERE id = '745ecb46-0a24-47a4-a71b-214675049c36'
AND (
  SELECT COUNT(*) 
  FROM tournament_players 
  WHERE tournament_id = '745ecb46-0a24-47a4-a71b-214675049c36'
) = 0;

-- Step 4: Verify the cleanup worked
SELECT 
  t.id,
  t.status,
  t.tournament_size,
  t.created_at,
  t.cancelled_reason,
  COUNT(tp.player_address) as current_players
FROM tournaments t
LEFT JOIN tournament_players tp ON t.id = tp.tournament_id
WHERE t.id = '745ecb46-0a24-47a4-a71b-214675049c36'
GROUP BY t.id, t.status, t.tournament_size, t.created_at, t.cancelled_reason;

-- Optional: Find any other tournaments with invalid tournamentSize=1
SELECT 
  t.id,
  t.status,
  t.tournament_size,
  t.created_at,
  COUNT(tp.player_address) as current_players
FROM tournaments t
LEFT JOIN tournament_players tp ON t.id = tp.tournament_id
WHERE t.tournament_size = 1
AND t.status IN ('waiting', 'in_progress')
GROUP BY t.id, t.status, t.tournament_size, t.created_at
ORDER BY t.created_at DESC;