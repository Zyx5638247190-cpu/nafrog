// 场景与界面绘制

import {
  AFFIXES,
  CANVAS,
  CARD_ORDER,
  CELL,
  COLS,
  FUSE,
  HUD_H,
  LAWN,
  LAWN_H,
  LAWN_W,
  MOWER_PARK_X,
  PHASES,
  PLANTS,
  RAGE,
  ROWS,
  TIER,
  TILES,
  WEATHERS,
  cellCenter,
  pointToCell,
} from '../core/config.js';
import * as L from '../core/layout.js';
import { LEVELS } from '../core/level.js';
import { statsOf, tileAt, tileDef } from '../core/stats.js';
import { envDetail, envLegend, phaseAmbient, phaseOf, weatherOf } from '../core/weather.js';
import { scoreOf } from '../core/update.js';
import {
  drawBadge,
  drawDragon,
  drawFrog,
  drawMilkBomb,
  drawMilkBottle,
  drawMilkCan,
  drawMilkDrop,
  drawMower,
  drawTileMark,
  ellipse,
  rr,
} from './sprites.js';

const FONT = '"PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif';
const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

const PALETTES = {
  day: {
    skyTop: '#79cdf5',
    skyBot: '#e6f8ff',
    grassA: '#7cc45a',
    grassB: '#93d772',
    grassEdge: '#5fa342',
    hill: '#5aa843',
    hill2: '#7cc45a',
    tint: null,
    sun: '#fff3b0',
  },
  dusk: {
    skyTop: '#f79a4b',
    skyBot: '#ffe3b3',
    grassA: '#679f43',
    grassB: '#7cba55',
    grassEdge: '#4e7f31',
    hill: '#4a7d38',
    hill2: '#649b45',
    tint: 'rgba(255,146,54,0.14)',
    sun: '#ffd27a',
  },
  night: {
    skyTop: '#16233f',
    skyBot: '#2f4c77',
    grassA: '#3d7549',
    grassB: '#4a8a58',
    grassEdge: '#2a5636',
    hill: '#254634',
    hill2: '#2f5741',
    tint: 'rgba(58,88,164,0.26)',
    sun: '#e8f0ff',
  },
};

/** #rrggbb / rgb(...) → [r,g,b] */
function parseColor(c) {
  if (!c) return null;
  if (c.startsWith('rgb')) {
    const m = c.match(/[\d.]+/g);
    return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
  }
  const h = c.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
}

const rgbaStr = (a) => `rgba(${a[0]},${a[1]},${a[2]},${a[3]})`;

function mixColor(ca, cb, k) {
  if (k <= 0) return ca;
  if (k >= 1) return cb;
  if (!ca) return `rgba(${parseColor(cb)[0]},${parseColor(cb)[1]},${parseColor(cb)[2]},${(parseColor(cb)[3] * k).toFixed(3)})`;
  if (!cb) {
    const a = parseColor(ca);
    return `rgba(${a[0]},${a[1]},${a[2]},${(a[3] * (1 - k)).toFixed(3)})`;
  }
  const a = parseColor(ca);
  const b = parseColor(cb);
  const m = [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
  return rgbaStr([m[0], m[1], m[2], a[3] + (b[3] - a[3]) * k]);
}

function mixPalette(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const out = {};
  for (const key of Object.keys(a)) out[key] = mixColor(a[key], b[key], k);
  return out;
}

/**
 * 当前该用哪套配色：跟着昼夜时段走，换天色时做 5 秒渐变。
 * 这也是「一局之内天色会变」这套机制在画面上的体现。
 */
function paletteOf(state) {
  const env = state.env;
  const levelAmbient = (state.level && state.level.ambient) || 'day';
  if (!env) return PALETTES[levelAmbient] || PALETTES.day;
  const now = phaseAmbient(env.phaseIndex) || levelAmbient;
  const to = PALETTES[now] || PALETTES.day;
  if (env.blend >= 1) return to;
  const from = PALETTES[phaseAmbient(env.prevPhaseIndex) || levelAmbient] || to;
  return mixPalette(from, to, Math.max(0, Math.min(1, env.blend)));
}

/** 稳定伪随机（用于装饰） */
const hash = (i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// ------------------------------------------------------------------ 主入口

export function render(ctx, state, view) {
  const pal = paletteOf(state);
  const ambient = state.env ? phaseAmbient(state.env.phaseIndex) : state.level.ambient;
  const t = view.time;

  ctx.save();
  if (state.shake > 0.1) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }

  drawSky(ctx, pal, t, ambient);
  drawHills(ctx, pal, t);
  drawBottomGarden(ctx, pal, t);
  drawRightCave(ctx, pal, t);
  drawHouse(ctx, pal, t);
  drawLawn(ctx, pal);
  drawCellDecor(ctx, pal, t);
  drawTiles(ctx, state, t);

  drawBreachWarning(ctx, state, t);
  drawEntities(ctx, state, view, t);
  drawEffects(ctx, state);

  if (pal.tint) {
    ctx.fillStyle = pal.tint;
    ctx.fillRect(0, HUD_H, CANVAS.w, CANVAS.h - HUD_H);
  }
  // 天气覆盖层：奶雨 / 浓雾 / 狂风（贴在一切实体上面，HUD 下面）
  drawWeather(ctx, state, t);

  ctx.restore();

  drawHUD(ctx, state, view, t);
  drawRageBar(ctx, state, view, t);
  drawUltWave(ctx, state);
  drawTileTip(ctx, state, view);
  drawSelectionGhost(ctx, state, view, t);
  drawBanner(ctx, state, t);
  drawToast(ctx, view, t);
  drawOverlay(ctx, state, view, t);
}

// ------------------------------------------------------------------ 背景

function drawSky(ctx, pal, t, ambient) {
  const g = ctx.createLinearGradient(0, HUD_H, 0, LAWN.y + 120);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, HUD_H, CANVAS.w, CANVAS.h - HUD_H);

  if (ambient === 'night') {
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const x = hash(i) * CANVAS.w;
      const y = HUD_H + hash(i + 50) * 90;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + i));
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(i + 120) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 月亮
    ctx.fillStyle = '#eaf1ff';
    ctx.beginPath();
    ctx.arc(1120, 122, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,200,235,0.55)';
    ctx.beginPath();
    ctx.arc(1108, 112, 7, 0, Math.PI * 2);
    ctx.arc(1132, 134, 5, 0, Math.PI * 2);
    ctx.arc(1124, 104, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const sx = 1210;
    const sy = 128;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 46 + Math.sin(t * 1.4) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // 云
  const cloudCount = 4;
  ctx.save();
  for (let i = 0; i < cloudCount; i++) {
    const speed = 8 + i * 5;
    const x = ((hash(i) * CANVAS.w + t * speed) % (CANVAS.w + 320)) - 160;
    const y = HUD_H + 12 + hash(i + 9) * 22;
    const s = 0.7 + hash(i + 21) * 0.5;
    ctx.globalAlpha = ambient === 'night' ? 0.22 : 0.85;
    ctx.fillStyle = ambient === 'night' ? '#5b7099' : '#ffffff';
    for (const [ox, oy, r] of [[0, 0, 26], [26, 4, 20], [-26, 5, 18], [10, -8, 18]]) {
      ctx.beginPath();
      ctx.arc(x + ox * s, y + oy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHills(ctx, pal, t) {
  ctx.fillStyle = pal.hill;
  ctx.beginPath();
  ctx.moveTo(0, LAWN.y + 6);
  for (let x = 0; x <= CANVAS.w; x += 40) {
    const y = LAWN.y - 4 - Math.sin(x * 0.006 + 1.2) * 18 - Math.sin(x * 0.013) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS.w, LAWN.y + 6);
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = pal.hill2;
  ctx.beginPath();
  ctx.moveTo(0, LAWN.y + 8);
  for (let x = 0; x <= CANVAS.w; x += 40) {
    const y = LAWN.y + 2 - Math.sin(x * 0.009 + 3.4) * 12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS.w, LAWN.y + 8);
  ctx.closePath();
  ctx.fill();
}

function drawLawn(ctx, pal) {
  // 草坪底色
  ctx.fillStyle = pal.grassB;
  ctx.fillRect(LAWN.x, LAWN.y, LAWN_W, LAWN_H);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? pal.grassA : pal.grassB;
      ctx.fillRect(LAWN.x + c * CELL.w, LAWN.y + r * CELL.h, CELL.w, CELL.h);
      // 细草
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#3f7a32';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 5; k++) {
        const id = r * 53 + c * 7 + k;
        const gx = LAWN.x + c * CELL.w + hash(id) * CELL.w;
        const gy = LAWN.y + r * CELL.h + hash(id + 3) * CELL.h;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (hash(id + 5) - 0.5) * 6, gy - 4 - hash(id + 7) * 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 草坪边缘 + 泥土
  ctx.fillStyle = 'rgba(60,90,45,0.35)';
  ctx.fillRect(LAWN.x, LAWN.y - 6, LAWN_W, 6);
  ctx.fillRect(LAWN.x, LAWN.y + LAWN_H, LAWN_W, 8);
}

function drawCellDecor(ctx, pal, t) {
  ctx.save();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * 31 + c * 17;
      if (hash(id + 2) > 0.82) {
        const p = cellCenter(r, c);
        const off = (hash(id) - 0.5) * 60;
        // 小雏菊
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#3f7a32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + off, p.y + 42);
        ctx.lineTo(p.x + off + 2, p.y + 26);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2 + t * 0.2;
          ctx.beginPath();
          ctx.ellipse(p.x + off + 2 + Math.cos(ang) * 4, p.y + 23 + Math.sin(ang) * 4, 3.4, 2.6, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(p.x + off + 2, p.y + 23, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (hash(id + 8) > 0.9) {
        const p = cellCenter(r, c);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(p.x + (hash(id + 11) - 0.5) * 70, p.y + 40, 6, 3.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/**
 * 特殊地块：奶泉地（产奶 +60% / 血量 +25%）和冰晶地（射速 +20% / 奶柱带减速）。
 * 只有把奶蛙种在这种格子上才会吃到加成，是站位的取舍点。
 */
function drawTiles(ctx, state, t) {
  if (!state.tiles || !state.tiles.length) return;
  for (const tile of state.tiles) {
    const x = LAWN.x + tile.col * CELL.w;
    const y = LAWN.y + tile.row * CELL.h;
    const def = tileDef(tile);
    if (!def) continue;
    const cx = x + CELL.w / 2;
    const cy = y + CELL.h / 2;
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (tile.kind === 'spring') {
      const g = ctx.createRadialGradient(cx, cy + 16, 6, cx, cy + 16, CELL.w * 0.5);
      g.addColorStop(0, 'rgba(255,241,180,0.95)');
      g.addColorStop(1, 'rgba(255,214,102,0)');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(cx, cy + 16, 6, cx, cy + 16, CELL.w * 0.5);
      g.addColorStop(0, 'rgba(208,240,255,0.95)');
      g.addColorStop(1, 'rgba(140,210,250,0)');
      ctx.fillStyle = g;
    }
    ctx.fillRect(x + 2, y + 2, CELL.w - 4, CELL.h - 4);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = tile.kind === 'spring' ? 'rgba(255,225,140,0.9)' : 'rgba(190,235,255,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -t * 8;
    rr(ctx, x + 5, y + 5, CELL.w - 10, CELL.h - 10, 12);
    ctx.stroke();
    ctx.restore();
    drawTileMark(ctx, { x: cx, y: cy + 34, kind: tile.kind, t, pulse: tile.pulse || 0 });
  }
}

function drawHouse(ctx, pal, t) {
  const baseY = LAWN.y + LAWN_H;
  const WALL_R = 116;
  ctx.save();

  // 房子主体（外墙板）
  const g = ctx.createLinearGradient(0, 230, 0, baseY);
  g.addColorStop(0, '#fff3e2');
  g.addColorStop(1, '#f2d9bb');
  ctx.fillStyle = g;
  ctx.fillRect(-40, 236, WALL_R + 40, baseY - 236);
  ctx.save();
  ctx.strokeStyle = 'rgba(170,125,80,0.16)';
  ctx.lineWidth = 2;
  for (let y = 252; y < baseY; y += 22) {
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.lineTo(WALL_R, y);
    ctx.stroke();
  }
  ctx.restore();

  // 屋顶
  ctx.fillStyle = '#c8453f';
  ctx.beginPath();
  ctx.moveTo(-48, 268);
  ctx.lineTo(30, 176);
  ctx.lineTo(150, 268);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e4574f';
  ctx.beginPath();
  ctx.moveTo(-48, 268);
  ctx.lineTo(30, 176);
  ctx.lineTo(60, 200);
  ctx.lineTo(-20, 268);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a83a35';
  rr(ctx, -52, 260, 208, 18, 7);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(120,40,36,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const x = -40 + i * 28;
    ctx.beginPath();
    ctx.moveTo(x, 262);
    ctx.lineTo(x + 44, 200);
    ctx.stroke();
  }
  ctx.restore();

  // 烟囱 + 烟
  ctx.fillStyle = '#c96a4a';
  rr(ctx, 84, 186, 34, 58, 5);
  ctx.fill();
  ctx.fillStyle = '#a85336';
  rr(ctx, 79, 179, 44, 13, 4);
  ctx.fill();
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.3 + i * 0.25) % 1;
    ctx.globalAlpha = (1 - k) * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(101 + Math.sin(k * 6 + i) * 12, 172 - k * 66, 7 + k * 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 窗户
  ctx.fillStyle = '#ffffff';
  rr(ctx, 4, 300, 92, 76, 10);
  ctx.fill();
  ctx.fillStyle = '#9ed8f5';
  rr(ctx, 10, 306, 80, 64, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(10, 306);
  ctx.lineTo(52, 306);
  ctx.lineTo(10, 370);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(50, 306);
  ctx.lineTo(50, 370);
  ctx.moveTo(10, 338);
  ctx.lineTo(90, 338);
  ctx.stroke();

  // 挂着的招牌
  ctx.save();
  ctx.strokeStyle = '#8a5a36';
  ctx.lineWidth = 3;
  for (const hx of [18, 82]) {
    ctx.beginPath();
    ctx.moveTo(hx, 386);
    ctx.lineTo(hx, 406);
    ctx.stroke();
  }
  ctx.fillStyle = '#f7e2bd';
  rr(ctx, 4, 406, 92, 56, 8);
  ctx.fill();
  ctx.strokeStyle = '#b98a4e';
  ctx.lineWidth = 3;
  rr(ctx, 4, 406, 92, 56, 8);
  ctx.stroke();
  ctx.fillStyle = '#7a4a2c';
  ctx.font = font(20, 800);
  ctx.textAlign = 'center';
  ctx.fillText('奶蛙基地', 50, 442);
  ctx.restore();

  // 大门
  ctx.fillStyle = '#b8735a';
  rr(ctx, 6, 520, 88, 168, 12);
  ctx.fill();
  ctx.fillStyle = '#a8664f';
  rr(ctx, 14, 530, 72, 158, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, 22, 540, 56, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(80, 612, 5, 0, Math.PI * 2);
  ctx.fill();

  // 门口台阶
  ctx.fillStyle = 'rgba(150,120,90,0.35)';
  rr(ctx, 0, baseY - 26, 100, 12, 4);
  ctx.fill();
  rr(ctx, 8, baseY - 14, 92, 12, 4);
  ctx.fill();

  // 门廊木地板（推车就停在这里）
  const pg = ctx.createLinearGradient(0, LAWN.y, 0, baseY);
  pg.addColorStop(0, '#d8ac74');
  pg.addColorStop(1, '#c1904f');
  ctx.fillStyle = pg;
  ctx.fillRect(WALL_R, LAWN.y - 8, LAWN.x - WALL_R + 4, baseY - LAWN.y + 8);
  ctx.save();
  ctx.strokeStyle = 'rgba(120,80,40,0.28)';
  ctx.lineWidth = 2;
  for (let y = LAWN.y - 8; y < baseY; y += 26) {
    ctx.beginPath();
    ctx.moveTo(WALL_R, y);
    ctx.lineTo(LAWN.x + 4, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(110,72,36,0.35)';
  ctx.fillRect(WALL_R, LAWN.y - 8, 5, baseY - LAWN.y + 8);
  ctx.restore();
  ctx.restore();
}

function drawBottomGarden(ctx, pal, t) {
  const y = LAWN.y + LAWN_H;
  const g = ctx.createLinearGradient(0, y, 0, CANVAS.h);
  g.addColorStop(0, '#6b9b4a');
  g.addColorStop(1, '#3f6b34');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, CANVAS.w, CANVAS.h - y);

  // 花丛
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * CANVAS.w + hash(i) * 30;
    const yy = y + 10 + hash(i + 3) * 22;
    const hue = ['#ff8fbb', '#ffd166', '#ffffff', '#c9a7ff'][Math.floor(hash(i + 7) * 4)];
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.arc(x, yy, 5 + hash(i + 5) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - 1.5, yy - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 木栅栏
  ctx.strokeStyle = '#8a5a36';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, y + 4);
  ctx.lineTo(CANVAS.w, y + 4);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const x = i * 84 + 20;
    ctx.fillStyle = '#a97045';
    rr(ctx, x, y - 16, 12, 34, 3);
    ctx.fill();
    ctx.fillStyle = '#c68a5b';
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 6, y - 26);
    ctx.lineTo(x + 12, y - 16);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRightCave(ctx, pal, t) {
  const x0 = LAWN.x + LAWN_W;
  ctx.save();
  // 石壁
  const g = ctx.createLinearGradient(x0, 0, CANVAS.w, 0);
  g.addColorStop(0, '#8d8b7e');
  g.addColorStop(1, '#6d6a5f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, HUD_H);
  ctx.lineTo(CANVAS.w, HUD_H);
  ctx.lineTo(CANVAS.w, CANVAS.h);
  ctx.lineTo(x0, CANVAS.h);
  ctx.closePath();
  ctx.fill();
  // 洞口
  ctx.fillStyle = 'rgba(20,18,26,0.85)';
  ctx.beginPath();
  ctx.moveTo(x0 + 6, LAWN.y + 40);
  ctx.quadraticCurveTo(x0 + 4, LAWN.y + LAWN_H - 40, x0 + 34, LAWN.y + LAWN_H - 10);
  ctx.lineTo(CANVAS.w, LAWN.y + LAWN_H - 10);
  ctx.lineTo(CANVAS.w, LAWN.y + 40);
  ctx.closePath();
  ctx.fill();
  // 眼睛
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x0 + 26, LAWN.y + 60, 4, 0, Math.PI * 2);
  ctx.arc(x0 + 40, LAWN.y + 58, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 石笋
  ctx.fillStyle = '#7b786c';
  for (let i = 0; i < 4; i++) {
    const sx = x0 + 10 + i * 12;
    const sy = LAWN.y + 40 + i * 130;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 14, sy);
    ctx.lineTo(sx + 7, sy + 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBreachWarning(ctx, state, t) {
  const danger = state.dragons.some((d) => !d.dead && d.x < LAWN.x + 60);
  if (!danger) return;
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 8);
  const g = ctx.createLinearGradient(0, 0, LAWN.x + 120, 0);
  g.addColorStop(0, 'rgba(255,40,40,0.9)');
  g.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, HUD_H, LAWN.x + 120, CANVAS.h - HUD_H);
  ctx.restore();
}

// ------------------------------------------------------------------ 天气

/**
 * 天气覆盖层：奶雨 / 浓雾 / 狂风。
 * 纯画面，数值上的影响在 core/weather.js 里（射程、产奶、移速……）。
 */
function drawWeather(ctx, state, t) {
  const env = state.env;
  if (!env || env.weather === 'clear') return;
  const top = HUD_H;
  const h = CANVAS.h - top;
  const k = Math.min(1, env.blend * 2.5 + 0.55);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, CANVAS.w, h);
  ctx.clip();

  if (env.weather === 'rain') {
    // 斜着的雨丝 + 地面水花
    ctx.globalAlpha = 0.5 * k;
    ctx.strokeStyle = '#dff2ff';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 150; i++) {
      const speed = 620 + hash(i) * 320;
      const x = ((hash(i + 5) * (CANVAS.w + 260) + t * 120) % (CANVAS.w + 260)) - 130;
      const y = ((hash(i + 11) * h + t * speed) % (h + 90)) + top - 45;
      const len = 16 + hash(i + 3) * 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.34, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.16 * k;
    ctx.fillStyle = '#9fd0ee';
    ctx.fillRect(0, top, CANVAS.w, h);
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = '#eaf7ff';
    for (let i = 0; i < 26; i++) {
      const p = (t * 2.2 + hash(i)) % 1;
      const x = hash(i + 40) * CANVAS.w;
      const y = LAWN.y + LAWN_H + 6 + hash(i + 60) * 40;
      ctx.globalAlpha = 0.45 * (1 - p) * k;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + p * 10, 2 + p * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (env.weather === 'fog') {
    // 一层层慢慢飘的雾带 + 整体发白
    ctx.globalAlpha = 0.4 * k;
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, top, CANVAS.w, h);
    for (let i = 0; i < 7; i++) {
      const y = top + 40 + i * 92;
      const off = ((t * (10 + i * 3) + hash(i) * 400) % (CANVAS.w + 620)) - 310;
      const g = ctx.createLinearGradient(off - 240, 0, off + 240, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.4 * k})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(off, y + 20, 260, 56, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (env.weather === 'wind') {
    // 被吹着跑的叶子和速度线
    ctx.globalAlpha = 0.34 * k;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const p = (t * (0.34 + hash(i) * 0.3) + hash(i + 7)) % 1;
      const x = p * (CANVAS.w + 320) - 160;
      const y = top + 30 + hash(i + 21) * (h - 70) + Math.sin(t * 2 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 60 - hash(i + 4) * 90, y + 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9 * k;
    for (let i = 0; i < 22; i++) {
      const p = (t * (0.28 + hash(i) * 0.32) + hash(i + 31)) % 1;
      const x = p * (CANVAS.w + 240) - 120;
      const y = top + 40 + hash(i + 51) * (h - 90);
      const spin = t * 6 + i * 2;
      const hue = ['#ffd166', '#8ee08a', '#c9a7ff', '#ffb6c1'][i % 4];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.fillStyle = hue;
      ctx.globalAlpha = 0.7 * k;
      ellipse(ctx, 0, 0, 8, 4);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 实体

function drawEntities(ctx, state, view, t) {
  for (let row = 0; row < ROWS; row++) {
    const cy = LAWN.y + (row + 0.5) * CELL.h;

    // 推车
    for (const m of state.mowerRuns) {
      if (m.row === row) drawMower(ctx, { x: m.x, y: cy + 34, spin: m.spin });
    }
    if (state.mowers[row] && !state.mowerRuns.some((m) => m.row === row)) {
      drawMower(ctx, { x: MOWER_PARK_X, y: cy + 34, spin: 0 });
    }

    // 奶蛙
    for (const p of state.plants) {
      if (p.row !== row) continue;
      drawPlant(ctx, p, t, state);
    }

    // 奶龙
    const dragons = state.dragons.filter((d) => d.row === row).sort((a, b) => a.x - b.x);
    for (const d of dragons) {
      const def = d.def;
      const scale = d.scale;
      if (scale > 1.3) {
        // boss 在最后画（体积大，让它压住其它）
        continue;
      }
      drawOneDragon(ctx, d, cy, t);
    }
    for (const d of dragons) {
      if (d.scale > 1.3) drawOneDragon(ctx, d, cy, t);
    }

    // 子弹
    for (const s of state.shots) {
      if (s.row !== row) continue;
      drawShot(ctx, s, t);
    }
  }

  // 天上的奶
  for (const d of state.drops) {
    const ice = false;
    ctx.save();
    ctx.globalAlpha = d.phase === 'idle' && d.life < 2.5 ? 0.35 + 0.65 * Math.abs(Math.sin(d.life * 6)) : 1;
    drawMilkDrop(ctx, { x: d.x, y: d.y, t: t + d.spin, scale: d.kind === 'bounty' ? 1.5 : 1 });
    ctx.restore();
    ctx.save();
    ctx.font = font(13, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b6b8f';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(`+${d.amount}`, d.x, d.y + 40);
    ctx.fillText(`+${d.amount}`, d.x, d.y + 40);
    ctx.restore();
  }
}

function drawOneDragon(ctx, d, cy, t) {
  const def = d.def;
  const feet = cy + 46;
  const affix = AFFIXES[d.affix] || null;
  const shieldRatio = d.shieldMax ? Math.max(0, d.shield) / d.shieldMax : 0;

  // 精英词缀：脚下的彩色光环（先画，压在龙下面）
  if (affix) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.18 * Math.sin(t * 3.4 + d.id);
    ctx.strokeStyle = affix.color;
    ctx.lineWidth = 3.4;
    ellipse(ctx, d.x, feet - 4, 34 * d.scale, 13 * d.scale);
    ctx.stroke();
    ctx.restore();
  }

  drawDragon(ctx, {
    x: d.x,
    y: feet,
    scale: d.scale * 1.06,
    t,
    walk: d.walk,
    type: d.key,
    palette: def.palette,
    eating: Boolean(d.eating),
    flash: d.hitFlash,
    slow: d.slowT > 0,
    frost: d.frost || 0,
    freeze: d.freezeT || 0,
    grow: d.grow || 0,
    fuse: d.fuse || 0,
    hpRatio: d.hp / d.maxHp,
    dead: d.dead,
    deathT: d.deathT,
    affix,
    berserk: d.affix === 'berserk' && d.hp / d.maxHp <= (AFFIXES.berserk.hp || 0.4),
    leech: d.leechT > 0,
  });

  if (d.dead) return;

  // 精英「奶盾」：一层奶泡护盾，按剩余比例缩小
  if (d.shield > 0) {
    const sc = d.scale * 1.06;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.22 * shieldRatio;
    const g = ctx.createRadialGradient(d.x, feet - 52 * sc, 10, d.x, feet - 52 * sc, 52 * sc);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.7, 'rgba(150,220,255,0.42)');
    g.addColorStop(1, 'rgba(120,200,255,0.05)');
    ctx.fillStyle = g;
    ellipse(ctx, d.x, feet - 52 * sc, 48 * sc * (0.7 + 0.3 * shieldRatio), 56 * sc * (0.7 + 0.3 * shieldRatio));
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#bfe9ff';
    ctx.lineWidth = 2;
    ellipse(ctx, d.x, feet - 52 * sc, 48 * sc * (0.7 + 0.3 * shieldRatio), 56 * sc * (0.7 + 0.3 * shieldRatio));
    ctx.stroke();
    ctx.restore();
  }

  // 血条（精英的头顶改成词缀标记 + 血条）
  if (d.hp < d.maxHp || d.shield > 0 || affix) {
    const sc = d.scale * 1.06;
    const w = 54 * sc;
    const h = 6;
    const x = d.x - w / 2;
    const y = feet - 124 * sc;
    ctx.save();
    ctx.fillStyle = 'rgba(30,20,20,0.55)';
    rr(ctx, x - 1, y - 1, w + 2, h + 2, 4);
    ctx.fill();
    const k = Math.max(0, d.hp / d.maxHp);
    ctx.fillStyle = k > 0.5 ? '#5fd07a' : k > 0.22 ? '#ffc94d' : '#ff5a5a';
    rr(ctx, x, y, Math.max(2, w * k), h, 3);
    ctx.fill();
    // 护盾条压在血条上面
    if (d.shield > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.95)';
      rr(ctx, x, y - 5, Math.max(2, w * shieldRatio), 4, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      rr(ctx, x, y - 5, w, 4, 2);
      ctx.stroke();
    }
    ctx.restore();

    // 词缀标记：光环 + 一个字
    if (affix) {
      ctx.save();
      const by = y - 16;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(20,26,34,0.72)';
      ctx.beginPath();
      ctx.arc(d.x, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = affix.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(d.x, by, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = affix.color;
      ctx.font = font(13, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(affix.icon, d.x, by + 1);
      ctx.restore();
    }

    // 合体层数：多头标记
    if (d.fuse > 0) {
      drawBadge(ctx, x - 14, y + 3, `×${d.fuse + 1} 头`, 10, 'rgba(201,167,255,0.92)', '#2c1d4a');
    }
  }
}

function drawShot(ctx, s, t) {
  const ice = s.kind === 'ice';
  ctx.save();
  ctx.translate(s.x, s.y + Math.sin(s.wobble) * 2.5);
  ctx.rotate(Math.sin(s.wobble) * 0.12);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 15);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, ice ? '#bde9ff' : '#fdfdff');
  g.addColorStop(1, ice ? 'rgba(140,215,255,0.15)' : 'rgba(240,245,255,0.1)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ice ? '#d6f2ff' : '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, 0, 8, 0, Math.PI * 2);
  ctx.arc(4, 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (ice) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlant(ctx, p, t, state) {
  const def = p.def;
  const st = statsOf(p, tileAt(state, p.row, p.col), state.env);
  const feet = p.y + 40;
  const tierScale = st.scale;
  const scale = tierScale * 1.02 * (1 - (p.pop || 0) * 0.35);
  const firing = st.fire ? p.fireLeft > st.fire.interval - 0.1 : false;
  const tier = st.tier;

  // 顶级奶蛙：脚下金色光环
  if (tier >= TIER.max) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.18 * Math.sin(t * 3 + p.bob);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ellipse(ctx, p.x, feet - 2, 34, 13);
    ctx.stroke();
    ctx.restore();
  }

  // 合成 / 升级闪光
  if (p.mergeFlash > 0) {
    ctx.save();
    ctx.globalAlpha = p.mergeFlash * 0.8;
    const g = ctx.createRadialGradient(p.x, feet - 46, 4, p.x, feet - 46, 62);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, feet - 46, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (def.kind === 'wall') {
    drawMilkCan(ctx, { x: p.x, y: p.y + 46, scale: 1.0 * tierScale, t, hpRatio: p.hp / p.maxHp, phase: p.bob });
    overlayDamage(ctx, p, p.x, p.y - 6, 32, 40);
    drawTierStars(ctx, p, feet, tier);
    return;
  }
  if (def.kind === 'bomb') {
    drawMilkBomb(ctx, {
      x: p.x,
      y: p.y + 40,
      t,
      scale: 1,
      fuseRatio: p.fuse / (st.bomb ? st.bomb.fuse : 1),
    });
    drawTierStars(ctx, p, feet, tier);
    return;
  }

  drawFrog(ctx, {
    x: p.x,
    y: feet,
    t,
    scale,
    kind: def.kind,
    look: def.key,
    tint: def.tint,
    accent: def.accent,
    phase: p.bob,
    pop: p.pop,
    badge: def.key === 'mom' ? 'cow' : undefined,
    firing,
    damage: p.hitFlash,
  });

  if (def.kind === 'producer' && p.produceLeft < 1.1) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(t * 9);
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.arc(p.x, feet - 110, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTierStars(ctx, p, feet, tier);
}

/** 合成等级：头顶星标（1 级不显示） */
function drawTierStars(ctx, p, feet, tier) {
  if (tier < 2) return;
  const y = feet - 132;
  ctx.save();
  ctx.globalAlpha = 0.95;
  drawBadge(ctx, p.x, y, TIER.stars[tier], 13, 'rgba(255,246,214,0.94)', '#b8791a');
  ctx.restore();
}

function overlayDamage(ctx, p, x, y, rx, ry) {
  if (p.hitFlash <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = p.hitFlash * 0.35;
  ctx.fillStyle = '#ff4d4d';
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.restore();
}

function drawEffects(ctx, state) {
  for (const f of state.fx) {
    const k = Math.max(0, f.life / f.maxLife);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k);
    if (f.kind === 'poof') {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (2.4 - k), 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'bubble') {
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (1.8 - k * 0.7), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'shield') {
      ctx.strokeStyle = `rgba(190,235,255,${0.9 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (1.6 - k * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'ice') {
      ctx.fillStyle = `rgba(190,235,255,${k})`;
      ctx.fillRect(f.x, f.y, f.size, f.size);
    } else if (f.kind === 'chomp') {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'dig') {
      ctx.fillStyle = `rgba(150,110,70,${0.8 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ 奶怒技能条

/**
 * 底部技能条：击杀攒「奶怒」，攒满点一下放「奶浪」。
 * 放在屏幕下方中间，手机上拇指够得到。
 */
function drawRageBar(ctx, state, view, t) {
  if (view.screen !== 'playing') return;
  const r = L.RAGE_BAR;
  const k = Math.max(0, Math.min(1, state.rage / RAGE.max));
  const ready = state.rageReady;
  const hovered = view.hover && L.inRect(r, view.hover.x, view.hover.y);

  ctx.save();
  ctx.fillStyle = 'rgba(16,24,32,0.5)';
  rr(ctx, r.x - 8, r.y - 8, r.w + 16, r.h + 16, (r.h + 16) / 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();

  if (k > 0.001) {
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    if (ready) {
      g.addColorStop(0, '#ffd166');
      g.addColorStop(1, '#ff7a45');
    } else {
      g.addColorStop(0, '#9fdcff');
      g.addColorStop(1, '#4fa3e0');
    }
    ctx.fillStyle = g;
    rr(ctx, r.x, r.y, Math.max(r.h, r.w * k), r.h, r.h / 2);
    ctx.fill();
  }

  ctx.strokeStyle = ready ? '#ffd166' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = ready ? 3 : 2;
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.stroke();

  // 就绪时的脉冲光圈
  if (ready) {
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    rr(ctx, r.x - 6 - pulse * 5, r.y - 6 - pulse * 5, r.w + 12 + pulse * 10, r.h + 12 + pulse * 10, (r.h + 12) / 2 + 5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ready) {
    ctx.font = font(21, 900);
    ctx.fillStyle = '#3a2405';
    ctx.fillText(hovered ? '点这里放「奶浪」！' : '奶怒已满 · 点这里放「奶浪」', r.x + r.w / 2, r.y + r.h / 2 + 1);
  } else {
    ctx.font = font(17, 800);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(`奶怒 ${Math.floor(state.rage)} / ${RAGE.max}`, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
  ctx.font = font(11, 700);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('键盘 Q', r.x - 16, r.y + r.h / 2);
  ctx.restore();
}

/** 「奶浪」横扫全场的特效 */
function drawUltWave(ctx, state) {
  if (!state.ultWave || state.ultWave <= 0) return;
  const k = 1 - Math.max(0, Math.min(1, state.ultWave));
  const x = LAWN.x + k * (CANVAS.w - LAWN.x) + 60;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, 1.6 * Math.min(k, 1 - k) + 0.25);
  const g = ctx.createLinearGradient(x - 150, 0, x + 40, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(234,247,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 150, HUD_H, 190, CANVAS.h - HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 7; i++) {
    const yy = HUD_H + 40 + i * 92 + Math.sin(state.time * 6 + i) * 8;
    ctx.beginPath();
    ctx.arc(x + 22, yy, 14 - i * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 鼠标悬停特殊地块时的说明气泡 */
function drawTileTip(ctx, state, view) {
  if (view.screen !== 'playing' || state.paused || state.result || !view.hover) return;
  if (state.selected) return;
  const cell = pointToCell(view.hover.x, view.hover.y);
  if (!cell) return;
  const tile = state.tiles && state.tiles.find((x) => x.row === cell.row && x.col === cell.col);
  if (!tile) return;
  const def = tileDef(tile);
  if (!def) return;
  const text = `${def.name} · ${def.desc}`;
  ctx.save();
  ctx.font = font(14, 700);
  const w = ctx.measureText(text).width + 26;
  const bx = Math.max(10, Math.min(CANVAS.w - w - 10, view.hover.x - w / 2));
  const by = view.hover.y - 52;
  ctx.fillStyle = 'rgba(20,28,36,0.85)';
  rr(ctx, bx, by, w, 32, 8);
  ctx.fill();
  ctx.fillStyle = tile.kind === 'spring' ? '#ffe9a8' : '#d8f2ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + 17);
  ctx.restore();
}


// ------------------------------------------------------------------ HUD

function drawHUD(ctx, state, view, t) {
  ctx.save();
  // 面板
  const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
  g.addColorStop(0, '#fdf7ea');
  g.addColorStop(1, '#eddfc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS.w, HUD_H);
  ctx.fillStyle = 'rgba(160,120,70,0.18)';
  ctx.fillRect(0, HUD_H - 5, CANVAS.w, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(0, 0, CANVAS.w, 2);

  // 奶量
  const mb = L.MILK_BADGE;
  ctx.fillStyle = '#ffffff';
  rr(ctx, mb.x, mb.y, mb.w, mb.h, 14);
  ctx.fill();
  ctx.strokeStyle = '#e3cfa8';
  ctx.lineWidth = 2;
  rr(ctx, mb.x, mb.y, mb.w, mb.h, 14);
  ctx.stroke();
  drawMilkBottle(ctx, mb.x + 34, mb.y + 40, 1.5, 0, {});
  ctx.fillStyle = '#3c4b57';
  ctx.font = font(30, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.min(9999, Math.floor(state.milk))), mb.x + 58, mb.y + 42);
  ctx.font = font(12, 600);
  ctx.fillStyle = '#8b7a5f';
  ctx.fillText('容量上限 9999', mb.x + 14, mb.y + 68);
  ctx.textBaseline = 'alphabetic';

  // 卡片
  CARD_ORDER.forEach((key, i) => {
    const def = PLANTS[key];
    const card = state.cards.find((c) => c.key === key);
    const r = L.cardRect(i);
    const affordable = state.milk >= def.cost;
    const ready = !card || card.cd <= 0;
    const selected = state.selected === key;
    const hovered = view.hover && L.inRect(r, view.hover.x, view.hover.y);

    ctx.save();
    if (selected) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(1.06, 1.06);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    }
    const bgGrad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    bgGrad.addColorStop(0, ready && affordable ? '#ffffff' : '#e8e2d5');
    bgGrad.addColorStop(1, ready && affordable ? '#f2f7f2' : '#d9d2c4');
    ctx.fillStyle = bgGrad;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#f5a623' : hovered && ready && affordable ? '#9fd18b' : '#d8c9aa';
    ctx.lineWidth = selected ? 3.5 : 2;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();

    // 卡面小图
    ctx.save();
    ctx.beginPath();
    rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 9);
    ctx.clip();
    drawCardArt(ctx, key, r.x + r.w / 2, r.y + r.h - 14, t, affordable && ready);
    ctx.restore();

    // 名字
    ctx.fillStyle = '#3c4b57';
    ctx.font = font(11, 700);
    ctx.textAlign = 'center';
    ctx.fillText(def.short, r.x + r.w / 2, r.y + 15);

    // 价格
    ctx.font = font(13, 800);
    ctx.fillStyle = affordable ? '#2f7d4f' : '#c0392b';
    ctx.fillText(String(def.cost), r.x + r.w / 2, r.y + r.h - 4);

    // 冷却
    if (!ready && card) {
      const k = Math.max(0, card.cd / card.cdMax);
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = '#2b3440';
      rr(ctx, r.x + 2, r.y + 2, r.w - 4, (r.h - 4) * k, 9);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = font(20, 800);
      ctx.textAlign = 'center';
      ctx.fillText(ready ? '' : String(Math.ceil(card.cd)), r.x + r.w / 2, r.y + r.h / 2 + 8);
      ctx.restore();
    } else if (!affordable) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = '#3b4756';
      rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 9);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });

  // 右侧按钮
  const icons = {
    pause: (c, r, on) => {
      c.fillStyle = '#3c4b57';
      c.fillRect(r.x + 13, r.y + 11, 5, 18);
      c.fillRect(r.x + 22, r.y + 11, 5, 18);
    },
    speed: (c, r, on) => {
      c.fillStyle = '#3c4b57';
      for (const ox of [8, 19]) {
        c.beginPath();
        c.moveTo(r.x + ox, r.y + 12);
        c.lineTo(r.x + ox + 11, r.y + 20);
        c.lineTo(r.x + ox, r.y + 28);
        c.closePath();
        c.fill();
      }
    },
    sound: (c, r, on) => {
      c.fillStyle = on ? '#3c4b57' : '#9aa7b3';
      c.beginPath();
      c.moveTo(r.x + 13, r.y + 16);
      c.lineTo(r.x + 18, r.y + 16);
      c.lineTo(r.x + 24, r.y + 11);
      c.lineTo(r.x + 24, r.y + 29);
      c.lineTo(r.x + 18, r.y + 24);
      c.lineTo(r.x + 13, r.y + 24);
      c.closePath();
      c.fill();
      c.strokeStyle = on ? '#3c4b57' : '#c8d2db';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r.x + 24, r.y + 20, 6, -0.9, 0.9);
      c.stroke();
      if (!on) {
        c.strokeStyle = '#e4574f';
        c.beginPath();
        c.moveTo(r.x + 12, r.y + 12);
        c.lineTo(r.x + 30, r.y + 28);
        c.stroke();
      }
    },
    auto: (c, r, on) => {
      c.fillStyle = on ? '#3c4b57' : '#9aa7b3';
      c.font = font(19, 800);
      c.textAlign = 'center';
      c.fillText('奶', r.x + r.w / 2, r.y + 28);
    },
    shovel: (c, r, on) => {
      c.strokeStyle = on ? '#3c4b57' : '#9aa7b3';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(r.x + 24, r.y + 10);
      c.lineTo(r.x + 16, r.y + 22);
      c.stroke();
      c.fillStyle = on ? '#3c4b57' : '#9aa7b3';
      c.beginPath();
      c.moveTo(r.x + 10, r.y + 20);
      c.quadraticCurveTo(r.x + 18, r.y + 24, r.x + 16, r.y + 32);
      c.lineTo(r.x + 8, r.y + 30);
      c.closePath();
      c.fill();
    },
    restart: (c, r, on) => {
      c.strokeStyle = '#3c4b57';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(r.x + 20, r.y + 20, 9, 0.6, Math.PI * 1.85);
      c.stroke();
      c.fillStyle = '#3c4b57';
      c.beginPath();
      c.moveTo(r.x + 29, r.y + 12);
      c.lineTo(r.x + 33, r.y + 20);
      c.lineTo(r.x + 24, r.y + 19);
      c.closePath();
      c.fill();
    },
  };
  const labels = { pause: '暂停', speed: '倍速', sound: '音效', auto: '自动收奶', shovel: '铲子', restart: '重来' };

  for (const id of L.BUTTON_IDS) {
    const r = L.buttonRect(id);
    const on =
      id === 'sound' ? view.sound :
      id === 'auto' ? state.autoCollect :
      id === 'shovel' ? state.shovel :
      id === 'pause' ? state.paused :
      true;
    ctx.fillStyle = id === 'speed' && state.speed > 1 ? '#ffe0a3' : '#ffffff';
    if (state.paused && id === 'pause') ctx.fillStyle = '#ffd9a3';
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#d8c9aa';
    ctx.lineWidth = 2;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    icons[id](ctx, r, on);
    ctx.fillStyle = '#7c6a4f';
    ctx.font = font(10, 600);
    ctx.textAlign = 'center';
    ctx.fillText(id === 'speed' ? (state.speed > 1 ? '倍速 ×2' : '倍速 ×1') : labels[id], r.x + r.w / 2, r.y + r.h + 12);
  }

  // 关卡名 + 波次
  const lab = L.LABELS;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7c6a4f';
  ctx.font = font(12, 700);
  ctx.fillText(state.level.name, lab.x + lab.w, lab.y + 16);
  ctx.font = font(14, 800);
  ctx.fillStyle = '#3c4b57';
  const total = state.level.endless ? '∞' : String(state.level.waves.length);
  ctx.fillText(`第 ${Math.max(1, state.waveIndex + 1)} / ${total} 波`, lab.x + lab.w, lab.y + 36);

  // 进度条
  const pr = L.PROGRESS;
  ctx.fillStyle = '#e6dcc6';
  rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2);
  ctx.fill();
  const totalWaves = state.level.waves.length;
  let k = 0;
  if (state.level.endless) {
    k = Math.min(1, (state.waveIndex + 1) / 10);
  } else {
    k = Math.min(1, (state.waveIndex + 1) / Math.max(1, totalWaves));
  }
  if (k > 0.001) {
    const grad = ctx.createLinearGradient(pr.x, 0, pr.x + pr.w, 0);
    grad.addColorStop(0, '#8fd66f');
    grad.addColorStop(1, '#5fb84a');
    ctx.fillStyle = grad;
    rr(ctx, pr.x, pr.y, Math.max(pr.h, pr.w * k), pr.h, pr.h / 2);
    ctx.fill();
  }
  // 旗帜标记（大波）
  if (!state.level.endless) {
    state.level.waves.forEach((w, i) => {
      if (!w.big) return;
      const x = pr.x + (pr.w * (i + 1)) / state.level.waves.length;
      ctx.fillStyle = w.final ? '#e4574f' : '#f5a623';
      ctx.beginPath();
      ctx.moveTo(x, pr.y + 2);
      ctx.lineTo(x + 12, pr.y + 7);
      ctx.lineTo(x, pr.y + 12);
      ctx.closePath();
      ctx.fill();
    });
  }
  // 进度头上的奶龙头
  const hx = pr.x + pr.w * k;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, pr.y + pr.h / 2, pr.h / 2 + 3, 0, Math.PI * 2);
  ctx.clip();
  drawDragon(ctx, {
    x: hx,
    y: pr.y + pr.h / 2 + 22,
    scale: 0.34,
    t,
    walk: t * 6,
    type: 'baby',
    palette: { body: '#f6bc22', dark: '#d0911a', belly: '#fffaea', horn: '#ff9a3c' },
    hpRatio: 1,
  });
  ctx.restore();
  ctx.strokeStyle = '#b9a884';
  ctx.lineWidth = 2;
  rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2);
  ctx.stroke();

  drawEnvBadge(ctx, state, view, t);

  ctx.restore();
}

/**
 * HUD 最下面一条：当前时段 + 天气 + 主要倍率。
 * 点它会在屏幕下方弹一句完整说明（主控里处理）。
 */
function drawEnvBadge(ctx, state, view, t) {
  if (!state.env) return;
  const r = L.ENV_BADGE;
  const phase = phaseOf(state);
  const weather = weatherOf(state);
  const mods = state.env.mods || {};
  const hovered = view.hover && L.inRect(r, view.hover.x, view.hover.y);
  const fuseStage = state.env.fuse;

  ctx.save();
  ctx.fillStyle = hovered ? 'rgba(90,140,90,0.22)' : 'rgba(120,150,110,0.16)';
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = weather.key === 'clear' ? 'rgba(120,140,110,0.55)' : 'rgba(90,150,180,0.75)';
  ctx.lineWidth = 1.4;
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.stroke();

  const pct = (v) => `×${Number((v ?? 1).toFixed(2))}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(11.5, 800);
  ctx.fillStyle = '#4a3c22';
  const main = `${phase.icon} ${phase.name} · ${weather.icon} ${weather.name}`;
  ctx.fillText(main, r.x + 12, r.y + r.h / 2 + 0.5);
  const mainW = ctx.measureText(main).width;

  ctx.font = font(10.5, 600);
  ctx.fillStyle = '#6d6247';
  const bits = [`产奶 ${pct(mods.produce)}`, `射速 ${pct(mods.fire)}`, `射程 ${pct(mods.range)}`, `龙速 ${pct(mods.dragonSpeed)}`];
  ctx.fillText(bits.join('　'), r.x + 12 + mainW + 14, r.y + r.h / 2 + 0.5);

  if (fuseStage) {
    ctx.textAlign = 'right';
    ctx.font = font(10, 700);
    ctx.fillStyle = 'rgba(120,90,150,0.85)';
    ctx.fillText(hovered ? '点这里看说明' : '天气会变', r.x + r.w - 10, r.y + r.h / 2 + 0.5);
  }
  ctx.restore();
}

function drawCardArt(ctx, key, x, y, t, enabled) {
  const def = PLANTS[key];
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.75;
  if (key === 'wall') {
    drawMilkCan(ctx, { x, y: y + 12, scale: 0.72, t, hpRatio: 1 });
  } else if (key === 'bomb') {
    drawMilkBomb(ctx, { x, y: y + 16, scale: 0.66, t, fuseRatio: 0.7 });
  } else {
    drawFrog(ctx, {
      x,
      y: y + 10,
      t,
      scale: 0.62,
      kind: def.kind,
      look: def.key,
      tint: def.tint,
      accent: def.accent,
      phase: hash(key.length) * 6,
      badge: key === 'mom' ? 'cow' : undefined,
    });
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 交互反馈

function drawSelectionGhost(ctx, state, view) {
  if (view.screen !== 'playing' || state.paused || state.result) return;
  const key = state.selected;
  if (!key) return;

  if (view.drag && view.drag.active) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawGhostPlant(ctx, key, view.drag.x, view.drag.y, view.time);
    ctx.restore();
    return;
  }
  if (!view.hover) return;
  const cell = pointToCell(view.hover.x, view.hover.y);
  if (!cell) return;
  const ok = state.milk >= PLANTS[key].cost && !state.plants.some((p) => p.row === cell.row && p.col === cell.col);
  const x = LAWN.x + cell.col * CELL.w;
  const y = LAWN.y + cell.row * CELL.h;
  ctx.save();
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.34)' : 'rgba(255,90,90,0.28)';
  rr(ctx, x + 3, y + 3, CELL.w - 6, CELL.h - 6, 10);
  ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.95)' : 'rgba(255,90,90,0.9)';
  ctx.lineWidth = 3;
  rr(ctx, x + 3, y + 3, CELL.w - 6, CELL.h - 6, 10);
  ctx.stroke();
  ctx.restore();
  if (ok) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawGhostPlant(ctx, key, LAWN.x + (cell.col + 0.5) * CELL.w, LAWN.y + (cell.row + 0.5) * CELL.h, view.time);
    ctx.restore();
  }
}

function drawGhostPlant(ctx, key, x, y, t) {
  const def = PLANTS[key];
  if (key === 'wall') drawMilkCan(ctx, { x, y: y + 46, scale: 1, t, hpRatio: 1 });
  else if (key === 'bomb') drawMilkBomb(ctx, { x, y: y + 40, scale: 1, t, fuseRatio: 1 });
  else
    drawFrog(ctx, {
      x,
      y: y + 40,
      t,
      scale: 0.94,
      kind: def.kind,
      look: def.key,
      tint: def.tint,
      accent: def.accent,
      badge: key === 'mom' ? 'cow' : undefined,
    });
}

const BANNER_TONES = {
  env: { stroke: 'rgba(120,200,255,0.95)', from: '#e8f7ff', to: '#7fc6ef' },
  fuse: { stroke: 'rgba(180,120,255,0.95)', from: '#f3e8ff', to: '#b07ff0' },
  elite: { stroke: 'rgba(255,180,80,0.95)', from: '#fff5d8', to: '#ffa94d' },
  default: { stroke: 'rgba(255,110,80,0.95)', from: '#fff3c4', to: '#ffb648' },
};

function drawBanner(ctx, state, t) {
  if (!state.banner) return;
  const b = state.banner;
  const tone = BANNER_TONES[b.tone] || BANNER_TONES.default;
  const k = Math.min(1, (2.8 - b.t) * 2.2);
  const alpha = Math.min(1, b.t * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  const cy = 230;
  ctx.translate(CANVAS.w / 2, cy);
  const scale = 0.85 + 0.15 * Math.min(1, k * 3) + Math.abs(Math.sin(t * 6)) * 0.02;
  ctx.scale(scale, scale);
  ctx.font = font(b.text.length > 22 ? 32 : 44, 900);
  const textW = Math.max(660, ctx.measureText(b.text).width + 80);
  ctx.fillStyle = 'rgba(20,26,34,0.72)';
  rr(ctx, -textW / 2, -46, textW, 92, 18);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.lineWidth = 8;
  ctx.strokeStyle = tone.stroke;
  ctx.strokeText(b.text, 0, 16);
  const g = ctx.createLinearGradient(0, -30, 0, 30);
  g.addColorStop(0, tone.from);
  g.addColorStop(1, tone.to);
  ctx.fillStyle = g;
  ctx.fillText(b.text, 0, 16);
  ctx.restore();
}

/**
 * 底部提示气泡。
 * 画在 HUD 和草坪之间的那条空白带上：既不会压住草坪上的奶蛙 / 奶龙，
 * 也不会盖住底部的「奶浪」技能条（以前它正好压在技能条上）。
 * 文字太长时自动换行，最多两行。
 */
function drawToast(ctx, view, t) {
  if (!view.toast || view.toast.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, view.toast.t * 3);
  ctx.font = font(17, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxW = CANVAS.w - 260;
  const raw = String(view.toast.text);
  let lines = [raw];
  if (ctx.measureText(raw).width > maxW) {
    // 按宽度切两行：先找到最接近中点、且不切断标点的位置
    let cut = -1;
    for (let i = 1; i < raw.length; i++) {
      if (ctx.measureText(raw.slice(0, i)).width > maxW * 0.55) {
        cut = i;
        break;
      }
    }
    lines = cut > 0 ? [raw.slice(0, cut), raw.slice(cut)] : [raw];
  }

  const lh = 24;
  const boxH = lines.length > 1 ? 58 : 40;
  const boxW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40);
  const cy = HUD_H + 26;
  ctx.fillStyle = 'rgba(24,30,38,0.82)';
  rr(ctx, CANVAS.w / 2 - boxW / 2, cy - boxH / 2, boxW, boxH, 14);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  lines.forEach((l, i) => {
    ctx.fillText(l, CANVAS.w / 2, cy + (i - (lines.length - 1) / 2) * lh);
  });
  ctx.restore();
}

// ------------------------------------------------------------------ 覆盖层

export function overlayModel(state, view) {
  const screen = view.screen;
  if (screen === 'menu') {
    return {
      kind: 'menu',
      buttons: [...L.levelButtonRects(LEVELS.length), L.MENU_START],
      levels: LEVELS,
    };
  }
  if (screen === 'playing' && state.result === 'win') {
    return { kind: 'win', buttons: L.smallPanelButtons(['next', 'retry', 'menu']) };
  }
  if (screen === 'playing' && state.result === 'lose') {
    return { kind: 'lose', buttons: L.smallPanelButtons(['retry', 'menu']) };
  }
  if (screen === 'playing' && state.paused) {
    return { kind: 'pause', buttons: L.smallPanelButtons(['resume', 'retry', 'menu']) };
  }
  return null;
}

function panel(ctx, r, radius = 20) {
  ctx.save();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#f0e2cc');
  ctx.fillStyle = g;
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.strokeStyle = '#c9ae82';
  ctx.lineWidth = 3;
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.stroke();
  ctx.restore();
}

function button(ctx, r, text, opts = {}) {
  ctx.save();
  const primary = opts.primary;
  const disabled = opts.disabled;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (disabled) {
    g.addColorStop(0, '#d9d3c6');
    g.addColorStop(1, '#c6bfae');
  } else if (primary) {
    g.addColorStop(0, '#8fd66f');
    g.addColorStop(1, '#5aa73f');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#efe4cf');
  }
  ctx.fillStyle = g;
  rr(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.strokeStyle = primary ? '#4b8f35' : '#cbb38c';
  ctx.lineWidth = 2.5;
  rr(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.stroke();
  ctx.fillStyle = disabled ? '#8d8677' : primary ? '#ffffff' : '#3c4b57';
  ctx.font = font(opts.size || 22, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
  if (opts.sub) {
    ctx.font = font(12, 600);
    ctx.fillStyle = primary ? 'rgba(255,255,255,0.85)' : '#7c6a4f';
    ctx.fillText(opts.sub, r.x + r.w / 2, r.y + r.h / 2 + 22);
  }
  ctx.restore();
}

/** 菜单里那一行：当前是随机地图 / 固定种子 / 每日挑战 */
function questLine(view) {
  const q = (view && view.quest) || { mode: 'normal' };
  if (q.mode === 'daily') {
    const rec = view.dailyBest && view.dailyBest.date === q.date ? view.dailyBest : null;
    return `📅 每日挑战 ${q.date} · 全世界同一套地图，比一比谁分高${rec ? `（今日最好 ${rec.score} 分）` : ''}`;
  }
  if (q.mode === 'seed') return `🔗 固定种子 #${q.seed} · 谁打开这个链接都是同一局`;
  return '🎲 随机地图 · 每局的地块 / 天气 / 精英都不一样（底部可以开「每日挑战」）';
}

function drawOverlay(ctx, state, view, t) {
  const model = overlayModel(state, view);
  if (!model) return;

  ctx.save();
  ctx.fillStyle = 'rgba(12,18,26,0.62)';
  ctx.fillRect(0, 0, CANVAS.w, CANVAS.h);

  if (model.kind === 'menu') {
    panel(ctx, L.PANEL, 26);
    // 标题
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = font(56, 900);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#8a5a36';
    ctx.strokeText('奶蛙大战奶龙', CANVAS.w / 2, L.PANEL.y + 86);
    const g = ctx.createLinearGradient(0, 20, 0, 100);
    g.addColorStop(0, '#fff6d6');
    g.addColorStop(1, '#ffb648');
    ctx.fillStyle = g;
    ctx.fillText('奶蛙大战奶龙', CANVAS.w / 2, L.PANEL.y + 86);
    ctx.font = font(17, 600);
    ctx.fillStyle = '#7c6a4f';
    ctx.fillText('用奶瓶守住草坪，别让奶龙冲进奶蛙基地 🍼', CANVAS.w / 2, L.PANEL.y + 118);
    ctx.restore();

    // 装饰
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawFrog(ctx, { x: L.PANEL.x + 74, y: L.PANEL.y + 150, t, scale: 1.25, kind: 'shooter', tint: '#dff6ff', accent: '#4fb7e8' });
    drawDragon(ctx, {
      x: L.PANEL.x + L.PANEL.w - 62,
      y: L.PANEL.y + 168,
      scale: 1.15,
      t,
      walk: t * 4,
      type: 'baby',
      palette: { body: '#f6bc22', dark: '#d0911a', belly: '#fffaea', horn: '#ff9a3c' },
      hpRatio: 1,
      eating: false,
    });
    ctx.restore();

    const rects = L.levelButtonRects(model.levels.length);
    rects.forEach((r, i) => {
      const lv = model.levels[i];
      const on = view.levelIndex === i;
      button(ctx, r, lv.name, { primary: on, sub: lv.subtitle, size: 24 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = font(12, 600);
      ctx.fillStyle = on ? 'rgba(255,255,255,0.95)' : '#7c6a4f';
      ctx.fillText(lv.tip, r.x + 18, r.y + r.h - 14);
      if (i === 2) {
        ctx.textAlign = 'right';
        ctx.fillText('无尽', r.x + r.w - 18, r.y + 26);
      }
      ctx.restore();
    });
    button(ctx, L.MENU_START, '开始游戏', { primary: true, size: 26 });

    // 特殊地块图例
    const legendY = L.MENU_START.y + 12;
    const legend = (x, kind) => {
      const def = TILES[kind];
      ctx.save();
      ctx.fillStyle = kind === 'spring' ? 'rgba(255,241,180,0.9)' : 'rgba(208,240,255,0.9)';
      rr(ctx, x, legendY, 168, 42, 10);
      ctx.fill();
      drawTileMark(ctx, { x: x + 24, y: legendY + 26, kind, t, pulse: 0 });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = font(13, 800);
      ctx.fillStyle = '#4b3a1c';
      ctx.fillText(def.name, x + 44, legendY + 15);
      ctx.font = font(10, 600);
      ctx.fillStyle = '#6b5834';
      ctx.fillText(def.desc, x + 44, legendY + 30);
      ctx.restore();
    };
    legend(L.PANEL.x + 22, 'spring');
    legend(L.PANEL.x + L.PANEL.w - 190, 'frost');

    ctx.save();
    ctx.textAlign = 'center';
    const line = (text, y, size = 13, weight = 600, color = '#7c6a4f') => {
      ctx.font = font(size, weight);
      ctx.fillStyle = color;
      ctx.fillText(text, CANVAS.w / 2, y);
    };
    const bottom = L.PANEL.y + L.PANEL.h;
    line('点卡片 → 点草坪下奶蛙；同一格再放同款卡可以「合成升级」，最高 ★★★。击杀攒「奶怒」，满了点底部「奶浪」清屏。', bottom - 104);
    line('键盘：1~7 选卡 · Q 放奶浪 · S 铲子 · 空格暂停　｜　手机：横屏 + 全屏，拇指点草坪即可', bottom - 82, 12, 600, '#9a8a6a');

    // 原创机制图例：昼夜 / 天气 / 精英词缀 / 合体
    const env = envLegend();
    line(`原创机制 · 昼夜循环：${env.phases}（每局约 60 秒一轮，产奶 / 射速 / 龙速跟着变）`, bottom - 58, 13, 700, '#5b7a3f');
    line(`原创机制 · 天气：${env.weathers}（约半分钟随机切换，比如浓雾会砍掉射手 28% 射程）`, bottom - 38, 12.5, 700, '#3f6f8a');
    // 当前是随机地图 / 固定种子 / 每日挑战
    line(questLine(view), bottom - 126, 13.5, 800, '#2f8f7a');

    // 词缀 + 合体徽章
    const badgeY = bottom - 16;
    const affixList = Object.values(AFFIXES);
    const badgeW = 108;
    const totalW = affixList.length * (badgeW + 8) + 8 + 150;
    let bx = CANVAS.w / 2 - totalW / 2;
    for (const a of affixList) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      rr(ctx, bx, badgeY - 13, badgeW, 24, 12);
      ctx.fill();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2;
      rr(ctx, bx, badgeY - 13, badgeW, 24, 12);
      ctx.stroke();
      ctx.font = font(11.5, 800);
      ctx.fillStyle = '#3c4b57';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${a.icon} ${a.name}精英`, bx + 10, badgeY);
      bx += badgeW + 8;
    }
    ctx.fillStyle = 'rgba(201,167,255,0.9)';
    rr(ctx, bx, badgeY - 13, 142, 24, 12);
    ctx.fill();
    ctx.font = font(11.5, 800);
    ctx.fillStyle = '#2c1d4a';
    ctx.fillText(`多头合体（最多 ${FUSE.max + 1} 头）`, bx + 12, badgeY);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
    ctx.restore();
    return;
  }

  panel(ctx, L.SMALL_PANEL, 22);
  const titles = { pause: '暂停中', win: '守住啦！', lose: '防线失守…' };
  const colors = { pause: '#3c4b57', win: '#2f7d4f', lose: '#c0392b' };
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = font(40, 900);
  ctx.fillStyle = colors[model.kind];
  ctx.fillText(titles[model.kind], CANVAS.w / 2, L.SMALL_PANEL.y + 68);
  ctx.font = font(14, 600);
  ctx.fillStyle = '#7c6a4f';
  const s = state.stats;
  const phase = phaseOf(state);
  const weather = weatherOf(state);
  const lines = [];
  if (model.kind === 'pause') {
    lines.push([state.level.name, '#7c6a4f', 14]);
  } else {
    if (state.level.endless) {
      lines.push([`本局分数 ${scoreOf(state)} · 本机最高 ${Math.max(view.best || 0, scoreOf(state))}`, '#2f7d4f', 15]);
    }
    lines.push([
      `击败奶龙 ${s.killed} 只 · 通过 ${Math.max(0, state.waveIndex + 1)} 波 · 收奶 ${s.milkCollected}`,
      '#7c6a4f',
      14,
    ]);
    lines.push([
      `合成 ${s.merged || 0} 次 · 奶浪 ${s.ultimates || 0} 发 · 吞噬成长 ${s.grew || 0} 次 · 分裂 ${s.splits || 0} 次`,
      '#9a8a6a',
      12,
    ]);
    lines.push([
      `精英 ${s.elites || 0} 只 · 合体 ${s.fused || 0} 次 · 收场天色 ${phase.icon}${phase.name} · ${weather.icon}${weather.name}`,
      '#9a8a6a',
      12,
    ]);
  }
  lines.slice(0, 3).forEach(([text, color, size], i) => {
    ctx.font = font(size, i === 0 && model.kind !== 'pause' && state.level.endless ? 800 : 700);
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS.w / 2, L.SMALL_PANEL.y + 96 + i * 22);
  });

  // 固定种子 / 每日挑战：把这一局的编号和当天最好成绩写清楚
  const q = (view && view.quest) || { mode: 'normal' };
  if (q.mode !== 'normal') {
    const rec = view.dailyBest && view.dailyBest.date === q.date ? view.dailyBest : null;
    ctx.font = font(12, 700);
    ctx.fillStyle = '#2f8f7a';
    const text =
      q.mode === 'daily'
        ? `每日挑战 ${q.date} · 今日最好 ${rec ? `${rec.score} 分` : '—'}`
        : `固定种子 #${state.seed} · 同一局`;
    ctx.fillText(text, CANVAS.w / 2, L.SMALL_PANEL.y + L.SMALL_PANEL.h - 14);
  }
  ctx.restore();

  const labels = {
    next: '下一关',
    retry: '再来一次',
    resume: '继续游戏',
    menu: '回到菜单',
  };
  model.buttons.forEach((r) => {
    button(ctx, r, labels[r.id], { primary: r.id === 'next' || r.id === 'resume' });
  });
  ctx.restore();
}
