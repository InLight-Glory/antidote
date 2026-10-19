/**
 * Headless P0.1 boot check — serves index.php without PHP and asserts core globals.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 18765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(filePath));
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '/index.php') {
      let html = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
      html = html.replace(/\<\?php echo time\(\); \?\>/g, '1');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(ROOT, safe);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    serveFile(res, filePath);
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico')) return;
      errors.push(text);
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 120000 });

  await page.waitForFunction(
    () =>
      typeof window.initPlayer === 'function' &&
      typeof window.controls !== 'undefined' &&
      typeof window.createTheGray === 'function' &&
      typeof window.updateSpawner === 'function',
    { timeout: 60000 }
  );

  const checks = await page.evaluate(() => ({
    canvas: !!document.querySelector('canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const failed = Object.entries(checks).filter(([, v]) => !v);
  if (failed.length) {
    console.error('BOOT FAIL checks:', failed);
    process.exit(1);
  }
  if (errors.length) {
    console.error('BOOT FAIL page errors:', errors);
    process.exit(1);
  }
  console.log('BOOT PASS', checks);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
