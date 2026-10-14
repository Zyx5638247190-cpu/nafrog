// 有效数值：把「合成等级 + 特殊地块」折算成实际数值
// 纯函数，update / render / AI / 自测共用同一套口径

import { PLANTS, TIER, TILES, FIRE_RANGE } from './config.js';
import { modsOf } from './weather.js';

/** 等级（1..3）转数组下标（0..2） */
export function tierIndex(tier) {
  return Math.max(0, Math.min(TIER.max - 1, (tier || 1) - 1));
}

export function tierStars(tier) {
  return TIER.stars[Math.max(1, Math.min(TIER.max, tier || 1))];
}

export function plantDef(p) {
  return p.def || PLANTS[p.key];
}

/** 这个格子上有没有特殊地块 */
export function tileAt(state, row, col) {
  if (!state || !state.tiles) return null;
  return state.tiles.find((t) => t.row === row && t.col === col) || null;
}

/** 特殊地块的定义（没有就是 null） */
export function tileDef(tile) {
  return tile ? TILES[tile.kind] || null : null;
}

/** 综合算出一个奶蛙的最终数值（天气/昼夜的倍率由 env 传进来） */
export function statsOf(p, tile, env) {
  const def = plantDef(p);
  const i = tierIndex(p.tier);
  const bonus = tileDef(tile);
  const mods = modsOf(env);

  const out = {
    def,
    tier: Math.max(1, Math.min(TIER.max, p.tier || 1)),
    kind: def.kind,
    hp: Math.round(def.hp * TIER.hp[i] * (bonus && bonus.hp ? bonus.hp : 1)),
    scale: TIER.scale[i],
    fire: null,
    produce: null,
    bomb: null,
  };

  if (def.fire) {
    const rate = (bonus && bonus.rate ? bonus.rate : 1) * mods.fire;
    const slowPower = mods.slowPower || 1;
    const baseSlow = def.fire.slow || (bonus && bonus.slow ? bonus.slow : null);
    out.fire = {
      interval: (def.fire.interval * TIER.fireInterval[i]) / rate,
      dmg: def.fire.dmg * TIER.dmg[i] * mods.dmg,
      speed: def.fire.speed * mods.shotSpeed,
      range: (def.fire.range || FIRE_RANGE) * mods.range,
      burst: def.fire.burst || 1,
      lanes: def.fire.lanes || [0],
      // 冰镇蛙自带减速；普通奶蛙站上冰晶地也附带一个弱一点的减速
      // 夜晚（slowPower > 1）会让冰系更黏人
      slow: baseSlow
        ? {
            factor: Math.max(0.15, 1 - (1 - baseSlow.factor) * slowPower),
            duration: baseSlow.duration * (slowPower > 1 ? 1.15 : 1),
          }
        : null,
      kind: def.fire.slow ? 'ice' : bonus && bonus.slow ? 'frost' : 'milk',
    };
  }

  if (def.produce) {
    const mul = (bonus && bonus.produce ? bonus.produce : 1) * mods.produce;
    out.produce = {
      amount: Math.round(def.produce.amount * TIER.produce[i] * mul),
      interval: def.produce.interval * TIER.produceInterval[i],
    };
  }

  if (def.bomb) {
    out.bomb = {
      dmg: def.bomb.dmg * TIER.bombDmg[i],
      radius: def.bomb.radius + TIER.bombRadius[i],
      fuse: def.bomb.fuse,
    };
  }

  return out;
}

/** 升级到 tier 之后的最大血量（合成时用来补血） */
export function maxHpAt(p, tier, tile) {
  const def = plantDef(p);
  const bonus = tileDef(tile);
  return Math.round(def.hp * TIER.hp[tierIndex(tier)] * (bonus && bonus.hp ? bonus.hp : 1));
}
