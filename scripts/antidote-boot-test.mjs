/**
 * Headless P0.1 boot check — serves index.php without PHP and asserts core globals.
 * Usage: node scripts/antidote-boot-test.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 18765;

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.php': 'text/html',
  };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(filePath));
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '/index.php') {
      let html = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
      html = html.replace(/\?v=\<\?php echo time\(\); \?\>/g, '');
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
      return;
    }
    const filePath = path.join(root, pathname.replace(/^\//, '').split('?')[0]);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    serveFile(filePath, res);
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('favicon.ico')) return;
    pageErrors.push(text);
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(7000);

  const checks = await page.evaluate(() => ({
    canvas: !!document.querySelector('#game-container canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const failed = Object.entries(checks).filter(([, v]) => !v);
  if (pageErrors.length) {
    console.error('PAGE/CONSOLE ERRORS:', pageErrors);
    process.exit(1);
  }
  if (failed.length) {
    console.error('FAILED CHECKS:', failed);
    process.exit(1);
  }
  console.log('BOOT PASS', JSON.stringify(checks));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
