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
  () =>
    typeof window.initPlayer === 'function' &&
    window.controls &&
    typeof window.createTheGray === 'function' &&
    typeof window.updateSpawner === 'function' &&
    document.querySelector('canvas'),
  { timeout: 30000 }
);

await browser.close();
server.close();

if (errors.length) {
  console.error('BOOT FAIL');
  errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('BOOT PASS');
