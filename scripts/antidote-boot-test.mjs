#!/usr/bin/env node
/**
 * P0.1 headless boot check — loads sed-stripped index.php over file://
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function stripPhp(html) {
  return html
    .replace(/<\?php echo time\(\); \?>/g, '1')
    .replace(/<\?php[\s\S]*?\?>/g, '');
}

async function main() {
  const indexPhp = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
  const html = stripPhp(indexPhp);
  const htmlPath = path.join(root, 'boot-index.html');
  fs.writeFileSync(htmlPath, html);
  const baseUrl = process.env.ANTIDOTE_BOOT_URL || 'http://127.0.0.1:8765/boot-index.html';

  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => errors.push(String(err.message || err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (/favicon\.ico/i.test(t)) return;
        if (/Tracking Prevention/i.test(t)) return;
        // Chrome logs generic 404 text without URL; non-favicon 404s caught via response listener
        if (/Failed to load resource.*404/i.test(t)) return;
        errors.push(t);
      }
    });
    page.on('response', (response) => {
      if (response.status() === 404 && !/favicon\.ico/i.test(response.url())) {
        errors.push(`404 ${response.url()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(
      () => typeof window.initPlayer === 'function' && typeof window.createTheGray === 'function',
      { timeout: 20000 }
    ).catch(async () => {
      const diag = await page.evaluate(() => ({
        initPlayer: typeof window.initPlayer,
        createTheGray: typeof window.createTheGray,
        errors: [],
      }));
      console.error('BOOT diag', diag, 'captured', errors.slice(0, 15));
      throw new Error('initPlayer/createTheGray not ready');
    });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const checks = await page.evaluate(() => ({
      initPlayer: typeof window.initPlayer === 'function',
      createTheGray: typeof window.createTheGray === 'function',
      updateSpawner: typeof window.updateSpawner === 'function',
      controls: !!window.controls,
      canvas: !!document.querySelector('canvas'),
    }));

    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length) {
      console.error('BOOT FAIL missing:', missing.join(', '));
      process.exit(1);
    }
    if (errors.length) {
      console.error('BOOT FAIL console errors:', errors.slice(0, 10));
      process.exit(1);
    }
    console.log('BOOT PASS', JSON.stringify(checks));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('BOOT FAIL', e);
  process.exit(1);
});
