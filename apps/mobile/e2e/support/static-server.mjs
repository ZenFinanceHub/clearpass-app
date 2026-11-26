#!/usr/bin/env node
// Tiny static file server for the e2e web export (no dependencies).
//
//   node e2e/support/static-server.mjs [rootDir] [port]
//
// Defaults: rootDir = dist-e2e, port = $E2E_PORT or 8090. Binds to
// 127.0.0.1 only. Resolution order for a request path:
//   1. the exact file           (/_expo/static/js/web/entry-*.js)
//   2. <path>.html              (/landing -> landing.html, expo static output)
//   3. <path>/index.html
//   4. SPA fallback: index.html (expo-router then renders the route client-side)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist-e2e');
const port = Number(process.argv[3] ?? process.env.E2E_PORT ?? 8090);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const base = join(root, rel);
  // Never serve anything outside the export directory.
  if (base !== root && !base.startsWith(root + sep)) return null;

  const candidates = [base, `${base}.html`, join(base, 'index.html')];
  for (const c of candidates) {
    if (await isFile(c)) return c;
  }
  return join(root, 'index.html');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const file = await resolveFile(url.pathname);
    if (!file) {
      res.writeHead(400).end('bad path');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[e2e static] serving ${root} on http://127.0.0.1:${port}`);
});
