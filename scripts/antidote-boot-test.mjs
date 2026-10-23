/**
 * Headless P0.1 boot check — serves index.php without PHP and asserts core globals.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 18765;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(filePath));
}

function loadIndexHtml() {
  let html = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
  html = html.replace(/<\?php echo time\(\); \?>/g, String(Date.now()));
  return html;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.php') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loadIndexHtml());
    return;
  }
  const rel = urlPath.replace(/^\//, '');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (urlPath === '/favicon.ico') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  serveFile(res, filePath);
});

async function main() {
  const require = createRequire(import.meta.url);
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error('Install playwright: npm install playwright@1.64.0 --no-save && npx playwright install chromium');
    process.exit(2);
  }

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const checks = await page.evaluate(() => ({
    canvas: !!document.querySelector('canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const filteredErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('Tracking Prevention')
  );

  let ok = true;
  for (const [key, val] of Object.entries(checks)) {
    if (!val) {
      console.error(`FAIL check: ${key}`);
      ok = false;
    }
  }
  if (filteredErrors.length) {
    console.error('Page errors:', filteredErrors);
    ok = false;
  }
  if (!ok) process.exit(1);
  console.log('BOOT PASS', JSON.stringify(checks));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
