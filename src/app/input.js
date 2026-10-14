// 输入：把鼠标 / 触摸 / 键盘统一成逻辑坐标事件

import { CANVAS } from '../core/config.js';

export function createInput(canvas, handlers = {}) {
  const toLogical = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const sx = CANVAS.w / (r.width || CANVAS.w);
    const sy = CANVAS.h / (r.height || CANVAS.h);
    return {
      x: Math.max(0, Math.min(CANVAS.w, (clientX - r.left) * sx)),
      y: Math.max(0, Math.min(CANVAS.h, (clientY - r.top) * sy)),
    };
  };

  let locked = false;
  let down = false;

  const onDown = (e) => {
    if (e.pointerId !== undefined && canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* 忽略 */
      }
    }
    locked = e.button === 2 || e.ctrlKey;
    down = true;
    const p = toLogical(e.clientX, e.clientY);
    handlers.onDown?.(p.x, p.y, { button: e.button, locked });
  };

  const onMove = (e) => {
    const p = toLogical(e.clientX, e.clientY);
    handlers.onMove?.(p.x, p.y, { down, locked });
  };

  const onUp = (e) => {
    down = false;
    const p = toLogical(e.clientX, e.clientY);
    handlers.onUp?.(p.x, p.y, { locked });
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', () => handlers.onLeave?.());
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const onKey = (e) => {
    handlers.onKey?.(e);
  };
  window.addEventListener('keydown', onKey);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    },
  };
}

/** 自适应窗口，保持 1280x800 比例（letterbox） */
export function fitCanvas(canvas, dpr = 1) {
  const parent = canvas.parentElement || document.body;
  const availW = parent.clientWidth || window.innerWidth;
  const availH = parent.clientHeight || window.innerHeight;
  const scale = Math.min(availW / CANVAS.w, availH / CANVAS.h);
  const w = Math.max(320, Math.floor(CANVAS.w * scale));
  const h = Math.max(200, Math.floor(CANVAS.h * scale));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(CANVAS.w * dpr);
  canvas.height = Math.floor(CANVAS.h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { scale, w, h };
}
