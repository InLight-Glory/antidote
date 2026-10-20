/**
 * Headless P0.1 boot check: serves index.php as static HTML and loads the game in Chromium.
 * Usage: npm install playwright@1.64.0 --no-save && npx playwright install chromium && node scripts/antidote-boot-test.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 18765;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

function stripPhp(html) {
  return html.replace(/<\?php[^?]*\?>/g, '');
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    let body = data;
    if (ext === '.html' || filePath.endsWith('index.php')) {
      body = Buffer.from(stripPhp(data.toString('utf8')), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    } else {
      res.writeHead(200, { 'Content-Type': mime });
    }
    res.end(body);
  });
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let rel = urlPath === '/' ? '/index.php' : urlPath;
      rel = rel.replace(/^\//, '');
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      serveFile(filePath, res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('BOOT FAIL: playwright not installed. Run: npm install playwright@1.64.0 --no-save && npx playwright install chromium');
    process.exit(1);
  }

  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}/index.php`;
  const pageErrors = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', (err) => {
    pageErrors.push(String(err.message || err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon.ico')) return;
      pageErrors.push(`console.error: ${text}`);
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);

    const checks = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        hasCanvas: !!canvas,
        initPlayer: typeof window.initPlayer === 'function',
        controls: !!window.controls,
        createTheGray: typeof window.createTheGray === 'function',
        updateSpawner: typeof window.updateSpawner === 'function',
      };
    });

    const failures = [];
    if (!checks.hasCanvas) failures.push('missing canvas');
    if (!checks.initPlayer) failures.push('initPlayer not found');
    if (!checks.controls) failures.push('controls not ready');
    if (!checks.createTheGray) failures.push('createTheGray not found');
    if (!checks.updateSpawner) failures.push('updateSpawner not found');
    if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);

    if (failures.length) {
      console.error('BOOT FAIL:', failures.join('; '));
      console.error('checks:', JSON.stringify(checks));
      process.exitCode = 1;
    } else {
      console.log('BOOT PASS:', JSON.stringify(checks));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error('BOOT FAIL:', e);
  process.exit(1);
});
