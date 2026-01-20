-- Add wall clock timing support for chess games
-- This ensures timing is based on actual elapsed time, not moves

ALTER TABLE tournament_games 
ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing games to use last_move_at as turn_started_at
UPDATE tournament_games 
SET turn_started_at = last_move_at 
WHERE turn_started_at IS NULL AND status = 'active';

COMMENT ON COLUMN tournament_games.turn_started_at IS 'Wall clock timestamp when current player turn started';
