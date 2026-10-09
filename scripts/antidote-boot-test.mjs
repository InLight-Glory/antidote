/**
 * Headless boot gate for P0.1: load classic scripts + main module like index.php.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const port = 18765;

function bootHtml() {
  const php = readFileSync(join(root, 'index.php'), 'utf8');
  return php.replace(/\?v=\<\?php echo time\(\); \?\>/g, '?v=boot');
}

function mime(path) {
  const ext = extname(path);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.php': 'text/html',
  };
  return map[ext] || 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        let rel = decodeURIComponent(url.pathname);
        if (rel === '/' || rel === '/index.php') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(bootHtml());
          return;
        }
        const filePath = join(root, rel.replace(/^\//, ''));
        if (!filePath.startsWith(root) || !existsSync(filePath)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(filePath) });
        res.end(readFileSync(filePath));
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon')) errors.push(`console.error: ${t}`);
    }
  });

  await page.goto(`http://127.0.0.1:${port}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const checks = await page.evaluate(() => ({
    initPlayer: typeof window.initPlayer === 'function',
    createTheGray: typeof window.createTheGray === 'function',
    controls: !!window.controls,
    updateSpawner: typeof window.updateSpawner === 'function',
    canvas: !!document.querySelector('canvas'),
  }));

  await browser.close();
  server.close();

  const failed = [];
  if (errors.length) failed.push(...errors);
  if (!checks.initPlayer) failed.push('missing window.initPlayer');
  if (!checks.createTheGray) failed.push('missing window.createTheGray');
  if (!checks.controls) failed.push('missing window.controls after init');
  if (!checks.updateSpawner) failed.push('missing window.updateSpawner');
  if (!checks.canvas) failed.push('no WebGL canvas rendered');

  if (failed.length) {
    console.error('BOOT FAIL');
    failed.forEach((line) => console.error(line));
    process.exit(1);
  }
  console.log('BOOT PASS', JSON.stringify(checks));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
