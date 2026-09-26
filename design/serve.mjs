import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/screen.html', ['screen.html', 'text/html']], ['/screen.css', ['screen.css', 'text/css']],
  ['/review.css', ['review.css', 'text/css']], ['/screen.js', ['screen.js', 'text/javascript']], ['/review.js', ['review.js', 'text/javascript']],
  ...['sneaker','headphones','backpack'].map(name => [`/assets/${name}.jpg`, [`../public/images/${name}.jpg`, 'image/jpeg']]),
]);
const port = Number(process.argv[2] || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Use a port between 1024 and 65535.');
createServer(async (request, response) => {
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry || !['GET','HEAD'].includes(request.method)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const bytes = await readFile(fileURLToPath(new URL(entry[0], import.meta.url)));
    response.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'" });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(500); response.end('Preview asset unavailable'); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Atlas design review: http://127.0.0.1:${port}/\n`));
