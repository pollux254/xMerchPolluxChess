// Stockfish Worker - DIAGNOSTIC VERSION
// This worker is intentionally verbose. It logs every step and sends structured
// status messages back to the main thread so we can pinpoint Vercel failures.

/* eslint-disable no-restricted-globals */

(() => {
  const startedAt = Date.now();
  /** @type {any} */
  let sf = null;
  /** @type {string[]} */
  const queue = [];

  // Keep original postMessage available early so any diagnostic wrappers can use it.
  const _origPostMessage = self.postMessage.bind(self);

  // Ensure stockfish.js will install its own onmessage handler (some builds do
  // `onmessage = onmessage || ...`). If onmessage is pre-set, it might skip.
  // We don't rely on onmessage ourselves (we use addEventListener), so clearing it
  // is safe.
  try {
    // eslint-disable-next-line no-global-assign
    self.onmessage = null;
  } catch {
    // ignore
  }

  // XHR diagnostics: Emscripten often uses synchronous XMLHttpRequest to load wasm.
  // Wrap XHR to log requests (URL + response status).
  if (typeof self.XMLHttpRequest === 'function') {
    const _OrigXHR = self.XMLHttpRequest;
    // @ts-ignore
    self.XMLHttpRequest = function () {
      const xhr = new _OrigXHR();
      let _url = '';
      const _open = xhr.open;
      xhr.open = function (method, url) {
        _url = String(url);
        try {
          _origPostMessage({ type: 'status', message: 'XHR open', data: { method, url: _url }, t: Date.now() - startedAt });
        } catch {
          // ignore
        }
        // @ts-ignore
        return _open.apply(this, arguments);
      };
      const _send = xhr.send;
      xhr.send = function () {
        try {
          _origPostMessage({ type: 'status', message: 'XHR send', data: { url: _url }, t: Date.now() - startedAt });
        } catch {
          // ignore
        }

        xhr.addEventListener('load', () => {
          try {
            _origPostMessage({
              type: 'status',
              message: 'XHR load',
              data: { url: _url, status: xhr.status, responseType: xhr.responseType },
              t: Date.now() - startedAt,
            });
          } catch {
            // ignore
          }
        });

        xhr.addEventListener('error', () => {
          try {
            _origPostMessage({ type: 'error', message: 'XHR error', error: String(_url), t: Date.now() - startedAt });
          } catch {
            // ignore
          }
        });

        // @ts-ignore
        return _send.apply(this, arguments);
      };
      return xhr;
    };
  }

  // Network diagnostics: log fetch() calls used by Emscripten to load wasm.
  const _origFetch = typeof self.fetch === 'function' ? self.fetch.bind(self) : null;
  if (_origFetch) {
    self.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input && typeof input === 'object' && 'url' in input
            ? input.url
            : String(input);
      try {
        // Note: do not include full Response body; just metadata
        _origPostMessage({ type: 'status', message: 'fetch() called', data: { url, init }, t: Date.now() - startedAt });
      } catch {
        // ignore
      }
      const res = await _origFetch(input, init);
      try {
        _origPostMessage({
          type: 'status',
          message: 'fetch() response',
          data: {
            url: res.url,
            status: res.status,
            ok: res.ok,
            contentType: res.headers?.get?.('content-type'),
            contentLength: res.headers?.get?.('content-length'),
          },
          t: Date.now() - startedAt,
        });
      } catch {
        // ignore
      }
      return res;
    };
  }

  // Save pre-import handler so we can tell whether stockfish.js installed its own.
  const preImportOnMessage = self.onmessage;

  // Detect if the imported stockfish.js is a "standalone worker" build.
  // In that case, it will use self.onmessage/postMessage directly and will NOT
  // expose a Stockfish()/STOCKFISH() constructor for us to call.
  let detectedStandaloneWorker = false;

  function nowMs() {
    return Date.now() - startedAt;
  }

  /**
   * @param {string} message
   * @param {any=} data
   */
  function status(message, data) {
    const payload = { type: 'status', message, data, t: nowMs() };
    try {
      // Visible in Worker console
      console.log(`[Worker] ${message}`, data ?? '');
    } catch {
      // ignore
    }
    try {
      // Visible in main thread (use ORIGINAL postMessage to avoid feedback loops)
      _origPostMessage(payload);
    } catch {
      // ignore
    }
  }

  /**
   * @param {string} message
   * @param {any=} data
   */
  function warn(message, data) {
    try {
      console.warn(`[Worker] ${message}`, data ?? '');
    } catch {
      // ignore
    }
    try {
      _origPostMessage({ type: 'status', level: 'warn', message, data, t: nowMs() });
    } catch {
      // ignore
    }
  }

  /**
   * @param {string} message
   * @param {any=} error
   */
  function fail(message, error) {
    try {
      console.error(`[Worker] ${message}`, error ?? '');
    } catch {
      // ignore
    }
    try {
      _origPostMessage({ type: 'error', message, error: String(error?.message || error || ''), t: nowMs() });
    } catch {
      // ignore
    }
  }

  function listInterestingGlobals() {
    const keys = Object.getOwnPropertyNames(self);
    const interesting = keys
      .filter((k) => /(stock|wasm|module|worker|emscripten)/i.test(k))
      .sort();
    return {
      interesting,
      stockKeys: keys.filter((k) => k.toLowerCase().includes('stock')).sort(),
    };
  }

  function normalizeSfLine(msg) {
    // stockfish builds vary: msg can be string, {data:string}, etc.
    if (typeof msg === 'string') return msg;
    if (msg && typeof msg === 'object') {
      if (typeof msg.data === 'string') return msg.data;
      if (typeof msg.message === 'string') return msg.message;
    }
    return String(msg);
  }

  function emitSfLine(line) {
    const text = String(line).trim();
    if (!text) return;
    // Keep a consistent envelope so engine can log everything.
    try {
      // Use ORIGINAL postMessage to avoid feedback loop with our postMessage wrapper.
      _origPostMessage({ type: 'sf', data: text, t: nowMs() });
    } catch {
      // ignore
    }
  }

  // IMPORTANT: stockfish.js may be a standalone worker that calls global postMessage.
  // We wrap postMessage to mirror any outbound string as a structured `{type:'sf'}`
  // message for the main thread and to log it.
  self.postMessage = (msg, transfer) => {
    try {
      // Stockfish UCI output usually goes out as string lines.
      if (typeof msg === 'string') {
        console.log('[Worker] <<', msg);
        emitSfLine(msg);
      }
    } catch {
      // ignore
    }
    // Always forward the original message too.
    // @ts-ignore
    return _origPostMessage(msg, transfer);
  };

  function setupSfListeners(instance) {
    status('Setting up message handlers...', {
      hasOnMessage: instance && typeof instance.onmessage !== 'undefined',
      hasAddMessageListener: instance && typeof instance.addMessageListener === 'function',
      hasPostMessage: instance && typeof instance.postMessage === 'function',
      instanceType: typeof instance,
    });

    // Method A: onmessage property (common for stockfish.js wrapper)
    if (instance && typeof instance.onmessage !== 'undefined') {
      status('Using onmessage property');
      instance.onmessage = (msg) => {
        const line = normalizeSfLine(msg);
        console.log('[Worker] <<', line);
        emitSfLine(line);
      };
      return;
    }

    // Method B: addMessageListener (some builds)
    if (instance && typeof instance.addMessageListener === 'function') {
      status('Using addMessageListener method');
      instance.addMessageListener((msg) => {
        const line = normalizeSfLine(msg);
        console.log('[Worker] <<', line);
        emitSfLine(line);
      });
      return;
    }

    warn('No known message handler API found on Stockfish instance', {
      keys: instance ? Object.keys(instance) : [],
    });
  }

  function sendToSf(cmd) {
    // Standalone worker mode: stockfish.js handles messages via its own worker
    // message handler (self.onmessage or addEventListener). We should NOT queue
    // or block messages; just let them pass through.
    if (!sf && detectedStandaloneWorker) {
      status('Standalone-worker mode: letting Stockfish worker handle command', cmd);
      return;
    }

    if (!sf) {
      status('Queueing command (stockfish not ready): ' + cmd);
      queue.push(cmd);
      return;
    }

    try {
      console.log('[Worker] >>', cmd);
      if (sf && typeof sf.postMessage === 'function') {
        sf.postMessage(cmd);
      } else if (typeof sf === 'function') {
        sf(cmd);
      } else {
        warn('Cannot send command - no postMessage and not a callable function', {
          sfType: typeof sf,
          keys: sf ? Object.keys(sf) : [],
        });
      }
    } catch (e) {
      fail('Error sending command to Stockfish', e);
    }
  }

  // Use addEventListener so we don't clobber the handler that stockfish.js may set.
  self.addEventListener('message', (e) => {
    const raw = e?.data;
    const cmd = typeof raw === 'string' ? raw : raw?.cmd;
    status('Received command from main thread', { rawType: typeof raw, cmd, raw });
    if (typeof cmd === 'string') sendToSf(cmd);
    else warn('Ignoring non-string, non-{cmd} message from main thread', raw);
  });

  self.onerror = (err) => {
    fail('Worker error event', err);
  };

  // Capture promise rejections (often how wasm instantiation failures show up)
  self.addEventListener('unhandledrejection', (e) => {
    fail('Unhandled promise rejection in worker', e?.reason ?? e);
  });

  status('========== WORKER STARTING ==========', {
    location: self.location?.href,
    hash: self.location?.hash,
    globals: listInterestingGlobals(),
  });

  // Load Stockfish via importScripts so we can introspect what globals appear.
  // Important: the wasm path is typically taken from the worker URL hash.
  status('Attempting to load /stockfish/stockfish.js...', {
    note: 'If wasm fails to load, check Network tab for /stockfish/stockfish.wasm status/size.',
  });

  try {
    importScripts('/stockfish/stockfish.js');
    status('importScripts completed successfully');
  } catch (e) {
    fail('ERROR loading script via importScripts(/stockfish/stockfish.js)', e);
    return;
  }

  status('Available globals after import', listInterestingGlobals());

  // Log whether stockfish.js installed a worker message handler.
  status('Post-import onmessage state', JSON.stringify({
    preImportOnMessageType: typeof preImportOnMessage,
    postImportOnMessageType: typeof self.onmessage,
    onmessageChanged: self.onmessage !== preImportOnMessage,
  }));

  // If stockfish.js installed an onmessage handler, we treat it as a strong
  // signal that this is a standalone-worker build.
  if (typeof self.onmessage === 'function' && self.onmessage !== preImportOnMessage) {
    detectedStandaloneWorker = true;
    status('Detected standalone-worker Stockfish build (self.onmessage changed after import)', {
      note: 'In this mode, we do NOT call Stockfish() constructor. Messages should be handled internally by stockfish.js.',
    });
  }

  // Try multiple initialization methods; record which one works.
  const attempts = [];
  function attempt(label, fn) {
    status(`Attempting Stockfish initialization... ${label}`);
    try {
      const inst = fn();
      attempts.push({ label, ok: true, type: typeof inst, keys: inst ? Object.keys(inst) : [] });
      status(`${label} succeeded`, { type: typeof inst, keys: inst ? Object.keys(inst) : [] });
      return inst;
    } catch (e) {
      attempts.push({ label, ok: false, error: String(e?.message || e) });
      warn(`${label} failed`, e);
      return null;
    }
  }

  // NOTE: Some stockfish.js builds expose different global constructors.
  // We explicitly check each and log what we found.
  status('Checking available constructors...', {
    hasStockfish: typeof self.Stockfish,
    hasSTOCKFISH: typeof self.STOCKFISH,
    hasModule: typeof self.Module,
    moduleKeys: typeof self.Module === 'object' ? Object.keys(self.Module) : [],
  });

  sf =
    (typeof self.Stockfish === 'function' && attempt('Method 1: Using Stockfish() constructor', () => self.Stockfish())) ||
    (typeof self.STOCKFISH === 'function' && attempt('Method 2: Using STOCKFISH() constructor', () => self.STOCKFISH())) ||
    (typeof self.Module === 'object' && typeof self.Module.Stockfish === 'function' &&
      attempt('Method 3: Using Module.Stockfish() constructor', () => self.Module.Stockfish()));

  if (!sf) {
    // Many stockfish.js builds are meant to run as a *standalone worker script* and
    // therefore do not expose a Stockfish() constructor at all.
    //
    // We treat "no constructor" as a supported mode and continue, letting the
    // imported script handle messages internally.
    if (!detectedStandaloneWorker) {
      detectedStandaloneWorker = true;
      warn('No Stockfish constructor found; assuming standalone-worker build. Continuing.', {
        attempts,
        globals: listInterestingGlobals(),
        note: 'If Stockfish still does not respond to UCI, the issue is likely message handler hookup or wasm loading.',
      });
    } else {
      status('Standalone-worker mode: no constructor found (expected). Continuing.', {
        attempts,
      });
    }
  }

  if (sf) {
    status('Stockfish instance created', {
      instanceType: typeof sf,
      hasPostMessage: sf && typeof sf.postMessage === 'function',
      hasOnMessage: sf && typeof sf.onmessage !== 'undefined',
      hasAddMessageListener: sf && typeof sf.addMessageListener === 'function',
    });

    setupSfListeners(sf);
  }

  // Signal readiness to the main thread.
  status('========== WORKER READY ==========', {
    note: 'This only confirms the wrapper initialized. UCI init depends on wasm load + Stockfish responding.',
    standalone: detectedStandaloneWorker,
  });
  try {
    postMessage({ type: 'ready', t: nowMs() });
  } catch {
    // ignore
  }

  // Flush any queued commands.
  if (queue.length > 0) status('Flushing queued commands', { count: queue.length });
  while (queue.length > 0) {
    const cmd = queue.shift();
    if (cmd) sendToSf(cmd);
  }
})();
