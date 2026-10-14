/**
 * Headless P0.1 boot check (no PHP required).
 * Usage: npx playwright install chromium && node scripts/antidote-boot-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = Number(process.env.ANTIDOTE_BOOT_PORT) || 18765;

const indexHtml = fs
  .readFileSync(path.join(root, 'index.php'), 'utf8')
  .replace(/\?v=<\?php echo time\(\); \?>/g, '');

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/index.php' || urlPath === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(indexHtml);
    return;
  }
  const filePath = path.join(root, urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.html': 'text/html',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => {
  if (!String(e.message).includes('favicon')) errors.push('PAGEERROR: ' + e.message);
});
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error' && !text.includes('favicon')) {
    errors.push('CONSOLE.error: ' + text);
  }
});

await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(6500);

const checks = await page.evaluate(() => ({
  initPlayer: typeof window.initPlayer === 'function',
  controls: !!window.controls,
  createTheGray: typeof window.createTheGray === 'function',
  updateSpawner: typeof window.updateSpawner === 'function',
  canvas: !!document.querySelector('#game-container canvas'),
}));

await browser.close();
server.close();

const pass =
  errors.length === 0 &&
  checks.initPlayer &&
  checks.controls &&
  checks.createTheGray &&
  checks.updateSpawner &&
  checks.canvas;

console.log(JSON.stringify({ pass, checks, errors }, null, 2));
process.exit(pass ? 0 : 1);
