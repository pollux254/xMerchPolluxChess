// Stockfish Web Worker bootstrapper.
//
// This worker is intended to be loaded like:
//   new Worker('/stockfish/stockfish.worker.js#stockfish.wasm,worker')
//
// The imported stockfish.js (nmrugg/stockfish.js) uses `self.location.hash` to:
//   1) enter worker mode (",worker")
//   2) locate the wasm binary (first hash segment)
//
// It will postMessage() engine output lines (UCI protocol) back to the main thread.
importScripts('./stockfish.js');
