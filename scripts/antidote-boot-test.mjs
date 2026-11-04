#!/usr/bin/env node
/**
 * P0.1 headless boot gate: serves index.php (PHP tags stripped) and checks globals + console.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = 8765;

function serveIndexHtml() {
  const raw = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
  return raw.replace(/\<\?php echo time\(\); \?\>/g, String(Date.now()));
}

function startServer() {
  const indexHtml = serveIndexHtml();
  const mime = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.php': 'text/html',
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/' || urlPath === '/index.php') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexHtml);
        return;
      }
      const filePath = path.join(root, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon')) errors.push(t);
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(6500);

  const checks = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('#game-container canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const failed = [];
  if (!checks.hasCanvas) failed.push('missing WebGL canvas');
  if (!checks.initPlayer) failed.push('initPlayer missing');
  if (!checks.controls) failed.push('window.controls missing');
  if (!checks.createTheGray) failed.push('createTheGray missing');
  if (errors.length) failed.push(`console errors: ${errors.join(' | ')}`);

  if (failed.length) {
    console.error('BOOT FAIL:', failed.join('; '));
    process.exit(1);
  }
  console.log('BOOT PASS:', JSON.stringify(checks));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
