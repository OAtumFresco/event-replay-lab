import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEventLog } from './log.js';
import { attachSse } from './sse.js';

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const assets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/model.js',['model.js','text/javascript; charset=utf-8']],
  ['/style.css',['style.css','text/css; charset=utf-8']],
]);
const json = (res, status, body) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };

export function createLabServer({log = createEventLog(), maxClients = 64, heartbeatMs = 15_000} = {}) {
  const server = createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const host = req.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) {
        return json(res,403,{error:'Use this lab on its loopback origin.'});
      }
      const url = new URL(req.url,`http://${host}`);
      if (req.method === 'GET' && url.pathname === '/events') {
        if (log.listenerCount >= maxClients) return json(res,503,{error:'Connection limit reached.'});
        // A reconnect header must supersede the original query cursor.
        attachSse(res,log,req.headers['last-event-id'] ?? url.searchParams.get('cursor'),{heartbeatMs});
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res,200,log.state());
      if (req.method === 'POST' && url.pathname === '/api/increment') {
        if (req.headers['x-lab-action'] !== 'increment') return json(res,400,{error:'X-Lab-Action: increment is required.'});
        // No request body is accepted. A fixed action keeps the demo protocol small.
        if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) !== 0) return json(res,413,{error:'This action takes no body.'});
        return json(res,201,log.append(1));
      }
      const asset = assets.get(url.pathname);
      if (req.method === 'GET' && asset) {
        const data = await readFile(resolve(publicDirectory,asset[0]));
        res.writeHead(200,{'Content-Type':asset[1]}); return res.end(data);
      }
      json(res,404,{error:'Not found.'});
    } catch {
      if (!res.headersSent) json(res,500,{error:'Could not complete this operation.'});
      else res.destroy();
    }
  });
  return {server,log};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {server} = createLabServer();
  server.listen(Number(process.env.LAB_PORT ?? 4179),'127.0.0.1',() => {
    console.log(`Event Replay Lab: http://127.0.0.1:${server.address().port}`);
  });
  const stop = () => {server.close(); server.closeAllConnections();};
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
}
