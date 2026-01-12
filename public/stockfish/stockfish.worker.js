// Stockfish Worker (production bootstrap)
//
// This file is the Worker entrypoint used by the app.
// It simply loads the self-hosted Stockfish.js worker build.
//
// IMPORTANT:
// - The wasm path is provided via the Worker URL hash (see lib/stockfish/engine.ts)
// - Do NOT include `,worker` in the hash for the main engine worker.

/* eslint-disable no-restricted-globals */

// Some Stockfish.js builds do `onmessage = onmessage || function (...) {...}`.
// Ensure it can install its handler.
try {
  // eslint-disable-next-line no-global-assign
  self.onmessage = null;
} catch {
  // ignore
}

try {
  importScripts('/stockfish/stockfish.js');
} catch (err) {
  // Surface load errors to the main thread.
  // (This will show up in the browser console as a Worker error.)
  // eslint-disable-next-line no-console
  console.error('[StockfishWorker] Failed to importScripts(/stockfish/stockfish.js):', err);
  throw err;
}

