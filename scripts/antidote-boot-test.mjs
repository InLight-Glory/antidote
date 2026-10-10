/**
 * Headless boot gate for P0.1: load index.php, capture console errors, verify globals.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 11012;

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.php': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
  };
  let body = fs.readFileSync(filePath);
  if (ext === '.php' || (ext === '.html' && filePath.includes('index'))) {
    body = Buffer.from(
      body
        .toString('utf8')
        .replace(/\<\?php echo time\(\); \?\>/g, String(Date.now())),
      'utf8',
    );
  }
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  res.end(body);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath === '/' ? '/index.php' : urlPath;
      const filePath = path.join(ROOT, rel.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      serveFile(filePath, res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const url = `http://127.0.0.1:${PORT}/index.php`;
  const errors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico')) return;
      errors.push(text);
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);

  const checks = await page.evaluate(() => ({
    hasInitPlayer: typeof window.initPlayer === 'function',
    hasControls: !!window.controls,
    hasCreateTheGray: typeof window.createTheGray === 'function',
    hasUpdateSpawner: typeof window.updateSpawner === 'function',
    canvasCount: document.querySelectorAll('canvas').length,
    deathScreenHidden: (() => {
      const el = document.getElementById('death-screen');
      return el ? el.style.display !== 'flex' : true;
    })(),
  }));

  await browser.close();
  server.close();

  const uncaught = [...pageErrors, ...errors];
  const bootFail =
    uncaught.some((e) => /SyntaxError|initPlayer not found|already been declared/i.test(e)) ||
    !checks.hasInitPlayer ||
    !checks.hasCreateTheGray;

  console.log(JSON.stringify({ url, checks, uncaught, bootFail }, null, 2));
  process.exit(bootFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
