import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const MIME = {
  '.html': 'text/html',
  '.php': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

export function getRepoRoot() {
  return join(fileURLToPath(new URL('.', import.meta.url)), '..');
}

export function startAntidoteServer(port = 0) {
  const root = getRepoRoot();
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        let path = (req.url || '/').split('?')[0];
        if (path === '/') path = '/index.php';
        const filePath = join(root, decodeURIComponent(path.replace(/^\//, '')));
        if (!filePath.startsWith(root) || !existsSync(filePath)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        let body = readFileSync(filePath);
        if (filePath.endsWith('.php')) {
          body = Buffer.from(
            body.toString().replace(/<\?php echo time\(\); \?>/g, String(Date.now()))
          );
        }
        const type = MIME[extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(body);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}/index.php` });
    });
  });
}

export function isBenignConsoleMessage(text) {
  const t = text || '';
  return (
    t.includes('Tracking Prevention') ||
    t.includes('favicon.ico') ||
    t.includes('Failed to load resource') && t.includes('favicon')
  );
}
