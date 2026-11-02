#!/usr/bin/env node
/**
 * Headless boot check for P0.1: load index (PHP stripped), assert no uncaught errors
 * and required globals after main.js init.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function stripPhp(html) {
  return html.replace(/<\?php[\s\S]*?\?>/g, '');
}

const indexPath = path.join(root, 'index.php');
const bootHtmlPath = path.join(root, 'boot-index.html');
const html = stripPhp(fs.readFileSync(indexPath, 'utf8'));
fs.writeFileSync(bootHtmlPath, html);

const port = 8765;
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.php') urlPath = '/boot-index.html';
  const filePath = path.join(root, urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

async function run() {
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  let puppeteer;
  try {
    puppeteer = await import('puppeteer-core');
  } catch {
    console.error('Install puppeteer-core: npm install --no-save puppeteer-core');
    process.exit(2);
  }
  const browser = await puppeteer.default.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon.ico')) consoleErrors.push(t);
    }
  });

  await page.goto(`http://127.0.0.1:${port}/boot-index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.THREE !== 'undefined', { timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.initPlayer === 'function' && typeof window.createTheGray === 'function',
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 6500));

  const checks = await page.evaluate(() => ({
    initPlayer: typeof window.initPlayer === 'function',
    createTheGray: typeof window.createTheGray === 'function',
    controls: !!window.controls,
    objects: Array.isArray(window.objects),
    updateSpawner: typeof window.updateSpawner === 'function',
    initPlayerNotFoundLogged: false,
  }));

  await browser.close();
  server.close();

  const spawnerErrors = consoleErrors.filter((e) => e.includes('Spawner: Missing required global'));
  const syntaxErrors = consoleErrors.filter((e) => e.includes('SyntaxError') || e.includes('already been declared'));

  let ok = true;
  if (!checks.initPlayer) {
    console.error('FAIL: initPlayer missing');
    ok = false;
  }
  if (!checks.createTheGray) {
    console.error('FAIL: createTheGray missing');
    ok = false;
  }
  if (!checks.controls) {
    console.error('FAIL: window.controls not set after init');
    ok = false;
  }
  if (syntaxErrors.length) {
    console.error('FAIL: Syntax/duplicate errors:', syntaxErrors);
    ok = false;
  }
  if (consoleErrors.some((e) => e.includes('initPlayer) not found'))) {
    console.error('FAIL: initPlayer not found logged');
    ok = false;
  }
  if (spawnerErrors.length) {
    console.error('FAIL: spawner missing globals at spawn:', spawnerErrors);
    ok = false;
  }
  if (consoleErrors.length && !ok) {
    console.error('Console errors:', consoleErrors);
  }
  if (ok) {
    console.log('PASS: P0.1 boot — initPlayer, createTheGray, controls OK; no uncaught errors in first 6.5s');
    process.exit(0);
  }
  process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
