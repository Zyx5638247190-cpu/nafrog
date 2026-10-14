// 页面外壳：Service Worker、全屏、装到桌面、竖屏提示、触摸防误触
// 让同一份游戏在电脑 / 平板 / 手机上都能正常开局。

const SW_URL = new URL('../../sw.js', import.meta.url);

/** 注册 Service Worker：装到桌面 + 断网也能玩 */
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: './', updateViaCache: 'none' }).catch(() => {
      /* 本地调试无所谓，注册失败也不影响玩 */
    });
  });
}

/** 全屏按钮 */
function setupFullscreen() {
  const btn = document.getElementById('btn-fullscreen');
  if (!btn) return;
  const supported = Boolean(document.documentElement.requestFullscreen);
  if (!supported) {
    btn.hidden = true;
    return;
  }
  const sync = () => {
    btn.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
  };
  btn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      /* 有些浏览器（比如 iOS Safari）不支持，忽略 */
    }
    sync();
  });
  document.addEventListener('fullscreenchange', sync);
  sync();
}

/** 「装到桌面」：只在浏览器给出安装提示时出现 */
function setupInstall() {
  const btn = document.getElementById('btn-install');
  if (!btn) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) {
    btn.hidden = true;
    return;
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      /* 忽略 */
    }
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
  });
}

/** 竖屏提示：能全屏横屏就直接横过来，也能选择将就着玩 */
function setupOrientationHint() {
  const hint = document.getElementById('rotate-hint');
  if (!hint) return;
  let skip = false;
  try {
    skip = sessionStorage.getItem('nafrog.skipRotate') === '1';
  } catch (err) {
    skip = false;
  }

  const isPortraitPhone = () =>
    window.matchMedia('(orientation: portrait)').matches && Math.min(window.innerWidth, window.innerHeight) <= 900;

  const sync = () => {
    hint.classList.toggle('show', !skip && isPortraitPhone());
  };

  const go = document.getElementById('rotate-go');
  go?.addEventListener('click', async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      /* 忽略 */
    }
    try {
      await screen.orientation?.lock?.('landscape');
    } catch (err) {
      /* 桌面浏览器不支持锁定方向，忽略 */
    }
    skip = true;
    try {
      sessionStorage.setItem('nafrog.skipRotate', '1');
    } catch (err) {
      /* 忽略 */
    }
    sync();
  });

  const skipBtn = document.getElementById('rotate-skip');
  skipBtn?.addEventListener('click', () => {
    skip = true;
    try {
      sessionStorage.setItem('nafrog.skipRotate', '1');
    } catch (err) {
      /* 忽略 */
    }
    sync();
  });

  window.addEventListener('orientationchange', sync);
  window.addEventListener('resize', sync);
  sync();
}

/** 手机上别让双指缩放、双击放大、下拉刷新打断操作 */
function preventGestures() {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}

/** 「复制本局链接 / 每日挑战」：让所有人都能玩到同一局（PvZ 没有的玩法） */
function setupQuestButtons(game) {
  const share = document.getElementById('btn-share');
  const daily = document.getElementById('btn-daily');

  share?.addEventListener('click', async () => {
    if (game && typeof game.copyShareLink === 'function') await game.copyShareLink();
  });

  daily?.addEventListener('click', () => {
    if (!game) return;
    if (game.view?.quest?.mode === 'daily') game.startRandom();
    else game.startDaily();
  });

  if (game && typeof game.syncChrome === 'function') game.syncChrome();
}

export function installPageHelpers(game) {
  setupServiceWorker();
  setupFullscreen();
  setupInstall();
  setupOrientationHint();
  preventGestures();
  setupQuestButtons(game);
}
