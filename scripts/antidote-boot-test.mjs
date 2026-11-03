#!/usr/bin/env node
/**
 * Headless boot gate for P0.1 — serves index.php without PHP and checks console + globals.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/index.php`;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.php': 'text/html',
};

function stripPhpQueryUrls(body) {
  return body.replace(/\?v=<\?php echo time\(\); \?>/g, '?v=boottest');
}

async function serveFile(pathname) {
  const safe = pathname.split('?')[0];
  const rel = safe === '/' ? '/index.php' : safe;
  const filePath = join(ROOT, rel.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT)) return null;
  let data = await readFile(filePath);
  let body = data.toString('utf8');
  if (rel.endsWith('.php') || rel.endsWith('.html')) {
    body = stripPhpQueryUrls(body);
  }
  return { body, type: MIME[extname(rel)] || 'application/octet-stream' };
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const result = await serveFile(new URL(req.url, BASE).pathname);
        if (!result) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': result.type });
        res.end(result.body);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(String(err.message || err));
  });

  let pass = true;
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(
      () =>
        typeof window.initPlayer === 'function' &&
        typeof window.createTheGray === 'function' &&
        window.controls &&
        window.scene &&
        document.querySelector('#game-container canvas'),
      { timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    const boot = await page.evaluate(() => ({
      initPlayer: typeof window.initPlayer === 'function',
      createTheGray: typeof window.createTheGray === 'function',
      controls: !!window.controls,
      objects: Array.isArray(window.objects),
      canvas: !!document.querySelector('#game-container canvas'),
    }));

    const filteredErrors = consoleErrors.filter(
      (t) =>
        !t.includes('Tracking Prevention') &&
        !t.includes('favicon.ico') &&
        !t.includes('Spawner: Missing required global objects')
    );

    if (filteredErrors.length) {
      pass = false;
      console.error('Console errors:', filteredErrors);
    }
    for (const [k, v] of Object.entries(boot)) {
      if (!v) {
        pass = false;
        console.error('Boot check failed:', k);
      }
    }
  } catch (e) {
    pass = false;
    console.error('Boot test exception:', e);
    if (consoleErrors.length) console.error('Console:', consoleErrors);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(pass ? 'BOOT_TEST: PASS' : 'BOOT_TEST: FAIL');
  process.exit(pass ? 0 : 1);
}

main();
