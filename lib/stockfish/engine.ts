// Stockfish Engine (Vercel-compatible)
//
// IMPORTANT:
// This repo's Stockfish.js build uses `self.location.hash`.
// Do NOT include `,worker` in the hash for the *main* engine worker, otherwise
// Stockfish.js enters an internal worker mode and will not install the UCI
// message handler (no `uciok`).

import type { BotStyle } from "../bots/types";

export interface StockfishSearchParams {
  depth: number;
  contempt?: number;
}

export function rankToDepth(rank: number): number {
  return Math.max(1, Math.min(20, Math.floor(rank / 50)));
}

export function getStockfishParams(style: BotStyle, rank: number): StockfishSearchParams {
  const baseDepth = rankToDepth(rank);

  switch (style) {
    case "Cautious":
      return { depth: baseDepth, contempt: -50 };
    case "Aggressive":
      return { depth: baseDepth, contempt: 50 };
    case "Perfect":
      return { depth: Math.max(baseDepth, 18), contempt: 0 };
    case "Random":
      return { depth: Math.max(1, baseDepth - 2), contempt: 0 };
    default:
      return { depth: baseDepth, contempt: 0 };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private messageQueue: string[] = [];
  private uciOk = false;
  private readyOk = false;

  async initialize(): Promise<void> {
    // Prefer our wrapper worker first. It just importScripts(stockfish.js).
    const workerCandidates = [
      "/stockfish/stockfish.worker.js#stockfish.wasm",
      // fallback: using stockfish.js directly
      "/stockfish/stockfish.js#stockfish.wasm",
    ];

    let lastError: unknown = null;

    for (const workerUrl of workerCandidates) {
      try {
        this.worker = new Worker(workerUrl);
        break;
      } catch (e) {
        lastError = e;
        this.worker = null;
      }
    }

    if (!this.worker) {
      throw lastError ?? new Error("Failed to create Stockfish worker");
    }

    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data ?? "").trim();
      if (!line) return;
      this.messageQueue.push(line);
      if (line === "uciok") this.uciOk = true;
      if (line === "readyok") this.readyOk = true;
    };

    this.worker.onerror = (error) => {
      console.error("[Engine] Worker error event:", error);
    };

    // Kick off UCI handshake
    this.worker.postMessage("uci");
    await this.waitForUciOk(30_000);
  }

  private async waitForUciOk(timeoutMs: number): Promise<void> {
    const started = Date.now();
    while (!this.uciOk && Date.now() - started < timeoutMs) await sleep(50);

    if (!this.uciOk) {
      throw new Error("Stockfish uci init timed out");
    }
  }

  async waitReady(timeoutMs = 30_000): Promise<void> {
    if (!this.worker) throw new Error("Worker not initialized");
    if (this.readyOk) return;

    this.worker.postMessage("isready");

    const started = Date.now();
    while (!this.readyOk && Date.now() - started < timeoutMs) await sleep(50);

    if (!this.readyOk) {
      throw new Error("Stockfish readyok timeout");
    }
  }

  private send(cmd: string) {
    if (!this.worker) throw new Error("Worker not initialized");
    this.worker.postMessage(cmd);
  }

  async getBestMoveUci(
    fen: string,
    params: StockfishSearchParams,
    timeoutMs = 10_000,
    ranking = 1000 // Bot ranking 1-1000 for mistake injection
  ): Promise<string> {
    if (!this.worker || !this.readyOk) {
      throw new Error("Engine not ready");
    }

    // Calculate mistake probability based on ranking (1-1000)
    // Formula: mistake_rate = 50% - (ranking / 20)
    const mistakeRate = Math.max(0, Math.min(50, 50 - (ranking / 20)));
    const shouldMakeMistake = Math.random() * 100 < mistakeRate;

    console.log(`🎲 [Bot AI] Rank ${ranking}, Mistake Rate: ${mistakeRate.toFixed(1)}%, Will mistake: ${shouldMakeMistake}`)

    // Keep queue small-ish while still useful for diagnostics.
    this.messageQueue = this.messageQueue.filter((m) => !m.startsWith("bestmove") && !m.startsWith("info"));

    if (typeof params.contempt === "number") {
      this.send(`setoption name Contempt value ${params.contempt}`);
    }

    // If should make mistake, get multiple move options
    if (shouldMakeMistake && ranking < 950) {
      // Get top 5 moves to choose from
      this.send(`setoption name MultiPV value 5`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${Math.max(3, params.depth - 1)}`); // Slightly lower depth for speed

      const deadline = Date.now() + timeoutMs;
      const moves: Array<{ move: string; score: number }> = [];

      while (Date.now() < deadline) {
        // Collect all "info" lines with pv (principal variation)
        const infoLines = this.messageQueue.filter((m) => m.startsWith("info") && m.includes(" pv "));
        
        for (const line of infoLines) {
          const pvMatch = line.match(/pv\s+(\w+)/);
          const scoreMatch = line.match(/score\s+cp\s+(-?\d+)/);
          
          if (pvMatch && scoreMatch) {
            const move = pvMatch[1];
            const score = parseInt(scoreMatch[1]);
            
            if (!moves.find(m => m.move === move)) {
              moves.push({ move, score });
            }
          }
        }

        // Check if we got bestmove (search complete)
        const bestMoveMsg = this.messageQueue.find((m) => m.startsWith("bestmove"));
        if (bestMoveMsg && moves.length > 1) {
          // Reset MultiPV for next search
          this.send(`setoption name MultiPV value 1`);
          
          // Sort moves by score (best to worst)
          moves.sort((a, b) => b.score - a.score);
          
          console.log(`🎯 [Bot AI] Found ${moves.length} moves, scores:`, moves.map(m => m.score));
          
          // Select a weaker move based on ranking
          let selectedMove: string;
          
          if (ranking <= 100) {
            // Very weak (1-100): Pick random from all options or even worse
            const randomIndex = Math.floor(Math.random() * moves.length);
            selectedMove = moves[randomIndex].move;
            console.log(`🎲 [Bot AI] Rank ${ranking} (Very Weak): Random move #${randomIndex + 1}`);
          } else if (ranking <= 300) {
            // Weak (101-300): Pick from worse 70% of moves
            const worseCount = Math.max(1, Math.floor(moves.length * 0.7));
            const randomIndex = Math.floor(Math.random() * worseCount);
            selectedMove = moves[Math.min(randomIndex, moves.length - 1)].move;
            console.log(`🎲 [Bot AI] Rank ${ranking} (Weak): Worse move #${randomIndex + 1} of ${worseCount}`);
          } else if (ranking <= 600) {
            // Medium (301-600): Pick from worse 50% or 2nd/3rd best
            const pickIndex = Math.floor(Math.random() * Math.min(3, moves.length)) + 1;
            selectedMove = moves[Math.min(pickIndex, moves.length - 1)].move;
            console.log(`🎲 [Bot AI] Rank ${ranking} (Medium): Move #${pickIndex + 1}`);
          } else {
            // Strong (601-950): Occasionally pick 2nd or 3rd best
            const pickIndex = Math.floor(Math.random() * Math.min(2, moves.length - 1)) + 1;
            selectedMove = moves[pickIndex].move;
            console.log(`🎲 [Bot AI] Rank ${ranking} (Strong): Move #${pickIndex + 1}`);
          }
          
          return selectedMove;
        }
        
        await sleep(100);
      }
      
      // Timeout fallback - reset MultiPV and return best move
      this.send(`setoption name MultiPV value 1`);
    }

    // Play best move (no mistake or high ranking)
    this.send(`setoption name MultiPV value 1`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${params.depth}`);

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const bestMoveMsg = this.messageQueue.find((m) => m.startsWith("bestmove"));
      if (bestMoveMsg) {
        const move = bestMoveMsg.split(" ")[1];
        console.log(`✅ [Bot AI] Playing best move: ${move}`);
        return move || "e2e4";
      }
      await sleep(100);
    }
    throw new Error("Move calculation timeout");
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
