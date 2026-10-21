/**
 * Headless P0.1 boot check — serves index.php as static HTML and loads the game in Chromium.
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
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
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
      html = html.replace(/<\?php echo time\(\); \?>/g, 'boot');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    const rel = urlPath.replace(/^\//, '');
    const filePath = path.join(ROOT, rel);
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
  const base = `http://127.0.0.1:${PORT}/index.php`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];

  page.on('pageerror', (err) => {
    const msg = err.message || String(err);
    if (msg.includes('favicon')) return;
    pageErrors.push(msg);
  });

  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const checks = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const failed = [];
  if (!checks.hasCanvas) failed.push('no canvas');
  if (!checks.initPlayer) failed.push('initPlayer missing');
  if (!checks.controls) failed.push('controls missing');
  if (!checks.createTheGray) failed.push('createTheGray missing');
  if (!checks.updateSpawner) failed.push('updateSpawner missing');
  if (pageErrors.length) failed.push(`page errors: ${pageErrors.join('; ')}`);

  if (failed.length) {
    console.error('BOOT FAIL:', failed.join(', '));
    console.error('checks', checks);
    process.exit(1);
  }

  console.log('BOOT PASS', checks);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
