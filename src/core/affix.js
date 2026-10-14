// 精英词缀（本作相对 PvZ 的原创机制之一）
//
// 一部分奶龙会带着词缀出场。词缀会让它多一层护盾、血少了变狂暴、
// 啃奶蛙回血、倒下时分裂、或者跑得特别快。头顶的光环 + 一个字就是它的身份证。
//
// 纯逻辑，可在 Node 里跑。

import { AFFIXES, AFFIX_ORDER, ELITE } from './config.js';

export function affixDef(key) {
  return key ? AFFIXES[key] || null : null;
}

export function affixOf(dragon) {
  return affixDef(dragon && dragon.affix);
}

/** 这一关、这一波的精英出现概率（可随波次往上爬，但不超过上限） */
export function eliteChance(level, waveIndex) {
  const spec = (level && level.elite) || ELITE;
  const base = spec.chance ?? 0;
  const min = spec.minWave ?? ELITE.minWave;
  if (waveIndex < min) return 0;
  const ramp = spec.ramp ?? 0;
  const max = spec.max ?? ELITE.max;
  return Math.max(0, Math.min(max, base + ramp * (waveIndex - min)));
}

/**
 * 抽一个词缀，抽不到就返回 null。
 * boss 不带词缀（它已经够难了），分裂出来的小龙也不带（避免无限分裂）。
 */
export function rollAffix(state, level, waveIndex, type, opts = {}) {
  if (opts.noElite) return null;
  if (type === 'boss') return null;
  const chance = eliteChance(level, waveIndex);
  if (chance <= 0 || state.rng() >= chance) return null;
  return AFFIX_ORDER[Math.min(AFFIX_ORDER.length - 1, Math.floor(state.rng() * AFFIX_ORDER.length))];
}

/** 直接把词缀的效果落到奶龙身上 */
export function applyAffix(state, dragon, key) {
  const def = affixDef(key);
  if (!def || !dragon) return null;
  dragon.affix = def.key;

  if (def.shield) {
    dragon.shieldMax = Math.round(dragon.maxHp * def.shield);
    dragon.shield = dragon.shieldMax;
  }
  if (def.speed && !def.hp) {
    // 迅捷：常态就快，而且更小
    dragon.speed = (dragon.baseSpeed ?? dragon.speed) * (1 + def.speed);
    dragon.baseSpeed = dragon.speed;
    if (def.scale) {
      dragon.scale = (dragon.baseScale ?? dragon.scale) * def.scale;
      dragon.baseScale = dragon.scale;
    }
  }
  return def;
}

/** 狂暴：血量低于阈值时额外加成（返回倍率，不是永久改数值） */
export function berserkMult(dragon) {
  const def = affixOf(dragon);
  if (!def || !def.hp) return { speed: 1, dps: 1, on: false };
  const ratio = dragon.maxHp > 0 ? dragon.hp / dragon.maxHp : 1;
  if (ratio > def.hp) return { speed: 1, dps: 1, on: false };
  return { speed: 1 + (def.speed || 0), dps: 1 + (def.dps || 0), on: true };
}

/**
 * 结算一次伤害：护盾先扛。
 * 返回 { hp: 真正打到本体的伤害, shield: 被护盾吃掉的伤害, broke: 是否刚打破护盾 }
 */
export function absorbDamage(dragon, amount) {
  if (!(dragon.shield > 0) || amount <= 0) return { hp: amount, shield: 0, broke: false };
  const absorbed = Math.min(dragon.shield, amount);
  dragon.shield -= absorbed;
  const broke = dragon.shield <= 0 && absorbed > 0;
  return { hp: amount - absorbed, shield: absorbed, broke };
}

/** 吸血：啃咬时按伤害比例回血，返回实际回了多少 */
export function leechHeal(dragon, dealt) {
  const def = affixOf(dragon);
  if (!def || !def.heal || dealt <= 0) return 0;
  if (dragon.hp >= dragon.maxHp) return 0;
  const before = dragon.hp;
  dragon.hp = Math.min(dragon.maxHp, dragon.hp + dealt * def.heal);
  return dragon.hp - before;
}

/** 分裂：倒下时该生出几只、每只多少血 */
export function splitPlan(dragon) {
  const def = affixOf(dragon);
  if (!def || !def.count) return null;
  if (dragon.splitting) return null;
  return { count: def.count, hpRatio: def.childHp ?? 0.45 };
}

/** 词缀图例（菜单 / 结算用） */
export function affixLegend() {
  return AFFIX_ORDER.map((key) => AFFIXES[key]);
}
