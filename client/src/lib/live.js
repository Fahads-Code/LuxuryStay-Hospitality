import { useEffect, useRef, useState } from 'react';

const DEFAULT_POLL_MS = 30000;
const DEFAULT_MIN_GAP_MS = 1500;
const DEFAULT_DEBOUNCE_MS = 350;
const FORCE_COOLDOWN_MS = 700;

let eventSource = null;
let hasConnected = false;
let connectionState = 'connecting';
const statusListeners = new Set();
const changeListeners = new Set();

const publishStatus = (next) => {
  if (connectionState === next) return;
  connectionState = next;
  for (const listener of statusListeners) {
    try {
      listener(next);
    } catch {
      /* a single bad listener must not stop the rest */
    }
  }
};

const publishChange = (detail) => {
  for (const listener of changeListeners) {
    try {
      listener(detail);
    } catch {
      /* ignore listener errors */
    }
  }
};

const subscribeChanges = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};

/**
 * Open a single server-sent-events connection for the whole app. The server
 * only sends a lightweight "something changed" ping, so every screen can
 * refresh its own data without exposing any records over the stream.
 */
const connectStream = () => {
  if (eventSource || typeof window === 'undefined') return;
  if (typeof window.EventSource === 'undefined') {
    publishStatus('unsupported');
    return;
  }

  try {
    eventSource = new window.EventSource('/api/live');
  } catch {
    eventSource = null;
    publishStatus('offline');
    return;
  }

  eventSource.addEventListener('open', () => {
    publishStatus('live');
    // A reconnect may have missed changes while the stream was down.
    if (hasConnected) publishChange({ source: 'reconnect' });
    hasConnected = true;
  });
  eventSource.addEventListener('ready', () => publishStatus('live'));
  eventSource.addEventListener('change', (event) => {
    publishStatus('live');
    publishChange({ source: 'server', reason: event.data || '' });
  });
  eventSource.addEventListener('error', () => {
    // EventSource reconnects on its own. "Offline" only when the browser
    // has permanently closed the stream.
    publishStatus(eventSource?.readyState === 2 ? 'offline' : 'connecting');
  });
};

connectStream();

export const liveStatusCopy = {
  live: 'Live',
  connecting: 'Syncing',
  offline: 'Offline',
  unsupported: 'Auto',
};

/** Subscribe to the live connection state (used for the topbar indicator). */
export const useLiveStatus = () => {
  const [status, setStatus] = useState(connectionState);

  useEffect(() => {
    statusListeners.add(setStatus);
    setStatus(connectionState);
    return () => statusListeners.delete(setStatus);
  }, []);

  return status;
};

/**
 * Refresh a screen automatically:
 *  - instantly when the API reports a change (server-sent events)
 *  - when the tab regains focus or becomes visible again
 *  - on a slow polling interval as a fallback
 *
 * `refresh` is called with `{ quiet: true, background: true }` so pages can
 * update in place without showing a loading spinner or error toast.
 */
export const useLiveRefresh = (refresh, options = {}) => {
  const {
    enabled = true,
    intervalMs = DEFAULT_POLL_MS,
    minGapMs = DEFAULT_MIN_GAP_MS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let disposed = false;
    let running = false;
    let lastRun = 0;
    let lastForced = 0;
    let pollTimer = null;
    let debounceTimer = null;

    const execute = async ({ force = false } = {}) => {
      if (disposed || running) return;
      if (!force && document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (!force && now - lastRun < minGapMs) return;

      lastRun = now;
      running = true;
      try {
        await refreshRef.current?.({ quiet: true, background: true });
      } catch {
        // Background refreshes stay silent; the page surfaces errors for
        // user-initiated loads.
      } finally {
        running = false;
      }
    };

    const schedule = ({ force = false } = {}) => {
      if (disposed) return;

      if (force) {
        const now = Date.now();
        if (now - lastForced < FORCE_COOLDOWN_MS) return;
        lastForced = now;
        if (debounceTimer) {
          window.clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        execute({ force: true });
        return;
      }

      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        execute();
      }, debounceMs);
    };

    const unsubscribe = subscribeChanges(() => schedule());

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule({ force: true });
    };
    const onFocus = () => schedule({ force: true });

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    if (intervalMs > 0) {
      pollTimer = window.setInterval(() => schedule(), intervalMs);
    }

    return () => {
      disposed = true;
      unsubscribe();
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, intervalMs, minGapMs, debounceMs]);
};

export default useLiveRefresh;
