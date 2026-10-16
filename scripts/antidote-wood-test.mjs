import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.ANTIDOTE_PORT || 8766);

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
      const types = { '.js': 'application/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(fp));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startAntidoteServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.objects && window.objects.length > 20 && window.Trees, null, {
    timeout: 60000,
  });

  const result = await page.evaluate(async () => {
    const out = { ok: false, step: 'init', wood: 0, modal: false };

    if (!window.controls || !window.Trees || !window.objects) {
      out.step = 'missing_globals';
      return out;
    }

    const tree = window.objects.find((o) => o.userData?.isTree && o.userData.health > 0);
    if (!tree) {
      out.step = 'no_tree';
      return out;
    }

    const playerObj = window.controls.getObject();
    playerObj.position.set(tree.position.x + 2, 1.8, tree.position.z + 1);
    window.camera.position.copy(playerObj.position);
    window.camera.lookAt(tree.position.x, tree.position.y + 2, tree.position.z);

    // Headless: pointer lock unavailable; mimic FPS mode for input handlers.
    window.controls.isLocked = true;
    document.body.classList.add('pointer-lock-active');

    while (tree.userData.health > 0) {
      window.Trees.damageTree(tree, window.SHOOT_DAMAGE || 25);
    }

    const woodPile = window.objects.find((o) => o.userData?.isResource && o.userData.type === 'wood');
    if (!woodPile) {
      out.step = 'no_wood_pile';
      return out;
    }

    playerObj.position.set(woodPile.position.x, 1.8, woodPile.position.z + 1.2);
    window.camera.position.copy(playerObj.position);
    window.camera.lookAt(woodPile.position.x, woodPile.position.y, woodPile.position.z);
    window.camera.updateMatrixWorld(true);

    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), window.camera);
    const hits = rc.intersectObjects(window.objects, true);
    out.hitNames = hits.slice(0, 5).map((h) => h.object.name);
    out.distToWood = window.InteractionModal?.horizontalDistanceTo?.(woodPile);
    out.isLocked = window.controls.isLocked;

    const resolved = window.InteractionModal?.findTargetUnderReticle?.();
    if (window.InteractionModal?.updateInteractionModal) {
      window.InteractionModal.updateInteractionModal();
    }
    const modal = document.getElementById('interaction-info-modal');
    out.modal = modal && modal.style.display !== 'none';
    out.modalTitle = document.getElementById('interaction-info-title')?.textContent || '';

    if (!resolved || resolved.kind !== 'wood') {
      out.step = 'reticle_not_wood';
      out.resolvedKind = resolved?.kind;
      return out;
    }

    const before = window.playerInventory.wood;
    const evt = new MouseEvent('mousedown', { button: 0, bubbles: true });
    document.dispatchEvent(evt);

    await new Promise((r) => setTimeout(r, 50));
    out.wood = window.playerInventory.wood;
    out.ok = out.wood > before;
    out.step = out.ok ? 'done' : 'pickup_failed';
    const hudWood = document.getElementById('hud-wood')?.textContent || '';
    out.hud = hudWood;
    return out;
  });

  await browser.close();
  server.close();

  const ok = result.ok && result.modal && errors.length === 0;
  console.log(JSON.stringify({ ok, result, errors }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
