// 关卡与波次表

import { COLS, ROWS } from './config.js';

/**
 * 单个波次的定义：
 *   { big?: true, spawns: [{ type, count }] }
 * 大波会显示横幅，并额外多刷 40% 的奶龙。
 */
const LEVEL_1_WAVES = [
  { spawns: [{ type: 'baby', count: 1 }] },
  { spawns: [{ type: 'baby', count: 2 }] },
  { spawns: [{ type: 'baby', count: 3 }] },
  { spawns: [{ type: 'baby', count: 2 }, { type: 'cone', count: 1 }] },
  { spawns: [{ type: 'baby', count: 3 }, { type: 'cone', count: 1 }], big: true },
  { spawns: [{ type: 'baby', count: 3 }, { type: 'cone', count: 2 }] },
  { spawns: [{ type: 'baby', count: 2 }, { type: 'fast', count: 2 }, { type: 'cone', count: 1 }] },
  { spawns: [{ type: 'cone', count: 3 }, { type: 'fast', count: 2 }, { type: 'armor', count: 1 }], big: true },
  { spawns: [{ type: 'baby', count: 5 }, { type: 'cone', count: 3 }, { type: 'armor', count: 2 }, { type: 'fast', count: 3 }] },
  { spawns: [{ type: 'boss', count: 1 }, { type: 'cone', count: 4 }, { type: 'armor', count: 2 }], big: true, final: true },
];

const LEVEL_2_WAVES = [
  { spawns: [{ type: 'baby', count: 2 }, { type: 'fast', count: 1 }] },
  { spawns: [{ type: 'baby', count: 3 }, { type: 'cone', count: 1 }] },
  { spawns: [{ type: 'fast', count: 3 }, { type: 'cone', count: 2 }] },
  { spawns: [{ type: 'baby', count: 4 }, { type: 'armor', count: 1 }], big: true },
  { spawns: [{ type: 'cone', count: 3 }, { type: 'fast', count: 3 }] },
  { spawns: [{ type: 'armor', count: 2 }, { type: 'cone', count: 3 }] },
  { spawns: [{ type: 'baby', count: 5 }, { type: 'fast', count: 4 }, { type: 'armor', count: 1 }], big: true },
  { spawns: [{ type: 'cone', count: 4 }, { type: 'armor', count: 2 }, { type: 'fast', count: 4 }] },
  { spawns: [{ type: 'armor', count: 3 }, { type: 'cone', count: 4 }, { type: 'fast', count: 4 }], big: true },
  { spawns: [{ type: 'boss', count: 1 }, { type: 'armor', count: 2 }, { type: 'cone', count: 4 }, { type: 'fast', count: 3 }], big: true },
  { spawns: [{ type: 'boss', count: 1 }, { type: 'armor', count: 3 }, { type: 'cone', count: 5 }, { type: 'fast', count: 4 }], big: true, final: true },
];

export const LEVELS = [
  {
    id: 1,
    name: '第 1 关 · 后院奶场',
    subtitle: '白天 · 微风',
    startMilk: 150,
    firstDelay: 20,
    waveGap: [20, 26],
    hpScale: 1,
    speedScale: 1,
    mowers: true,
    endless: false,
    ambient: 'day',
    /** 特殊地块数量：奶泉地 / 冰晶地 */
    terrain: { spring: 3, frost: 2 },
    /** 昼夜与天气：第 1 关从清晨开始，只有晴 / 奶雨 / 狂风，没有浓雾 */
    env: { startPhase: 0, dayLength: 72, weatherGap: [28, 40], weathers: ['clear', 'rain', 'wind'] },
    /** 精英词缀：第 1 关很晚才出，而且概率低 */
    elite: { minWave: 5, chance: 0.06, ramp: 0.004, max: 0.14, maxPerWave: 1 },
    /** 奶龙合体：教学关不开，先把基础玩法学会 */
    fuse: { enabled: false, minWave: 99 },
    waves: LEVEL_1_WAVES,
    tip: '先在左边几列种「奶牛蛙」攒奶，再用「奶瓶蛙」铺满前后排。',
  },
  {
    id: 2,
    name: '第 2 关 · 奶龙压境',
    subtitle: '黄昏 · 风大',
    startMilk: 200,
    firstDelay: 16,
    waveGap: [18, 23],
    hpScale: 1.1,
    speedScale: 1.06,
    mowers: true,
    endless: false,
    ambient: 'dusk',
    terrain: { spring: 3, frost: 3 },
    /** 第 2 关从黄昏开始，四种天气都会出现 */
    env: { startPhase: 2, dayLength: 64, weatherGap: [22, 32], weathers: ['clear', 'rain', 'fog', 'wind'] },
    elite: { minWave: 4, chance: 0.07, ramp: 0.005, max: 0.16, maxPerWave: 2 },
    fuse: { enabled: true, minWave: 5 },
    waves: LEVEL_2_WAVES,
    tip: '铁盔龙很厚，用「冰镇蛙」拖慢它们，再叠「双管蛙」集火。',
  },
  {
    id: 3,
    name: '第 3 关 · 无尽奶潮',
    subtitle: '夜晚 · 无限',
    startMilk: 250,
    firstDelay: 14,
    waveGap: [13, 17],
    hpScale: 1,
    speedScale: 1,
    mowers: true,
    endless: true,
    ambient: 'night',
    terrain: { spring: 4, frost: 4 },
    /** 第 3 关从夜晚开始，天气换得最快 */
    env: { startPhase: 3, dayLength: 58, weatherGap: [18, 28], weathers: ['clear', 'rain', 'fog', 'wind'] },
    elite: { minWave: 2, chance: 0.08, ramp: 0.005, max: 0.18 },
    fuse: { enabled: true, minWave: 3 },
    waves: [],
    tip: '越往后奶龙越强，活得越久分数越高。',
  },
];

/**
 * 生成特殊地块：随机撒在草坪上，不重叠。
 * 地块是站上去才生效的加成，属于本作相对 PvZ 的创新机制。
 */
export function makeTiles(level, rng) {
  const spec = level.terrain || {};
  const out = [];
  const taken = new Set();
  const place = (kind, n) => {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const row = Math.floor(rng() * ROWS);
        const col = 1 + Math.floor(rng() * (COLS - 2));
        const k = row * COLS + col;
        if (taken.has(k)) continue;
        taken.add(k);
        out.push({ id: out.length + 1, row, col, kind, pulse: rng() * 6.28 });
        break;
      }
    }
  };
  place('spring', spec.spring || 0);
  place('frost', spec.frost || 0);
  return out;
}

/**
 * 无尽模式：随波次渐进增强的程序化波次
 * 因为玩家这边有了合成升级和奶浪，奶龙的成长曲线也要跟着陡起来，
 * 否则后期会变成单方面碾压（每多一波血量线性上涨，数量也跟着涨）。
 */
export function endlessWave(i) {
  const baby = 2 + Math.round(i * 0.45);
  const fast = i >= 2 ? Math.round(1 + i * 0.3) : 0;
  const cone = i >= 1 ? 1 + Math.round(i * 0.32) : 0;
  const armor = i >= 5 ? 1 + Math.round((i - 5) * 0.3) : 0;
  const boss = i >= 8 && (i - 8) % 5 === 0 ? 1 + Math.floor((i - 8) / 15) : 0;
  const spawns = [];
  if (baby) spawns.push({ type: 'baby', count: baby });
  if (cone) spawns.push({ type: 'cone', count: cone });
  if (fast) spawns.push({ type: 'fast', count: fast });
  if (armor) spawns.push({ type: 'armor', count: armor });
  if (boss) spawns.push({ type: 'boss', count: boss });
  return {
    big: i > 0 && i % 4 === 3,
    spawns,
    hpScale: 1 + i * 0.085,
    speedScale: 1 + Math.min(0.42, i * 0.014),
  };
}

/** 取得第 i 个波次（可能为 null 表示该关卡已结束） */
export function waveFor(level, i) {
  if (level.endless) return endlessWave(i);
  return level.waves[i] || null;
}

export function waveCount(level) {
  return level.endless ? Infinity : level.waves.length;
}

/** 该波次是否为大波（需要横幅 / 加速节奏） */
export function isBigWave(level, i) {
  return Boolean(waveFor(level, i)?.big);
}

/** 该波次是否是最后一波 */
export function isFinalWave(level, i) {
  if (level.endless) return false;
  return i === level.waves.length - 1;
}
