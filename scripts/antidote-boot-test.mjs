import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 18765;

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    let body = data;
    if (contentType === 'text/html') {
      body = Buffer.from(
        data
          .toString('utf8')
          .replace(/\<\?php echo time\(\); \?\>/g, String(Date.now()))
      );
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(body);
  });
}

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.php': 'text/html',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let rel = urlPath === '/' ? '/index.php' : urlPath;
  const filePath = path.join(ROOT, rel.replace(/^\//, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const ext = path.extname(filePath);
  const ct = mime[ext] || 'application/octet-stream';
  if (ext === '.js') {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      let text = data.toString('utf8').replace(/\<\?php echo time\(\); \?\>/g, String(Date.now()));
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(text);
    });
    return;
  }
  serveFile(res, filePath, ct);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const t = msg.text();
    if (!/favicon\.ico/i.test(t) && !/Failed to load resource.*404/i.test(t)) errors.push(t);
  }
});

await page.goto(`http://127.0.0.1:${PORT}/index.php`, { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

const result = await page.evaluate(() => {
  const grayCount = (window.objects || []).filter((o) => o.userData?.isTheGray).length;
  return {
    initPlayer: typeof window.initPlayer === 'function',
    createTheGray: typeof window.createTheGray === 'function',
    updateSpawner: typeof window.updateSpawner === 'function',
    controls: !!window.controls,
    sceneChildren: window.scene ? window.scene.children.length : 0,
    grayCount,
    canvas: !!document.querySelector('canvas'),
  };
});

server.close();
await browser.close();

const uncaught = errors.filter((e) => /uncaught|syntaxerror|already been declared|initPlayer/i.test(e));
const pass =
  uncaught.length === 0 &&
  result.initPlayer &&
  result.createTheGray &&
  result.updateSpawner &&
  result.controls &&
  result.canvas &&
  result.sceneChildren > 10 &&
  result.grayCount >= 1;

console.log(JSON.stringify({ pass, result, errors, uncaught }, null, 2));
process.exit(pass ? 0 : 1);
