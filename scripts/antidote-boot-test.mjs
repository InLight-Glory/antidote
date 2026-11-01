#!/usr/bin/env node
/**
 * P0.1 headless boot check (no PHP required).
 * Usage from repo root:
 *   npm install --no-save puppeteer-core
 *   node scripts/antidote-boot-test.mjs
 *
 * Ignores favicon 404 and Tracking Prevention CDN warnings.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);

const CHROME =
  process.env.CHROME_PATH ||
  '/usr/local/bin/google-chrome';

function buildBootHtml() {
  const indexPhp = readFileSync(join(repoRoot, 'index.php'), 'utf8');
  return indexPhp.replace(/\?v=\<\?php echo time\(\); \?\>/g, '').replace(/\<\?php echo time\(\); \?\>/g, '1');
}

function startStaticServer(html) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';
      if (url === '/' || url === '/index.php' || url === '/boot-index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
      const rel = url.startsWith('/') ? url.slice(1) : url;
      const filePath = join(repoRoot, rel);
      try {
        const body = readFileSync(filePath);
        const ext = rel.split('.').pop();
        const types = {
          js: 'application/javascript',
          css: 'text/css',
          png: 'image/png',
          ico: 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function runBrowser(port) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('Install puppeteer-core: npm install --no-save puppeteer-core');
    process.exit(2);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const url = `http://127.0.0.1:${port}/boot-index.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.initPlayer === 'function' && window.controls && window.createTheGray && window.scene && document.querySelector('canvas'),
    { timeout: 30000 },
  );
  await new Promise((r) => setTimeout(r, 2500));

  const checks = await page.evaluate(() => ({
    initPlayer: typeof window.initPlayer,
    controls: !!window.controls,
    createTheGray: typeof window.createTheGray,
    updateSpawner: typeof window.updateSpawner,
    canvas: !!document.querySelector('canvas'),
  }));

  await browser.close();

  const uncaught = errors.filter((e) => {
    if (/Tracking Prevention/i.test(e)) return false;
    if (/favicon/i.test(e)) return false;
    if (/Failed to load resource/i.test(e)) return false;
    return true;
  });

  return { checks, uncaught, ignored: errors.length - uncaught.length };
}

async function main() {
  const html = buildBootHtml();
  writeFileSync(join(repoRoot, 'boot-index.html'), html);

  const { server, port } = await startStaticServer(html);
  try {
    const result = await runBrowser(port);
    console.log(JSON.stringify(result, null, 2));
    if (result.uncaught.length) {
      process.exit(1);
    }
    console.log('P0.1 boot check: PASS');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
