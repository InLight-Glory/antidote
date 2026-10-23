/**
 * Headless P0.2 wood loop: chop tree → pile → collect → inventory increases.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 18766;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function loadIndexHtml() {
  let html = fs.readFileSync(path.join(ROOT, 'index.php'), 'utf8');
  return html.replace(/<\?php echo time\(\); \?>/g, String(Date.now()));
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.php') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loadIndexHtml());
    return;
  }
  const rel = urlPath.replace(/^\//, '');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(urlPath === '/favicon.ico' ? 404 : 404);
    res.end();
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
});

async function main() {
  const require = createRequire(import.meta.url);
  const playwright = require('playwright');

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.Trees && window.controls && window.handleShoot, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const tree = window.objects.find((o) => o.userData?.isTree && typeof o.userData.health === 'number' && o.userData.health > 0);
    if (!tree) return { ok: false, reason: 'no_tree' };

    const pos = tree.position.clone();
    window.controls.getObject().position.set(pos.x, 1.8, pos.z);

    while (tree.userData.health > 0) {
      window.Trees.damageTree(tree, 200);
    }

    const wood = window.objects.find((o) => o.userData?.isResource && o.userData.type === 'wood');
    if (!wood) return { ok: false, reason: 'no_wood_pile' };

    window.controls.getObject().position.set(wood.position.x, 1.8, wood.position.z);
    const before = window.playerInventory.wood;
    window.handleShoot();
    const after = window.playerInventory.wood;

    return {
      ok: after > before,
      before,
      after,
      woodValue: wood.userData.value,
    };
  });

  await browser.close();
  server.close();

  const filteredErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Tracking Prevention'));
  if (filteredErrors.length) {
    console.error('Page errors:', filteredErrors);
    process.exit(1);
  }
  if (!result.ok) {
    console.error('WOOD FAIL', result);
    process.exit(1);
  }
  console.log('WOOD PASS', JSON.stringify(result));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
