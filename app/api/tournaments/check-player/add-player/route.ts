import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next';

interface AddPlayerRequest {
    playerAddress: string;
    tournamentId: string;
    txHash: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { playerAddress, tournamentId, txHash } = req.body as AddPlayerRequest;

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Add player
    const { error: playerError } = await supabase
        .from('tournament_players')
        .insert({
            tournament_id: tournamentId,
            player_address: playerAddress,
            player_order: 0, // Update later when bracket forms
            status: 'waiting'
        });

    if (playerError) return res.status(500).json({ error: playerError.message });

    // Log TX
    await supabase
        .from('hook_logs')
        .insert({
            tx_hash: txHash,
            tournament_id: tournamentId,
            status: 'success',
            message: `Player ${playerAddress} joined tournament ${tournamentId}`
        });

    res.status(200).json({ success: true });
}