export function attachSse(response, log, cursor, {heartbeatMs = 15_000} = {}) {
  let ended = false;
  let unsubscribe = () => {};
  let heartbeat;
  function cleanup() {
    if (ended) return;
    ended = true;
    clearInterval(heartbeat);
    unsubscribe();
  }
  function write(text) {
    if (ended) return false;
    try {
      if (response.write(text)) return true;
    } catch { /* Disconnect this consumer without interrupting other subscribers. */ }
    cleanup();
    response.destroy();
    return false;
  }
  response.on('close', cleanup);
  response.on('error', cleanup);
  response.writeHead(200, {
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-store',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no',
  });
  if (!write('retry: 1000\n: connected\n\n')) return cleanup;
  unsubscribe = log.subscribe(cursor, frame => write(`event: ${frame.event}\nid: ${frame.id}\ndata: ${JSON.stringify(frame.data)}\n\n`));
  if (ended) { unsubscribe(); return cleanup; }
  heartbeat = setInterval(() => write(': heartbeat\n\n'), heartbeatMs);
  heartbeat.unref?.();
  return cleanup;
}
