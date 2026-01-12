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

export class StockfishEngine {
  private worker: Worker | null = null;
  private messageQueue: string[] = [];
  private uciOk = false;
  private ready = false;

  async initialize(): Promise<void> {
    try {
      // NOTE: We intentionally use a self-hosted worker (served from Next.js `public/`)
      // instead of any external CDN. This is production-friendly (Vercel) and avoids
      // network/CORS issues.
      //
      // The `stockfish.js` build we ship uses `self.location.hash` to locate its wasm
      // and to enable worker mode.
      // See: public/stockfish/stockfish.worker.js
      const workerUrl = '/stockfish/stockfish.worker.js#stockfish.wasm,worker';
      console.log('[stockfish] Creating self-hosted worker:', workerUrl);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        const message = String(e.data);
        
        if (message.startsWith('error:')) {
          console.error('[stockfish]', message);
          return;
        }

        console.log('[stockfish] <<', message);
        this.messageQueue.push(message);

        if (message === 'uciok') {
          this.uciOk = true;
        }
        if (message === 'readyok') {
          this.ready = true;
        }
      };

      this.worker.onerror = (error) => {
        console.error('[stockfish] Worker error:', error);
      };

      // Wait for worker to load Stockfish
      console.log('[stockfish] Waiting for worker to load...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send UCI command
      console.log('[stockfish] Sending uci');
      this.send('uci');

      // Wait for uciok
      await this.waitForUciOk(30000);
      console.log('[stockfish] UCI initialized');

    } catch (error) {
      console.error('[stockfish] Failed to create worker:', error);
      throw error;
    }
  }

  private async waitForUciOk(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    
    while (!this.uciOk && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.uciOk) {
      console.error('[stockfish] Messages received:', this.messageQueue);
      throw new Error('Stockfish uci init timed out');
    }
  }

  async waitReady(timeoutMs = 10000): Promise<void> {
    if (!this.worker) throw new Error('Worker not initialized');
    if (this.ready) return;

    console.log('[stockfish] Sending isready');
    this.send('isready');

    const deadline = Date.now() + timeoutMs;
    
    while (!this.ready && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.ready) {
      throw new Error('Stockfish readyok timeout');
    }
  }

  private send(cmd: string) {
    if (!this.worker) throw new Error('Worker not initialized');
    console.log('[stockfish] >>', cmd);
    this.worker.postMessage(cmd);
  }

  async getBestMoveUci(
    fen: string,
    params: StockfishSearchParams,
    timeoutMs = 10000
  ): Promise<string> {
    if (!this.worker || !this.ready) {
      throw new Error('Engine not ready');
    }

    this.messageQueue = this.messageQueue.filter(m => !m.startsWith('bestmove'));

    if (typeof params.contempt === 'number') {
      this.send(`setoption name Contempt value ${params.contempt}`);
    }

    this.send(`position fen ${fen}`);
    this.send(`go depth ${params.depth}`);

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const bestMoveMsg = this.messageQueue.find(m => m.startsWith('bestmove'));
      
      if (bestMoveMsg) {
        const move = bestMoveMsg.split(' ')[1];
        return move || 'e2e4';
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Move calculation timeout');
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
