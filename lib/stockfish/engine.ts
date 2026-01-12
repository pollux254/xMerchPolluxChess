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
    timeoutMs = 10_000
  ): Promise<string> {
    if (!this.worker || !this.readyOk) {
      throw new Error("Engine not ready");
    }

    // Keep queue small-ish while still useful for diagnostics.
    this.messageQueue = this.messageQueue.filter((m) => !m.startsWith("bestmove"));

    if (typeof params.contempt === "number") {
      this.send(`setoption name Contempt value ${params.contempt}`);
    }

    this.send(`position fen ${fen}`);
    this.send(`go depth ${params.depth}`);

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const bestMoveMsg = this.messageQueue.find((m) => m.startsWith("bestmove"));
      if (bestMoveMsg) {
        const move = bestMoveMsg.split(" ")[1];
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
