// Serves frontend/dist like Vercel would: SPA fallback + the response headers from frontend/vercel.json
// (vite preview ignores vercel.json, so scanning it would not test the real hosting headers).
// usage: node .zap/serve-frontend.mjs <distDir> <vercel.json> <port>
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const [dist, vercelPath, port] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(vercelPath, 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const toRegex = (source) => new RegExp(`^${source}$`);

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  for (const rule of cfg.headers ?? []) {
    if (toRegex(rule.source).test(path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
  }
  let file = join(dist, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html'); // SPA fallback
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(Number(port), '127.0.0.1');
