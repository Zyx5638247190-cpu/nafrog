// 全局平衡参数与单位定义（纯数据，不含 DOM 依赖）

export const CANVAS = { w: 1280, h: 800 };
export const HUD_H = 104;

export const ROWS = 5;
export const COLS = 9;
export const CELL = { w: 117, h: 112 };
export const LAWN = { x: 172, y: 150 };

/** 草坪总宽度 / 高度（px） */
export const LAWN_W = COLS * CELL.w;
export const LAWN_H = ROWS * CELL.h;

/** 射手的基础射程（px）：超过这个距离的奶龙会被无视 */
export const FIRE_RANGE = 1150;

/** 奶龙出现的位置（屏幕右侧外） */
export const SPAWN_X = CANVAS.w + 40;
/** 越过这条线就算突破防线 */
export const BREACH_X = LAWN.x - 42;
/** 推车（吸奶车）触发线 */
export const MOWER_X = LAWN.x - 18;
/** 推车停放位置 */
export const MOWER_PARK_X = LAWN.x - 26;

export const cellCenter = (row, col) => ({
  x: LAWN.x + (col + 0.5) * CELL.w,
  y: LAWN.y + (row + 0.5) * CELL.h,
});

/** 屏幕坐标 -> 格子，越界返回 null */
export function pointToCell(x, y) {
  const col = Math.floor((x - LAWN.x) / CELL.w);
  const row = Math.floor((y - LAWN.y) / CELL.h);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return { row, col };
}

// ---------------------------------------------------------------- 奶蛙（防守方）

/**
 * kind:
 *   producer 产奶
 *   shooter  射手
 *   wall     肉盾
 *   bomb     一次性范围伤害
 */
export const PLANTS = {
  mom: {
    key: 'mom',
    name: '奶牛蛙',
    short: '奶牛蛙',
    cost: 50,
    cd: 5,
    hp: 300,
    kind: 'producer',
    produce: { amount: 25, interval: 8 },
    tint: '#ffe3ef',
    accent: '#ff8fbb',
    desc: '每 8 秒产出一瓶 25 奶，点了就收。',
  },
  shooter: {
    key: 'shooter',
    name: '奶瓶蛙',
    short: '奶瓶蛙',
    cost: 100,
    cd: 5,
    hp: 300,
    kind: 'shooter',
    fire: { interval: 1.4, dmg: 20, speed: 560, burst: 1 },
    tint: '#d2ecff',
    accent: '#3fa9e0',
    desc: '向右喷射奶柱，单发 20 伤害。',
  },
  wall: {
    key: 'wall',
    name: '奶罐墙',
    short: '奶罐墙',
    cost: 50,
    cd: 20,
    hp: 2000,
    kind: 'wall',
    tint: '#e8eef4',
    accent: '#93a6b8',
    desc: '厚实奶罐，替后排挡下啃咬。',
  },
  ice: {
    key: 'ice',
    name: '冰镇蛙',
    short: '冰镇蛙',
    cost: 175,
    cd: 8,
    hp: 300,
    kind: 'shooter',
    fire: { interval: 1.5, dmg: 20, speed: 560, burst: 1, slow: { factor: 0.45, duration: 3.5 } },
    tint: '#e4f4ff',
    accent: '#7fd4ff',
    desc: '冰奶柱命中后减速奶龙 55%，持续 3.5 秒。',
  },
  repeater: {
    key: 'repeater',
    name: '双管蛙',
    short: '双管蛙',
    cost: 200,
    cd: 8,
    hp: 300,
    kind: 'shooter',
    fire: { interval: 1.4, dmg: 20, speed: 560, burst: 2 },
    tint: '#e2ffe9',
    accent: '#4dc96f',
    desc: '一次连喷两股奶柱。',
  },
  triple: {
    key: 'triple',
    name: '三头蛙',
    short: '三头蛙',
    cost: 325,
    cd: 10,
    hp: 300,
    kind: 'shooter',
    fire: { interval: 1.4, dmg: 20, speed: 560, burst: 1, lanes: [-1, 0, 1] },
    tint: '#f1e6ff',
    accent: '#9b7fe8',
    desc: '同时向自己这一行和上下两行喷奶。',
  },
  bomb: {
    key: 'bomb',
    name: '奶泡炸弹',
    short: '奶泡炸弹',
    cost: 150,
    cd: 25,
    hp: 9999,
    kind: 'bomb',
    bomb: { dmg: 1800, radius: 1.75, fuse: 1.1 },
    tint: '#fff3d6',
    accent: '#ff9d3c',
    desc: '放下 1.1 秒后炸开，范围内奶龙重伤。',
  },
};

/** 卡槽展示顺序 */
export const CARD_ORDER = ['mom', 'shooter', 'wall', 'ice', 'repeater', 'triple', 'bomb'];

// ---------------------------------------------------------------- 奶龙（进攻方）

export const DRAGONS = {
  baby: {
    key: 'baby',
    name: '小奶龙',
    hp: 200,
    speed: 20,
    dps: 100,
    scale: 1,
    palette: { body: '#f6bc22', dark: '#d0911a', belly: '#fffaea', horn: '#ff9a3c' },
    desc: '最常见的奶龙，慢慢悠悠往前挪。',
  },
  fast: {
    key: 'fast',
    name: '冲刺龙',
    hp: 180,
    speed: 46,
    dps: 100,
    scale: 0.92,
    palette: { body: '#ffdb63', dark: '#e0a92c', belly: '#fffdf2', horn: '#ff9a3c' },
    desc: '跑得飞快，但很脆。',
  },
  cone: {
    key: 'cone',
    name: '纸杯龙',
    hp: 560,
    speed: 19,
    dps: 100,
    scale: 1.02,
    palette: { body: '#f0b91f', dark: '#c68614', belly: '#fffaea', horn: '#ff9a3c' },
    desc: '头顶纸杯，多挨几下才倒。',
  },
  armor: {
    key: 'armor',
    name: '铁盔龙',
    hp: 1180,
    speed: 17,
    dps: 200,
    scale: 1.06,
    palette: { body: '#e3a416', dark: '#a86d0b', belly: '#f8f0d6', horn: '#ff9a3c' },
    desc: '顶着铁奶桶，又厚又凶。',
  },
  boss: {
    key: 'boss',
    name: '奶龙王',
    hp: 4200,
    speed: 13,
    dps: 300,
    scale: 1.62,
    palette: { body: '#cf8b12', dark: '#8a5506', belly: '#f5e8c8', horn: '#ff7f3f' },
    desc: '最终 boss，一口能咬碎奶罐。',
  },
};

// ---------------------------------------------------------------- 创新系统

/**
 * 奶蛙合成：在同一格再放一张同名卡就升一级，最高 3 级。
 * 数组下标 0 对应 1 级。
 * 数值刻意压住「滚雪球」：产奶的收益最小，否则经济会指数级失控。
 */
export const TIER = {
  max: 3,
  dmg: [1, 1.45, 1.95],
  fireInterval: [1, 0.9, 0.82],
  hp: [1, 1.55, 2.15],
  produce: [1, 1.3, 1.65],
  produceInterval: [1, 0.94, 0.88],
  bombRadius: [0, 0.3, 0.6],
  bombDmg: [1, 1.3, 1.6],
  scale: [1, 1.09, 1.18],
  stars: ['', '★', '★★', '★★★'],
};

/** 奶怒：击杀积累怒气，攒满可以放一次「奶浪」清场（PvZ 没有主动技能） */
export const RAGE = {
  max: 14,
  perKill: 1,
  perBoss: 4,
  dmg: 320,
  bossFactor: 0.55,
  freeze: 1.1,
  bossFreeze: 0.55,
  shake: 16,
};

/** 奶龙吞噬成长：吃掉一个奶蛙就变强一层（最多 3 层） */
export const GROW = {
  max: 3,
  hp: 0.34,
  heal: 0.32,
  speed: 0.1,
  dps: 0.18,
  scale: 0.17,
};

/** 冰霜叠层：奶柱命中叠加冰霜，叠满 3 层直接冻结 */
export const FROST = { max: 3, freeze: 1.3, decay: 6, slow: { factor: 0.45, duration: 3.5 } };

/** 特殊地块：每关随机撒几块，站上去才有加成 */
export const TILES = {
  spring: {
    key: 'spring',
    name: '奶泉地',
    desc: '产奶 +40% · 奶蛙血量 +20%',
    produce: 1.4,
    hp: 1.2,
  },
  frost: {
    key: 'frost',
    name: '冰晶地',
    desc: '射速 +15% · 奶柱自带减速',
    rate: 1.15,
    slow: { factor: 0.6, duration: 2.2 },
  },
};

export const MOWER = { speed: 620, killRadius: 44 };

// ================================================================ 原创机制
// 下面四套系统（昼夜天气 / 精英词缀 / 奶龙合体 / 已有合成与奶浪）
// 都是《植物大战僵尸》里没有的，专门用来让每一局都不一样。

/**
 * 昼夜循环：一局之内天色会推进，不同时段的数值不一样。
 * ambient 决定画面用哪套配色（白天 / 黄昏 / 夜晚）。
 */
export const PHASES = [
  {
    key: 'dawn',
    name: '清晨',
    icon: '🌅',
    ambient: 'day',
    produce: 1.15,
    fire: 1,
    dmg: 1,
    dragonSpeed: 1,
    slowPower: 1,
    desc: '凉爽的早晨：奶牛蛙产奶 +15%',
  },
  {
    key: 'noon',
    name: '正午',
    icon: '☀️',
    ambient: 'day',
    produce: 1.3,
    fire: 0.95,
    dmg: 1,
    dragonSpeed: 1.08,
    slowPower: 1,
    desc: '日头最毒：产奶 +30%，奶龙移速 +8%',
  },
  {
    key: 'dusk',
    name: '黄昏',
    icon: '🌇',
    ambient: 'dusk',
    produce: 1,
    fire: 1.15,
    dmg: 1.05,
    dragonSpeed: 1,
    slowPower: 1,
    desc: '凉风起：射速 +15%，奶柱伤害 +5%',
  },
  {
    key: 'night',
    name: '夜晚',
    icon: '🌙',
    ambient: 'night',
    produce: 0.7,
    fire: 1,
    dmg: 1.15,
    dragonSpeed: 0.94,
    slowPower: 1.45,
    desc: '入夜：产奶 -30%，但奶柱更痛、冰系减速更强',
  },
];

/**
 * 天气：和昼夜独立，每半分钟左右随机换一次。
 * clear 是基准，其它三种都是明显的取舍（有得必有失）。
 */
export const WEATHERS = {
  clear: {
    key: 'clear',
    name: '晴',
    icon: '🌤️',
    produce: 1,
    fire: 1,
    dmg: 1,
    range: 1,
    dragonSpeed: 1,
    shotSpeed: 1,
    desc: '风和日丽，所有数值正常',
  },
  rain: {
    key: 'rain',
    name: '奶雨',
    icon: '🌧️',
    produce: 1.35,
    fire: 1,
    dmg: 0.88,
    range: 1,
    dragonSpeed: 1,
    shotSpeed: 1,
    desc: '奶牛蛙产奶 +35%，奶柱被雨打散、伤害 -12%',
  },
  fog: {
    key: 'fog',
    name: '浓雾',
    icon: '🌫️',
    produce: 1,
    fire: 0.9,
    dmg: 1,
    range: 0.72,
    dragonSpeed: 1,
    shotSpeed: 1,
    desc: '看不见远处：射手射程 -28%、射速 -10%',
  },
  wind: {
    key: 'wind',
    name: '狂风',
    icon: '🌪️',
    produce: 0.9,
    fire: 1,
    dmg: 1,
    range: 1,
    dragonSpeed: 1.12,
    shotSpeed: 1.25,
    desc: '奶龙被吹着跑：移速 +12%，奶柱飞得更快',
  },
};

/** 天气表顺序（图例 / 随机都按这个顺序） */
export const WEATHER_ORDER = ['clear', 'rain', 'fog', 'wind'];

/**
 * 精英词缀：一部分奶龙会带着词缀出场（头顶有彩色光环 + 一个字）。
 * 词缀之间互相独立随机，同一个词缀只会出现一次。
 */
export const AFFIXES = {
  shield: {
    key: 'shield',
    name: '奶盾',
    icon: '盾',
    color: '#7fd4ff',
    /** 额外护盾 = 最大生命 × 这个系数，护盾没破之前本体不掉血 */
    shield: 0.7,
    desc: '裹着一层奶泡盾，先打破盾才伤到本体',
  },
  berserk: {
    key: 'berserk',
    name: '狂暴',
    icon: '怒',
    color: '#ff6b5c',
    /** 血量低于 hp 比例后变快变凶 */
    hp: 0.4,
    speed: 0.45,
    dps: 0.35,
    desc: '血量低于 40% 后移速 +45%、啃咬 +35%',
  },
  leech: {
    key: 'leech',
    name: '吸血',
    icon: '吸',
    color: '#8ee08a',
    /** 啃咬奶蛙时按伤害的这个比例回血 */
    heal: 0.35,
    desc: '啃奶蛙的时候一边啃一边回血',
  },
  split: {
    key: 'split',
    name: '分裂',
    icon: '裂',
    color: '#c9a7ff',
    count: 2,
    childHp: 0.45,
    desc: '被打倒时分裂成两只小奶龙',
  },
  swift: {
    key: 'swift',
    name: '迅捷',
    icon: '迅',
    color: '#ffd166',
    speed: 0.38,
    scale: 0.86,
    desc: '移速 +38%，体型更小更难打',
  },
};

/** 精英词缀的抽取顺序 */
export const AFFIX_ORDER = ['shield', 'berserk', 'leech', 'split', 'swift'];

/** 精英出现规则：真的会出，但不会铺满全场 */
export const ELITE = { minWave: 4, chance: 0.06, max: 0.16, maxPerWave: 2 };

/**
 * 奶龙合体：同一种奶龙在同一行上撞到一起，会合体成「多头巨型」形态。
 * 关键设计：合体只把两只剩余血量相加，不回血 —— 所以提前打伤一只，合体出来就弱。
 */
export const FUSE = {
  max: 3,
  /** 两只奶龙靠得比这个距离更近就触发合体 */
  gap: 46,
  /** 出生后至少活这么久才允许合体（避免刚出场就叠在一起） */
  delay: 1.4,
  /** 触发过一次合体后的冷却 */
  cd: 1.6,
  /** 合体后血量上限 = 两只上限之和 × 这个系数 */
  hpBonus: 1.06,
  /** 合体后移速 = 两者较慢的那个 × 这个系数 */
  speed: 0.9,
  /** 每合体一层体型 +30% */
  scale: 0.3,
  /** 合体后啃咬 = 两者之和 × 这个系数 */
  dps: 1.05,
  /** 每一波最多合体几次（合体是「大事件」，不是常态） */
  perWave: 1,
};

export const MILK = {
  startDelay: 6,          // 第一个天上掉落的奶
  interval: [7, 11],      // 之后掉落间隔
  amount: 25,
  idleLife: 11,           // 落在地上多久不捡就消失
  flySpeed: 1250,
};
