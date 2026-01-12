// Stockfish Engine - DIAGNOSTIC VERSION
// This version is intentionally very verbose so we can pinpoint where
// Stockfish initialization fails on Vercel.

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

type WorkerEnvelope =
  | { type: "ready"; t?: number }
  | { type: "status"; message: string; data?: unknown; t?: number; level?: "warn" }
  | { type: "error"; message: string; error?: string; t?: number }
  | { type: "sf"; data: string; t?: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StockfishEngine {
  private worker: Worker | null = null;

  // Raw messages we consider part of the UCI stream (and some diagnostics)
  private messageQueue: string[] = [];
  private allMessages: Array<{ t: number; kind: string; data: unknown }> = [];

  private workerReadySignal = false;
  private uciOk = false;
  private readyOk = false;

  private startedAt = 0;

  private nowMs() {
    return Date.now() - this.startedAt;
  }

  async initialize(): Promise<void> {
    this.startedAt = Date.now();

    // If the worker never sends anything, these logs will still show whether
    // creation succeeded and if any error events fire.
    console.log("[Engine] Creating worker...");

    // Prefer the DIAGNOSTIC worker first so we always get worker-side logs.
    // IMPORTANT:
    // This Stockfish.js build treats ",worker" in the URL hash as a special
    // internal worker mode (it will NOT install the UCI `onmessage` handler).
    // For the main engine worker that receives UCI commands, we must NOT
    // include ",worker" in the hash.
    const workerCandidates = [
      "/stockfish/stockfish.worker.js#stockfish.wasm",
      // fallback: using stockfish.js directly
      "/stockfish/stockfish.js#stockfish.wasm",
    ];

    let lastError: unknown = null;

    for (const workerUrl of workerCandidates) {
      try {
        console.log("[Engine] Trying worker candidate:", workerUrl);
        this.worker = new Worker(workerUrl);
        console.log("[Engine] Worker created:", workerUrl);
        break;
      } catch (e) {
        console.error("[Engine] Failed to create worker:", workerUrl, e);
        lastError = e;
        this.worker = null;
      }
    }

    if (!this.worker) {
      throw lastError ?? new Error("Failed to create Stockfish worker");
    }

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data as unknown;
      this.allMessages.push({ t: this.nowMs(), kind: "onmessage", data });

      // Diagnostic worker sends structured objects.
      if (data && typeof data === "object" && "type" in (data as any)) {
        const msg = data as WorkerEnvelope;
        if (msg.type === "status") {
          const prefix = msg.level === "warn" ? "[Engine] [Worker][WARN]" : "[Engine] [Worker]";
          console.log(prefix, msg.message, msg.data ?? "", `(t=${msg.t ?? "?"}ms)`);
          return;
        }

        if (msg.type === "error") {
          console.error("[Engine] [Worker][ERROR]", msg.message, msg.error ?? "", `(t=${msg.t ?? "?"}ms)`);
          // keep going; might still reveal more information
          return;
        }

        if (msg.type === "ready") {
          this.workerReadySignal = true;
          console.log("[Engine] ✅ Worker ready signal received", `(t=${msg.t ?? "?"}ms)`);
          return;
        }

        if (msg.type === "sf") {
          const line = String(msg.data).trim();
          console.log("[Engine] <<", line);
          this.messageQueue.push(line);
          if (line === "uciok") this.uciOk = true;
          if (line === "readyok") this.readyOk = true;
          return;
        }
      }

      // Non-diagnostic / plain-string worker.
      const line = String(data ?? "").trim();
      if (!line) return;
      console.log("[Engine] <<", line);
      this.messageQueue.push(line);
      if (line === "uciok") this.uciOk = true;
      if (line === "readyok") this.readyOk = true;
    };

    this.worker.onerror = (error) => {
      this.allMessages.push({ t: this.nowMs(), kind: "onerror", data: error });
      console.error("[Engine] Worker error event:", error);
    };

    // Wait for diagnostic worker to announce readiness (this is NOT UCI readyok).
    await this.waitForWorkerReadySignal(30_000);

    console.log("[Engine] ✅ Worker setup complete, waiting for UCI initialization...");
    console.log("[Engine] >> uci");
    this.worker.postMessage("uci");

    await this.waitForUciOk(30_000);
    console.log("[Engine] ✅ UCI OK received");
  }

  private async waitForWorkerReadySignal(timeoutMs: number): Promise<void> {
    const started = Date.now();
    let nextProgressLogAt = started + 5_000;

    while (!this.workerReadySignal && Date.now() - started < timeoutMs) {
      if (Date.now() >= nextProgressLogAt) {
        console.log(
          "[Engine] Status: waiting for worker ready signal...",
          `${Math.floor((Date.now() - started) / 1000)}s elapsed`,
          `messages=${this.allMessages.length}`
        );
        nextProgressLogAt += 5_000;
      }
      await sleep(100);
    }

    if (!this.workerReadySignal) {
      console.error("[Engine] ❌ Timed out waiting for worker ready signal");
      console.error("[Engine] Messages received (all):", this.allMessages);
      throw new Error("Stockfish worker init timed out (no ready signal)");
    }
  }

  private async waitForUciOk(timeoutMs: number): Promise<void> {
    const started = Date.now();
    let nextProgressLogAt = started + 5_000;

    while (!this.uciOk && Date.now() - started < timeoutMs) {
      if (Date.now() >= nextProgressLogAt) {
        const recent = this.messageQueue.slice(-10);
        console.log(
          "[Engine] Status: waiting for uciok...",
          `${Math.floor((Date.now() - started) / 1000)}s elapsed`,
          `queue=${this.messageQueue.length}`,
          { recent }
        );
        nextProgressLogAt += 5_000;
      }
      await sleep(100);
    }

    if (!this.uciOk) {
      console.error("[Engine] ❌ Timed out waiting for uciok");
      console.error("[Engine] Messages received (UCI queue):", this.messageQueue);
      console.error("[Engine] Messages received (all):", this.allMessages);
      throw new Error("Stockfish uci init timed out");
    }
  }

  async waitReady(timeoutMs = 30_000): Promise<void> {
    if (!this.worker) throw new Error("Worker not initialized");
    if (this.readyOk) return;

    console.log("[Engine] >> isready");
    this.worker.postMessage("isready");

    const started = Date.now();
    let nextProgressLogAt = started + 5_000;

    while (!this.readyOk && Date.now() - started < timeoutMs) {
      if (Date.now() >= nextProgressLogAt) {
        const recent = this.messageQueue.slice(-10);
        console.log(
          "[Engine] Status: waiting for readyok...",
          `${Math.floor((Date.now() - started) / 1000)}s elapsed`,
          `queue=${this.messageQueue.length}`,
          { recent }
        );
        nextProgressLogAt += 5_000;
      }
      await sleep(100);
    }

    if (!this.readyOk) {
      console.error("[Engine] ❌ Timed out waiting for readyok");
      console.error("[Engine] Messages received (UCI queue):", this.messageQueue);
      console.error("[Engine] Messages received (all):", this.allMessages);
      throw new Error("Stockfish readyok timeout");
    }
  }

  private send(cmd: string) {
    if (!this.worker) throw new Error("Worker not initialized");
    console.log("[Engine] >>", cmd);
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
    let nextProgressLogAt = Date.now() + 5_000;

    while (Date.now() < deadline) {
      const bestMoveMsg = this.messageQueue.find((m) => m.startsWith("bestmove"));
      if (bestMoveMsg) {
        const move = bestMoveMsg.split(" ")[1];
        return move || "e2e4";
      }

      if (Date.now() >= nextProgressLogAt) {
        console.log("[Engine] Status: waiting for bestmove...", {
          queue: this.messageQueue.length,
          recent: this.messageQueue.slice(-10),
        });
        nextProgressLogAt += 5_000;
      }

      await sleep(100);
    }

    console.error("[Engine] ❌ Move calculation timeout", {
      queue: this.messageQueue.length,
      recent: this.messageQueue.slice(-20),
    });
    throw new Error("Move calculation timeout");
  }

  terminate() {
    if (this.worker) {
      console.log("[Engine] Terminating worker");
      this.worker.terminate();
      this.worker = null;
    }
  }
}
