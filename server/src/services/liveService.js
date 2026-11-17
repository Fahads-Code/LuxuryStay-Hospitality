// A tiny server-sent-events hub. Connected clients receive an opaque
// "something changed" ping whenever a write request succeeds. The ping carries
// no records, so each screen can decide what it needs to re-fetch.
const clients = new Set();

const writeEvent = (res, event, payload) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
};

export const addLiveClient = (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const client = { res };
  clients.add(client);

  writeEvent(res, 'ready', { at: Date.now() });

  // Keep intermediaries (including the Vite dev proxy) from closing an idle
  // stream. Clients ignore heartbeat comments.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      /* cleaned up on close */
    }
  }, 10000);

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
};

export const broadcastLiveChange = () => {
  if (clients.size === 0) return;

  // Keep the ping opaque: screens only need to know that something changed.
  const payload = { at: Date.now() };

  for (const client of clients) {
    try {
      writeEvent(client.res, 'change', payload);
    } catch {
      clients.delete(client);
    }
  }
};

export const liveClientCount = () => clients.size;
