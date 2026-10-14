// 游戏状态与玩家动作（纯逻辑，可在 Node 里跑）

import {
  PLANTS,
  CARD_ORDER,
  DRAGONS,
  GROW,
  MILK,
  CANVAS,
  ROWS,
  TIER,
  cellCenter,
  pointToCell,
  SPAWN_X,
} from './config.js';
import { LEVELS, makeTiles } from './level.js';
import { maxHpAt, statsOf, tileAt } from './stats.js';
import { initEnv } from './weather.js';
import { applyAffix } from './affix.js';

/** 可复现随机数（mulberry32） */
export function makeRng(seed = 20261013) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_SEED_BASE = 20261013;

/** 把任何输入（URL 参数 / 字符串 / 数字）转成一个可用的 32 位种子 */
export function normalizeSeed(seed, fallback = DEFAULT_SEED_BASE) {
  if (typeof seed === 'string' && /^\d+$/.test(seed.trim())) return (Number(seed.trim()) % 0xffffffff) >>> 0;
  const n = Number(seed);
  if (Number.isFinite(n) && n !== 0) return Math.abs(Math.floor(n)) >>> 0;
  return Math.abs(Math.floor(fallback)) >>> 0;
}

/** 随便一个新种子（每次「重来一次」换一套地形 / 天气 / 精英） */
export function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
}

/**
 * 每日挑战用的种子：直接取当天日期（本地时区）。
 * 同一天里，任何人、任何设备打开都是同一套地形 / 天气 / 精英词缀 / 合体点，
 * 所以可以比分数、可以互相交流打法 —— 这是 PvZ 没有的「同一道题」玩法。
 */
export function dailySeed(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

/** 每日挑战的说明文字（页面工具条 / 菜单共用） */
export function dailyLabel(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const rand = (s, a = 1, b) => (b === undefined ? s.rng() * a : a + s.rng() * (b - a));
export const randInt = (s, a, b) => Math.floor(rand(s, a, b + 1 - 1e-9));
export const pick = (s, arr) => arr[Math.min(arr.length - 1, Math.floor(s.rng() * arr.length))];

export function createState(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  const seed = normalizeSeed(opts.seed, DEFAULT_SEED_BASE + levelIndex * 977);
  const rng = makeRng(seed);
  return {
    levelIndex,
    level,
    rng,
    /** 这一局用的随机种子：地形 / 天气 / 精英词缀 / 合体点全部由它决定 */
    seed,
    time: 0,
    milk: level.startMilk,
    plants: [],
    dragons: [],
    shots: [],
    drops: [],
    fx: [],
    /** 特殊地块（奶泉地 / 冰晶地） */
    tiles: makeTiles(level, rng),
    /** 昼夜 + 天气（全场倍率都从这里取） */
    env: initEnv(level, rng),
    mowers: new Array(ROWS).fill(Boolean(level.mowers)),
    mowerRuns: [],
    cards: CARD_ORDER.map((key) => ({ key, cd: 0, cdMax: PLANTS[key].cd })),
    selected: null,
    shovel: false,
    hover: null,
    waveIndex: -1,
    waveTimer: level.firstDelay,
    skyTimer: MILK.startDelay,
    wavesCleared: 0,
    pending: [],
    banner: null,
    result: null,
    paused: false,
    speed: 1,
    autoCollect: opts.autoCollect ?? true,
    /** 奶怒：攒满可以放一次清场大招 */
    rage: 0,
    rageReady: false,
    rageFlash: 0,
    /** 奶浪横扫特效的剩余时间 */
    ultWave: 0,
    ultimate: { used: 0, lastWave: -1 },
    stats: { killed: 0, planted: 0, milkCollected: 0, wavesCleared: 0, merged: 0, grew: 0, ultimates: 0, freezes: 0, fused: 0, elites: 0, splits: 0 },
    shake: 0,
    hint: opts.hint ?? null,
    nextId: 1,
    totalDragons: 0,
  };
}

/**
 * 重开一局。
 * opts.seed 给了就固定种子（每日挑战 / 分享链接 / 重打同一局），
 * 没给就随机一个新的（普通模式每次重来都换一套地形和天气）。
 */
export function resetState(state, levelIndex = state.levelIndex, opts = {}) {
  const fresh = createState(levelIndex, {
    autoCollect: state.autoCollect,
    seed: opts.seed !== undefined && opts.seed !== null ? opts.seed : randomSeed(),
    hint: opts.hint,
  });
  Object.assign(state, fresh);
  return state;
}

// ------------------------------------------------------------------ 查询

export function plantAt(state, row, col) {
  return state.plants.find((p) => p.row === row && p.col === col) || null;
}

export function cardOf(state, key) {
  return state.cards.find((c) => c.key === key) || null;
}

/** 返回 { ok, reason } */
export function canPlace(state, key, row, col) {
  const def = PLANTS[key];
  if (!def) return { ok: false, reason: '未知的奶蛙' };
  if (state.result) return { ok: false, reason: '本关已结束' };
  if (row == null || col == null) return { ok: false, reason: '放不下' };
  const card = cardOf(state, key);
  if (card && card.cd > 0) return { ok: false, reason: '冷却中' };
  if (plantAt(state, row, col)) return { ok: false, reason: '这格已经有奶蛙了' };
  if (state.milk < def.cost) return { ok: false, reason: '奶不够' };
  return { ok: true, reason: '' };
}

/** 屏幕坐标能不能放 */
export function canPlaceAt(state, key, x, y) {
  const cell = pointToCell(x, y);
  if (!cell) return { ok: false, reason: '只能种在草坪上', cell: null };
  return { ...canPlace(state, key, cell.row, cell.col), cell };
}

// ------------------------------------------------------------------ 动作

export function placePlant(state, key, row, col) {
  const check = canPlace(state, key, row, col);
  if (!check.ok) return { ok: false, reason: check.reason };

  const def = PLANTS[key];
  const pos = cellCenter(row, col);
  const plant = {
    id: state.nextId++,
    key,
    def,
    row,
    col,
    x: pos.x,
    y: pos.y,
    tier: 1,
    hp: def.hp,
    maxHp: def.hp,
    age: 0,
    fireLeft: 0,
    burstLeft: 0,
    burstGap: 0,
    produceLeft: 0,
    fuse: def.bomb ? def.bomb.fuse : 0,
    hitFlash: 0,
    mergeFlash: 0,
    pop: 1,
    bob: rand(state, 0, Math.PI * 2),
    dead: false,
  };

  // 按「等级 + 地块」算最终血量，并让第一次开火/产奶错开节奏
  const st = statsOf(plant, tileAt(state, row, col));
  plant.hp = st.hp;
  plant.maxHp = st.hp;
  plant.fireLeft = st.fire ? st.fire.interval * 0.55 : 0;
  plant.produceLeft = st.produce ? st.produce.interval * 0.5 : 0;

  state.plants.push(plant);
  state.milk -= def.cost;
  const card = cardOf(state, key);
  if (card) card.cd = def.cd;
  state.stats.planted++;
  spawnFx(state, pos.x, pos.y + 18, 'plant', 12);
  return { ok: true, plant, merged: false };
}

// ------------------------------------------------------------------ 合成升级

/** 同一格再放一张同名卡 → 升级（最高 TIER.max 级） */
export function canMerge(state, key, row, col) {
  const def = PLANTS[key];
  if (!def) return { ok: false, reason: '未知的奶蛙' };
  if (state.result) return { ok: false, reason: '本关已结束' };
  const target = plantAt(state, row, col);
  if (!target) return { ok: false, reason: '这格没有奶蛙' };
  if (target.key !== key) return { ok: false, reason: `只能和同款「${def.name}」合成` };
  if ((target.tier || 1) >= TIER.max) return { ok: false, reason: `${def.name} 已经是 ${TIER.max} 级顶配` };
  const card = cardOf(state, key);
  if (card && card.cd > 0) return { ok: false, reason: '冷却中' };
  if (state.milk < def.cost) return { ok: false, reason: '奶不够' };
  return { ok: true, reason: '', target };
}

export function mergePlant(state, key, row, col) {
  const check = canMerge(state, key, row, col);
  if (!check.ok) return { ok: false, reason: check.reason };

  const def = PLANTS[key];
  const p = check.target;
  const beforeMax = p.maxHp;
  p.tier = (p.tier || 1) + 1;
  p.maxHp = maxHpAt(p, p.tier, tileAt(state, row, col));
  // 升级补血：把新增的那部分血量直接补上，不重置已经受的伤
  p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - beforeMax));
  p.pop = 1;
  p.mergeFlash = 1;

  state.milk -= def.cost;
  const card = cardOf(state, key);
  if (card) card.cd = def.cd;
  state.stats.merged++;
  spawnFx(state, p.x, p.y, 'merge', 22);
  return { ok: true, plant: p, tier: p.tier, merged: true };
}

/** 点/拖到草坪的统一入口：空格就种，同款就合成 */
export function placeOrMerge(state, key, row, col) {
  return plantAt(state, row, col) ? mergePlant(state, key, row, col) : placePlant(state, key, row, col);
}

export function shovelAt(state, row, col) {
  const plant = plantAt(state, row, col);
  if (!plant) return { ok: false, reason: '这格没有奶蛙' };
  const idx = state.plants.indexOf(plant);
  if (idx >= 0) state.plants.splice(idx, 1);
  plant.dead = true;
  state.shovel = false;
  state.milk += Math.floor(plant.def.cost * 0.4);
  spawnFx(state, plant.x, plant.y, 'dig', 14);
  return { ok: true };
}

export function selectCard(state, key) {
  if (state.selected === key) {
    state.selected = null;
    state.shovel = false;
    return;
  }
  state.selected = key;
  state.shovel = false;
}

export function selectShovel(state, on = true) {
  state.shovel = on;
  if (on) state.selected = null;
}

/** 点击屏幕：先看掉落物，再看放置 */
export function collectDropAt(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const d of state.drops) {
    if (d.phase === 'fly') continue;
    const dx = d.x - x;
    const dy = d.y - y;
    const dist = dx * dx + dy * dy;
    const r = d.kind === 'sky' ? 46 : 40;
    if (dist < r * r && dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  if (!best) return false;
  best.phase = 'fly';
  best.flyT = 0;
  return true;
}

export function spawnFx(state, x, y, kind, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = rand(state, 0, Math.PI * 2);
    const sp = rand(state, 30, 150);
    state.fx.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - rand(state, 10, 60),
      life: rand(state, 0.35, 0.8),
      maxLife: 0.8,
      size: rand(state, 2.5, 6.5),
      kind,
      color: null,
    });
  }
  if (state.fx.length > 700) state.fx.splice(0, state.fx.length - 700);
}

export function spawnDrop(state, x, y, amount, kind = 'plant') {
  state.drops.push({
    x,
    y,
    amount,
    kind,
    vy: kind === 'sky' ? 62 : -70,
    vx: kind === 'sky' ? 0 : rand(state, -30, 30),
    phase: kind === 'sky' ? 'fall' : 'pop',
    targetY: kind === 'sky' ? rand(state, 180, 686) : y,
    t: 0,
    life: MILK.idleLife,
    flyT: 0,
    autoT: 0,
    spin: rand(state, 0, Math.PI * 2),
  });
}

export function addMilk(state, amount, at) {
  state.milk += amount;
  state.stats.milkCollected += amount;
  if (at) {
    for (let i = 0; i < 6; i++) {
      state.fx.push({
        x: CANVAS.w - 90 + rand(state, -18, 18),
        y: 52 + rand(state, -12, 12),
        vx: rand(state, -40, 40),
        vy: rand(state, -90, -20),
        life: 0.5,
        maxLife: 0.5,
        size: rand(state, 2, 5),
        kind: 'milk',
        color: null,
      });
    }
  }
}

export function addDragon(state, type, row, hpScale = 1, speedScale = 1, opts = {}) {
  const def = DRAGONS[type] || DRAGONS.baby;
  const hp = Math.max(1, Math.round(opts.hp ?? def.hp * hpScale));
  const level = state.level || {};
  const dragon = {
    id: state.nextId++,
    key: type,
    def,
    row,
    x: opts.x ?? SPAWN_X + rand(state, 0, 90),
    y: 0,
    hp,
    maxHp: hp,
    speed: opts.speed ?? def.speed * speedScale,
    dps: def.dps,
    baseSpeed: opts.speed ?? def.speed * speedScale,
    baseDps: def.dps,
    baseScale: def.scale,
    slowFactor: 1,
    slowT: 0,
    /** 吞噬成长层数（吃掉奶蛙变强） */
    grow: 0,
    /** 冰霜叠层，满了就冻结 */
    frost: 0,
    frostT: 0,
    freezeT: 0,
    eating: null,
    biteT: 0,
    walk: rand(state, 0, 10),
    hitFlash: 0,
    scale: def.scale,
    dead: false,
    deathT: 0,
    /** 出生时长：合体要等它先站稳（见 FUSE.delay） */
    age: 0,
    /** 合体层数（0 = 没合体，见 fuse.js） */
    fuse: 0,
    fuseCd: 0,
    fuseMinWave: level.fuse?.minWave ?? 0,
    /** 精英词缀（见 affix.js） */
    affix: null,
    shield: 0,
    shieldMax: 0,
    splitting: false,
    /** 这一只还会不会被算进分数（分裂出来的小龙不计分） */
    scored: opts.scored !== false,
  };
  state.dragons.push(dragon);
  state.totalDragons++;
  if (opts.affix) {
    applyAffix(state, dragon, opts.affix);
    state.stats.elites = (state.stats.elites || 0) + 1;
  }
  return dragon;
}

export function laneHasDragon(state, row, fromX) {
  for (const d of state.dragons) {
    if (d.dead || d.row !== row) continue;
    if (fromX === undefined || d.x > fromX) return true;
  }
  return false;
}

/** 吞噬成长：吃掉一个奶蛙就变大变强一层（最多 GROW.max 层） */
export function growDragon(state, d) {
  if (d.grow >= GROW.max) return false;
  d.grow++;
  const base = d.baseSpeed ?? d.speed;
  const baseDps = d.baseDps ?? d.dps;
  const baseScale = d.baseScale ?? d.scale;
  d.baseSpeed = base;
  d.baseDps = baseDps;
  d.baseScale = baseScale;
  d.maxHp = Math.round(d.maxHp * (1 + GROW.hp));
  d.hp = Math.min(d.maxHp, d.hp + Math.round(d.def.hp * GROW.heal));
  d.speed = base * (1 + GROW.speed * d.grow);
  d.dps = baseDps * (1 + GROW.dps * d.grow);
  d.scale = baseScale * (1 + GROW.scale * d.grow);
  state.stats.grew++;
  return true;
}
