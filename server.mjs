// Zero-dependency static file server for 奶蛙大战奶龙.
// Usage: node server.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';

    const target = normalize(join(ROOT, pathname));
    if (!target.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: pathname + '/' }).end();
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': body.length,
    });
    res.end(body);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('500 ' + (err?.message || 'error'));
    }
  }
});

/** 本机在局域网里的地址：手机 / 平板连同一个 Wi-Fi 就能打开 */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      out.push(net.address);
    }
  }
  return out;
}

server.listen(PORT, () => {
  console.log('');
  console.log('🐸🐉 奶蛙大战奶龙');
  console.log(`  电脑上玩：   http://localhost:${PORT}/`);
  const lan = lanAddresses();
  if (lan.length) {
    console.log('  手机/平板玩：' + lan.map((ip) => `http://${ip}:${PORT}/`).join('   '));
    console.log('             （手机连同一个 Wi-Fi，直接输入上面这个网址）');
  }
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});
