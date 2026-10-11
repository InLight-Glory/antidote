/**
 * Headless boot check for index.php (P0.1).
 * Serves the repo root and strips PHP cache-bust tags from index.php.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 11011;

const MIME = {
  '.html': 'text/html',
  '.php': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

function serveIndexPhp(res) {
  const raw = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
  const html = raw.replace(/<\?php echo time\(\); \?>/g, String(Date.now()));
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url?.split('?')[0] || '/');
      if (urlPath === '/' || urlPath === '/index.php') {
        serveIndexPhp(res);
        return;
      }
      const rel = urlPath.replace(/^\//, '');
      const filePath = path.normalize(path.join(ROOT, rel));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}/index.php`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(
    () =>
      typeof window.initPlayer === 'function' &&
      typeof window.controls !== 'undefined' &&
      typeof window.createTheGray === 'function',
    { timeout: 30000 }
  );
  await page.waitForTimeout(2000);

  const checks = await page.evaluate(() => ({
    hasCanvas: !!document.querySelector('canvas'),
    initPlayer: typeof window.initPlayer === 'function',
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
  }));

  await browser.close();
  server.close();

  const uncaught = [...pageErrors, ...consoleErrors.filter((t) => /uncaught|syntaxerror|not found/i.test(t))];
  const failed =
    uncaught.length > 0 ||
    !checks.initPlayer ||
    !checks.controls ||
    !checks.createTheGray ||
    !checks.hasCanvas;

  console.log(JSON.stringify({ checks, consoleErrors, pageErrors, pass: !failed }, null, 2));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
