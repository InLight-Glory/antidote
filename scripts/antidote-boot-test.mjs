#!/usr/bin/env node
/**
 * Headless boot gate for P0.1 — loads index.php entry (classic + module scripts).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.ANTIDOTE_BOOT_PORT) || 18765;
const CHROME =
  process.env.CHROME_PATH ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/usr/local/bin/google-chrome';

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
    '.php': 'text/html',
  };
  return map[ext] || 'application/octet-stream';
}

function stripPhpCacheBust(body) {
  return body.replace(/\?v=<\?php echo time\(\); \?>/g, `?v=${Date.now()}`);
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname);
      if (urlPath === '/') urlPath = '/index.php';
      const filePath = path.join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('');
        return;
      }
      let body = fs.readFileSync(filePath);
      if (filePath.endsWith('.php')) {
        body = Buffer.from(stripPhpCacheBust(body.toString('utf8')), 'utf8');
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(body);
    } catch (err) {
      res.writeHead(500);
      res.end('');
      console.error(err);
    }
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error('BOOT FAIL: Chrome not found at', CHROME);
    process.exit(1);
  }

  const puppeteerPath = path.join(ROOT, 'node_modules', 'puppeteer-core');
  if (!fs.existsSync(puppeteerPath)) {
    console.error('BOOT FAIL: run npm install --no-save puppeteer-core in repo root');
    process.exit(1);
  }

  const puppeteer = await import('puppeteer-core');
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });

  const url = `http://127.0.0.1:${PORT}/index.php`;
  const pageErrors = [];
  let checks = null;

  try {
    const browser = await puppeteer.default.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(8000);

    checks = await page.evaluate(() => ({
      hasCanvas: !!document.querySelector('canvas'),
      initPlayer: typeof window.initPlayer === 'function',
      updatePlayer: typeof window.updatePlayer === 'function',
      controls: !!window.controls,
      createTheGray: typeof window.createTheGray === 'function',
      updateSpawner: typeof window.updateSpawner === 'function',
      scene: !!window.scene,
    }));

    await browser.close();
  } finally {
    server.close();
  }

  const filteredErrors = pageErrors.filter(
    (e) =>
      !/favicon|Tracking Prevention|404 \(Not Found\)/i.test(e) &&
      !/Failed to load resource.*favicon/i.test(e)
  );

  const syntaxOrBoot = filteredErrors.filter((e) =>
    /SyntaxError|already been declared|initPlayer not found|ReferenceError.*initPlayer/i.test(e)
  );

  const required = {
    hasCanvas: true,
    initPlayer: true,
    controls: true,
    createTheGray: true,
    updateSpawner: true,
    scene: true,
  };

  const failedKeys = Object.keys(required).filter((k) => checks?.[k] !== required[k]);

  if (failedKeys.length || syntaxOrBoot.length) {
    console.error('BOOT FAIL');
    if (failedKeys.length) console.error('Checks failed:', failedKeys.join(', '), checks);
    if (syntaxOrBoot.length) console.error('Console:', syntaxOrBoot);
    if (filteredErrors.length) console.error('Other console errors:', filteredErrors.slice(0, 8));
    process.exit(1);
  }

  console.log('BOOT PASS', JSON.stringify({ checks, consoleWarnings: filteredErrors.length }));
  process.exit(0);
}

main().catch((err) => {
  console.error('BOOT FAIL', err);
  process.exit(1);
});
