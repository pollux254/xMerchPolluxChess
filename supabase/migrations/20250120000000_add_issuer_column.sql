-- Add issuer column to tournaments table
-- This allows tournaments to support different currencies with issuers

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS issuer TEXT;

COMMENT ON COLUMN tournaments.issuer IS 'Issuer address for non-native currencies (e.g., IOUs)';

-- Also add missing columns used by the application
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS tournament_size INTEGER;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS network TEXT DEFAULT 'testnet';

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN tournaments.tournament_size IS 'Number of players (2, 4, 8, or 16)';
COMMENT ON COLUMN tournaments.network IS 'Network: testnet or mainnet';
COMMENT ON COLUMN tournaments.expires_at IS 'When tournament expires if not filled';
