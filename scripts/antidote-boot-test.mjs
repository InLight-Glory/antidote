/**
 * P0.1 headless boot check: load index.php scripts via static strip server.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function stripPhp(content) {
  return content.replace(/<\?php echo time\(\); \?>/g, String(Date.now()));
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.html') || filePath.endsWith('.php')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.php';
    const rel = urlPath.replace(/^\//, '');
    let filePath = path.join(ROOT, rel);
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
    let body = fs.readFileSync(filePath);
    if (rel.endsWith('.php')) {
      body = Buffer.from(stripPhp(body.toString('utf8')), 'utf8');
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(body);
  });
}

const errors = [];

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/index.php`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('favicon.ico')) return;
      errors.push(`console.error: ${t}`);
    }
  });

  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const checks = await page.evaluate(() => ({
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
    canvas: !!document.querySelector('canvas'),
  }));

  await browser.close();
  server.close();

  const failed = [];
  if (errors.length) failed.push(...errors);
  for (const [k, v] of Object.entries(checks)) {
    if (!v) failed.push(`missing: ${k}`);
  }

  if (failed.length) {
    console.error('BOOT FAIL');
    failed.forEach((f) => console.error(' -', f));
    process.exit(1);
  }
  console.log('BOOT PASS', JSON.stringify(checks));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
