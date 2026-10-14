// Service Worker：让「奶蛙大战奶龙」可以装到桌面、断网也能开局
//
// 策略：
//   - 页面 / JS / CSS：网络优先，失败再回落到缓存（这样更新能立刻生效，断网也能玩）
//   - 图标 / manifest：缓存优先（基本不变）
// 零第三方依赖，和游戏本体一样只用浏览器原生能力。

const VERSION = 'nafrog-v4';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './src/app/main.js',
  './src/app/input.js',
  './src/app/audio.js',
  './src/app/shell.js',
  './src/core/config.js',
  './src/core/layout.js',
  './src/core/level.js',
  './src/core/state.js',
  './src/core/stats.js',
  './src/core/update.js',
  './src/core/weather.js',
  './src/core/affix.js',
  './src/core/fuse.js',
  './src/render/draw.js',
  './src/render/sprites.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // 单个文件失败不应该让整个安装失败
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            /* 忽略 */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isAsset = (url) => /\.(png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
        if (hit) return hit;
        return new Response('离线了，而且这一份还没缓存下来', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});
