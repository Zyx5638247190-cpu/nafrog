// 奶龙合体进化（本作相对 PvZ 的原创机制之一）
//
// 同一种奶龙在同一行上前后撞到一起，会「合体」成多头的巨型形态：
// 体型更大、啃咬翻倍、血量上限变厚。最多合体三层。
//
// 关键设计：合体只把两只**剩余血量相加**，不补血。
// 所以它同时也是一个可以被玩家利用的机制 —— 提前打伤后面那只，
// 合体出来就是一只残血巨兽。要不要让它们合体，是一个真实的取舍。
//
// 纯逻辑，可在 Node 里跑。

import { FUSE, ROWS } from './config.js';

export function fuseScale(def, fuse) {
  return def.scale * (1 + FUSE.scale * fuse);
}

/** 这只奶龙现在能不能参与合体 */
export function canFuse(dragon, waveIndex) {
  if (!dragon || dragon.dead) return false;
  if (dragon.key === 'boss') return false;
  if ((dragon.fuse || 0) >= FUSE.max) return false;
  if (dragon.eating) return false;
  if ((dragon.fuseCd || 0) > 0) return false;
  if ((dragon.age || 0) < FUSE.delay) return false;
  if (waveIndex < (dragon.fuseMinWave ?? 0)) return false;
  return true;
}

/**
 * 把 rear 合进 front（front 是靠左的那只，也就是被追上的那只）。
 * 保留 front 的 id / 位置 / 词缀，数值按两只相加。
 */
export function mergeInto(state, front, rear) {
  const fuse = Math.max(1, Math.min(FUSE.max, (front.fuse || 0) + 1));
  const beforeMax = front.maxHp;
  const hpSum = Math.max(0, front.hp) + Math.max(0, rear.hp);

  front.fuse = fuse;
  front.maxHp = Math.round((front.maxHp + rear.maxHp) * FUSE.hpBonus);
  // 只相加剩余血量，不补血：被提前打伤的奶龙合体出来就是残血
  front.hp = Math.min(front.maxHp, hpSum);
  front.dps = (front.dps + rear.dps) * FUSE.dps;
  front.baseDps = front.dps;
  front.speed = Math.min(front.speed, rear.speed) * FUSE.speed;
  front.baseSpeed = front.speed;
  front.scale = (front.baseScale ?? front.def.scale) * (1 + FUSE.scale * fuse);
  front.baseScale = front.scale;
  front.fuseCd = FUSE.cd;
  front.biteT = 0;
  // 合体后血量上限可能比原来高，护盾按新增的部分补一点，避免「合体反而更脆」
  if (front.shieldMax) {
    front.shieldMax = Math.round(front.maxHp * 0.7);
    front.shield = Math.min(front.shieldMax, front.shield + Math.max(0, front.maxHp - beforeMax) * 0.7);
  }
  rear.dead = true;
  rear.fusedAway = true;
  rear.hp = 0;
  return { fuse, heal: front.hp - hpSum, maxHp: front.maxHp };
}

/**
 * 扫描全场，把能合体的两只合起来。
 * 返回本帧发生的合体事件数组，形如 { front, rear, fuse, key, x, y }。
 */
export function tryFuse(state) {
  const events = [];
  if (!state.env || state.env.fuse === false) return events;
  const wave = state.waveIndex;
  // 每波有合体次数上限：合体是「大事件」，不是常态
  const limit = state.level?.fuse?.perWave ?? 1;
  if ((state.waveFused || 0) >= limit) return events;

  let used = 0;
  for (let row = 0; row < ROWS; row++) {
    if ((state.waveFused || 0) + used >= limit) break;
    // 同一行里没死的奶龙，按 x 从小到大排：越靠左越靠前
    const rowDragons = state.dragons
      .filter((d) => d.row === row && !d.dead)
      .sort((a, b) => a.x - b.x);

    for (let i = 0; i < rowDragons.length - 1; i++) {
      const front = rowDragons[i];
      const rear = rowDragons[i + 1];
      if (front.key !== rear.key) continue;
      if (rear.x - front.x > FUSE.gap) continue;
      if (!canFuse(front, wave) || !canFuse(rear, wave)) continue;

      const info = mergeInto(state, front, rear);
      state.stats.fused = (state.stats.fused || 0) + 1;
      state.waveFused = (state.waveFused || 0) + 1;
      used++;
      events.push({ front, rear, fuse: info.fuse, key: front.key, x: front.x, y: front.y });
      break;
    }
  }
  return events;
}
