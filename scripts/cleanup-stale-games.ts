// scripts/cleanup-stale-games.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function cleanupStaleGames() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('🧹 Starting cleanup of stale games...')

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: staleGames, error: fetchError } = await supabase
    .from('tournament_games')
    .select('id, tournament_id, created_at, game_type')
    .eq('status', 'in_progress')
    .lt('created_at', thirtyMinutesAgo)

  if (fetchError) {
    console.error('❌ Error fetching stale games:', fetchError)
    return
  }

  if (!staleGames || staleGames.length === 0) {
    console.log('✅ No stale games found. Database is clean!')
    return
  }

  console.log(`Found ${staleGames.length} stale games to clean up`)

  const { error: updateError } = await supabase
    .from('tournament_games')
    .update({
      status: 'completed',
      result_reason: 'abandoned',
      completed_at: new Date().toISOString()
    })
    .eq('status', 'in_progress')
    .lt('created_at', thirtyMinutesAgo)

  if (updateError) {
    console.error('❌ Error updating stale games:', updateError)
    return
  }

  console.log(`✅ Successfully cleaned up ${staleGames.length} stale games!`)
}

cleanupStaleGames()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Cleanup failed:', err)
    process.exit(1)
  })