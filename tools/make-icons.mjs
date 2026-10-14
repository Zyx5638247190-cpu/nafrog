// 生成 PWA / 手机主屏图标（零依赖：自己算像素 + 自己写 PNG）
// 用法: node tools/make-icons.mjs
//
// 图标内容：绿草地底色 + 一只会笑的奶瓶（本作的主角「奶蛙」的招牌形象）。
// 输出：icons/icon-192.png, icons/icon-512.png,
//       icons/icon-maskable-512.png（留出安全区，给安卓自适应图标用）,
//       icons/apple-touch-icon.png（180，iOS 加到主屏用）

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ------------------------------------------------------------------ PNG 编码

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** rgba: Float32Array，长度 w*h*4，取值 0..1，直通 alpha */
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[o++] = Math.round(clamp01(rgba[i]) * 255);
      raw[o++] = Math.round(clamp01(rgba[i + 1]) * 255);
      raw[o++] = Math.round(clamp01(rgba[i + 2]) * 255);
      raw[o++] = Math.round(clamp01(rgba[i + 3]) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ 极简光栅器

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

class Canvas {
  constructor(size) {
    this.size = size;
    this.px = new Float32Array(size * size * 4);
  }

  /**
   * 用有符号距离函数填充一个形状。
   * sdf(x, y) < 0 表示在形状内部；color 可以是颜色或 (x,y)=>颜色。
   */
  fill(sdf, color, alpha = 1) {
    const n = this.size;
    const px = this.px;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = sdf(x + 0.5, y + 0.5);
        if (d > 1) continue;
        const a = clamp01(0.5 - d) * alpha;
        if (a <= 0) continue;
        const c = typeof color === 'function' ? color(x + 0.5, y + 0.5) : color;
        const i = (y * n + x) * 4;
        for (let k = 0; k < 3; k++) px[i + k] = px[i + k] * (1 - a) + c[k] * a;
        px[i + 3] = px[i + 3] * (1 - a) + a;
      }
    }
  }
}

const sdCircle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const sdEllipse = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

const sdRoundRect = (cx, cy, hw, hh, r) => (x, y) => {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

/** 交集：两个形状都满足才在内部 */
const sdIntersect = (a, b) => (x, y) => Math.max(a(x, y), b(x, y));

/** 甜甜圈（用于嘴巴的弧线） */
const sdRing = (cx, cy, r, thick) => (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) - thick;

// ------------------------------------------------------------------ 图标绘制

const GRASS_A = hex('#9ee06f');
const GRASS_B = hex('#3f8f45');
const SHADOW = hex('#1d3b2a');
const WHITE = hex('#fffdf7');
const MILK = hex('#dbeeff');
const BLUE = hex('#5fc0ea');
const GOLD = hex('#ffd166');
const ORANGE = hex('#ffb85c');
const CREAM = hex('#fff3cf');
const SCLERA = hex('#eef8dc');
const PUPIL = hex('#1e2418');
const OLIVE = hex('#867d3f');
const BLUSH = hex('#ff9ec1');
/** 奶蛙的招牌黄：底色到暗部 */
const FROG_Y = hex('#f6d338');
const FROG_Y_D = hex('#d9ac1a');
const MOUTH = hex('#8d3b34');
const TONGUE = hex('#e2797f');

/**
 * 图标就是一只奶蛙的正脸：黄澄澄的梨形身子、两只凸起的大圆眼（眼白泛绿、
 * 瞳孔是小黑点）、一张笑到合不拢的大嘴，右下角还捏着一瓶奶。
 *
 * @param {number} size 边长
 * @param {boolean} maskable 是否按安卓自适应图标画（背景铺满，主体缩到安全区）
 */
function renderIcon(size, maskable = false) {
  const c = new Canvas(size);
  const S = size / 512; // 统一按 512 设计再缩放
  const k = maskable ? 0.76 : 1;
  // 把设计坐标换算到当前画布（含 maskable 缩放）
  const P = (v) => (v - 256) * S * k + size / 2;
  const px = P;
  const py = P;
  // 半径 / 粗细的换算（不含中心平移）
  const r = (v) => v * S * k;

  // 底：草地渐变（maskable 铺满整块，普通图标是圆角方块）
  const bg = maskable ? sdRoundRect(256, 256, 256, 256, 0) : sdRoundRect(256, 256, 244, 244, 112);
  c.fill(bg, (_x, y) => mixc(GRASS_A, GRASS_B, clamp01((y / size) * 1.05 - 0.05)));
  // 左上角高光
  c.fill(
    bg,
    (x, y) => mixc(GRASS_A, WHITE, clamp01(0.55 - Math.hypot(x - size * 0.32, y - size * 0.26) / (size * 1.1)) * 0.9),
  );

  // 脚下阴影
  c.fill(sdEllipse(px(256), py(464), r(150), r(24)), SHADOW, 0.2);

  // 梨形身子：下面宽、上面窄，两块椭圆拼出轮廓
  const bodyShade = (x, y) => mixc(FROG_Y, FROG_Y_D, clamp01((y - py(210)) / (250 * S * k)));
  c.fill(sdEllipse(px(256), py(348), r(134), r(114)), bodyShade);
  c.fill(sdEllipse(px(256), py(266), r(138), r(118)), bodyShade);
  // 奶油色大肚皮
  c.fill(sdEllipse(px(256), py(368), r(94), r(82)), CREAM);

  // 凸起的圆眼：先铺一圈深色边，再压上泛绿的眼白和小黑点瞳孔
  for (const ex of [190, 322]) {
    c.fill(sdCircle(px(ex), py(176), r(61)), mixc(FROG_Y_D, OLIVE, 0.45));
    c.fill(sdCircle(px(ex), py(176), r(56)), SCLERA);
    c.fill(sdCircle(px(ex + 7), py(181), r(15)), PUPIL);
    c.fill(sdCircle(px(ex + 13), py(172), r(6)), WHITE);
  }

  // 大嘴：下半个圆就是一整张嘴，两颗门牙挂在上面
  const mouth = sdIntersect(sdCircle(px(256), py(306), r(80)), (x, y) => py(306) - y);
  c.fill(mouth, MOUTH);
  c.fill(sdEllipse(px(256), py(358), r(38), r(15)), TONGUE, 0.95);
  c.fill(sdRoundRect(px(238), py(320), r(9), r(12), r(4)), WHITE);
  c.fill(sdRoundRect(px(274), py(320), r(9), r(12), r(4)), WHITE);

  // 腮红
  c.fill(sdEllipse(px(148), py(306), r(27), r(16)), BLUSH, 0.5);
  c.fill(sdEllipse(px(364), py(306), r(27), r(16)), BLUSH, 0.5);

  // 右下角捏着一瓶奶
  c.fill(sdRoundRect(px(384), py(392), r(30), r(44), r(19)), WHITE);
  c.fill(
    sdIntersect(
      sdRoundRect(px(384), py(392), r(30), r(44), r(19)),
      sdRoundRect(px(384), py(414), r(34), r(24), r(13)),
    ),
    MILK,
  );
  c.fill(
    sdIntersect(
      sdRoundRect(px(384), py(392), r(30), r(44), r(19)),
      sdRoundRect(px(384), py(394), r(34), r(7), r(4)),
    ),
    BLUE,
  );
  c.fill(sdRoundRect(px(384), py(338), r(15), r(12), r(7)), WHITE);
  c.fill(sdRoundRect(px(384), py(346), r(19), r(6), r(4)), GOLD);
  c.fill(sdRoundRect(px(384), py(324), r(11), r(10), r(6)), ORANGE);

  return encodePng(size, size, c.px);
}


// ------------------------------------------------------------------ 输出

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');
mkdirSync(OUT, { recursive: true });

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];

for (const [name, size, maskable] of jobs) {
  const buf = renderIcon(size, maskable);
  writeFileSync(join(OUT, name), buf);
  console.log(`写入 icons/${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
