import { chromium } from 'playwright';
import { startAntidoteServer, isBenignConsoleMessage } from './antidote-serve-utils.mjs';

const errors = [];
const { server, url } = await startAntidoteServer(0);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    if (!isBenignConsoleMessage(text)) errors.push(text);
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(
  () => window.Boulders && window.objects?.some((o) => o.userData?.isBoulder),
  { timeout: 30000 }
);

const result = await page.evaluate(() => {
  const boulder = window.objects.find((o) => o.userData?.isBoulder);
  if (!boulder) return { ok: false, reason: 'no boulder' };

  const player = window.controls.getObject();
  player.position.set(boulder.position.x + 2.5, 1.8, boulder.position.z);
  window.camera.position.copy(player.position);
  window.camera.lookAt(boulder.position);
  window.camera.updateMatrixWorld(true);
  boulder.updateMatrixWorld(true);

  const startStone = window.playerInventory.stone;
  for (let i = 0; i < 7; i++) {
    if (typeof window.handleShoot === 'function') window.handleShoot();
    else return { ok: false, reason: 'no handleShoot' };
  }

  return {
    ok: window.playerInventory.stone > startStone,
    startStone,
    endStone: window.playerInventory.stone,
  };
});

await browser.close();
server.close();

if (errors.length) {
  console.error('STONE FAIL (console)');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

if (!result.ok) {
  console.error('STONE FAIL', JSON.stringify(result));
  process.exit(1);
}

console.log(`STONE PASS (stone ${result.startStone} → ${result.endStone})`);
