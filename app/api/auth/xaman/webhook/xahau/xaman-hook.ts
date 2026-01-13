import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next';

interface MemoData {
    tournamentId: string;
}

interface XamanMeta {
    account: string;
    success: boolean;
    memos?: Array<{
        Memo: {
            MemoData: string;
        };
    }>;
}

interface RequestBody {
    tx_hash: string;
    validated: boolean;
    meta: XamanMeta;
}

interface TournamentPlayer {
    tournament_id: string;
    player_address: string;
    player_order: number;
    status: string;
}

interface Tournament {
    tournament_size: number;
}

interface BracketMatch {
    matchId: number;
    players: [null, null];
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<NextApiResponse | void> {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { tx_hash, validated, meta } = req.body as RequestBody;

    if (!validated || meta?.success !== true) {
        return res.status(200).json({ ok: true });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const memo: MemoData = meta?.memos?.[0]?.Memo?.MemoData ? JSON.parse(Buffer.from(meta.memos[0].Memo.MemoData, 'hex').toString()) : {};

    const tournamentId: string = memo.tournamentId;
    const playerAddress: string | undefined = meta?.account;

    if (!tournamentId || !playerAddress) {
        return res.status(400).json({ error: 'Missing tournamentId or playerAddress' });
    }

    const { error: playerError } = await supabase
        .from('tournament_players')
        .insert({
            tournament_id: tournamentId,
            player_address: playerAddress,
            player_order: 0,
            status: 'waiting'
        } as TournamentPlayer);

    if (playerError) {
        console.error('Player insert error:', playerError);
        return res.status(500).json({ error: 'Failed to add player' });
    }

    await supabase
        .from('hook_logs')
        .insert({
            tx_hash,
            tournament_id: tournamentId,
            status: 'success',
            message: `Player ${playerAddress} joined tournament ${tournamentId}`
        });

    const { count } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);

    const tournament = await supabase
        .from('tournaments')
        .select('tournament_size')
        .eq('id', tournamentId)
        .single();

    if (!tournament.data) {
        return res.status(400).json({ error: 'Tournament not found' });
    }

    if (count !== null && count >= (tournament.data as Tournament).tournament_size) {
        await supabase
            .from('tournaments')
            .update({
                status: 'in_progress',
                bracket: generateBracket(count)
            })
            .eq('id', tournamentId);
    }

    res.status(200).json({ success: true });
}

// Simple bracket generator (expand later)
function generateBracket(playerCount: number) {
  // Example: return array of matches
  return Array.from({ length: playerCount / 2 }, (_, i) => ({
    matchId: i + 1,
    players: [null, null] // Will be filled when paired
  }));
}