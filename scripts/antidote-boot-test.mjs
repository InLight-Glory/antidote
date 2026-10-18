import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = 18765;

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function buildIndexHtml() {
  let html = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
  html = html.replace(/\?v=\<\?php echo time\(\); \?\>/g, '');
  html = html.replace(/\<\?php echo time\(\); \?\>/g, '');
  return html;
}

const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.php') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(buildIndexHtml());
    return;
  }
  const rel = urlPath.replace(/^\//, '');
  const filePath = path.join(root, rel);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const ext = path.extname(filePath);
  serveFile(res, filePath, mime[ext] || 'application/octet-stream');
});

const errors = [];
let passed = false;

try {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('favicon')) errors.push(t);
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  const checks = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: typeof window.controls !== 'undefined',
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
  console.log('BOOT PASS', JSON.stringify(checks));
  passed = true;
} catch (e) {
  console.error('BOOT FAIL', e);
  server.close();
  process.exit(1);
}

if (!passed) process.exit(1);
