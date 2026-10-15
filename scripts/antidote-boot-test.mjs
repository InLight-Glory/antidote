/**
 * Headless P0.1 boot gate: serves index.php as static HTML and checks globals + console.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.ANTIDOTE_BOOT_PORT || 18765);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

function stripPhpCacheBust(body) {
  return body.replace(/\?v=<\?php echo time\(\); \?>/g, '');
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.php';
    const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    let data = fs.readFileSync(filePath);
    let ext = path.extname(filePath);
    if (filePath.endsWith('index.php')) {
      ext = '.html';
      data = Buffer.from(stripPhpCacheBust(data.toString('utf8')), 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('favicon.ico')) return;
      errors.push(t);
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

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
  if (errors.length) failed.push(`console errors: ${errors.join(' | ')}`);

  if (failed.length) {
    console.error('BOOT FAIL:', failed.join('; '));
    console.error('checks', checks);
    process.exit(1);
  }
  console.log('BOOT PASS', checks);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
