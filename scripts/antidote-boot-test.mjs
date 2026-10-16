import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.ANTIDOTE_PORT || 8765);

function startAntidoteServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath === '/' ? '/index.php' : urlPath;
      const fp = path.join(ROOT, rel);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      if (rel.endsWith('.php')) {
        let html = fs.readFileSync(fp, 'utf8');
        html = html.replace(/<\?php echo time\(\); \?>/g, String(Date.now()));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
      const ext = path.extname(fp);
      const types = {
        '.js': 'application/javascript',
        '.css': 'text/css',
      };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(fp));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const BASE = process.env.ANTIDOTE_URL || `http://127.0.0.1:${PORT}/index.php`;

const errors = [];
const pageErrors = [];

async function main() {
  const ownServer = !process.env.ANTIDOTE_URL;
  const server = ownServer ? await startAntidoteServer() : null;

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

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const checks = await page.evaluate(() => ({
    initPlayer: typeof window.initPlayer === 'function',
    createTheGray: typeof window.createTheGray === 'function',
    controls: !!window.controls,
    updateSpawner: typeof window.updateSpawner === 'function',
    hasCanvas: !!document.querySelector('canvas'),
  }));

  await browser.close();
  if (server) server.close();

  const uncaught = [...pageErrors, ...errors];
  const ok =
    uncaught.length === 0 &&
    checks.initPlayer &&
    checks.createTheGray &&
    checks.updateSpawner &&
    checks.hasCanvas;

  console.log(JSON.stringify({ ok, uncaught, checks }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
