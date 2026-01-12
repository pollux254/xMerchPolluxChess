// Stockfish Worker for Vercel - Compatible Version
console.log('[Worker] Initializing Stockfish worker...');

let stockfish = null;
let messageQueue = [];

try {
  // Load the Stockfish script
  console.log('[Worker] Loading stockfish.js...');
  importScripts('/stockfish/stockfish.js');
  console.log('[Worker] Stockfish script loaded');
  
  // Wait a moment for global initialization
  setTimeout(() => {
    try {
      // Try different initialization methods
      if (typeof Stockfish === 'function') {
        console.log('[Worker] Found Stockfish function');
        stockfish = Stockfish();
      } else if (typeof STOCKFISH === 'function') {
        console.log('[Worker] Found STOCKFISH function');
        stockfish = STOCKFISH();
      } else if (typeof Module !== 'undefined' && Module.Stockfish) {
        console.log('[Worker] Found Module.Stockfish');
        stockfish = Module.Stockfish();
      } else {
        console.error('[Worker] No Stockfish constructor found. Available:', Object.keys(self).filter(k => k.toLowerCase().includes('stock')));
        postMessage({ type: 'error', message: 'Stockfish constructor not found' });
        return;
      }
      
      console.log('[Worker] Stockfish instance created');
      
      // Set up message handler from Stockfish
      if (typeof stockfish.onmessage !== 'undefined') {
        stockfish.onmessage = function(msg) {
          console.log('[Worker] SF says:', msg);
          postMessage({ type: 'message', data: msg });
        };
      } else if (typeof stockfish.addMessageListener === 'function') {
        stockfish.addMessageListener(function(msg) {
          console.log('[Worker] SF says:', msg);
          postMessage({ type: 'message', data: msg });
        });
      } else {
        console.error('[Worker] Cannot set up message listener');
      }
      
      // Send ready signal
      postMessage({ type: 'ready' });
      console.log('[Worker] Ready to receive commands');
      
      // Process any queued messages
      while (messageQueue.length > 0) {
        const cmd = messageQueue.shift();
        if (stockfish.postMessage) {
          stockfish.postMessage(cmd);
        } else {
          stockfish(cmd);
        }
      }
      
    } catch (error) {
      console.error('[Worker] Initialization error:', error);
      postMessage({ type: 'error', message: error.message });
    }
  }, 100);
  
} catch (error) {
  console.error('[Worker] Failed to load script:', error);
  postMessage({ type: 'error', message: 'Failed to load: ' + error.message });
}

// Handle messages from main thread
self.onmessage = function(e) {
  const cmd = e.data;
  console.log('[Worker] Received command:', cmd);
  
  if (!stockfish) {
    console.log('[Worker] Queueing command (stockfish not ready):', cmd);
    messageQueue.push(cmd);
    return;
  }
  
  try {
    if (typeof stockfish.postMessage === 'function') {
      stockfish.postMessage(cmd);
    } else if (typeof stockfish === 'function') {
      stockfish(cmd);
    } else {
      console.error('[Worker] Cannot send command - no method available');
    }
  } catch (error) {
    console.error('[Worker] Error sending command:', error);
  }
};

// Error handler
self.onerror = function(error) {
  console.error('[Worker] Worker error:', error);
  postMessage({ type: 'error', message: error.message });
};