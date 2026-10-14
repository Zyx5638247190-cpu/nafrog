// 简单的脚本 AI：既用于自测，也能用来验证数值是否可玩
// 会用上本作的创新机制：合成升级 + 奶怒大招「奶浪」

import { PLANTS, LAWN, ROWS } from '../src/core/config.js';
import { placePlant, plantAt, mergePlant } from '../src/core/state.js';
import { activateUltimate } from '../src/core/update.js';

export function threat(st, row) {
  return st.dragons.reduce((acc, d) => (d.row === row && !d.dead ? acc + d.hp : acc), 0);
}

export function playSmart(st) {
  const milk = st.milk;
  const keyCount = (k) => st.plants.filter((p) => p.key === k).length;
  const rowShooters = (r) => st.plants.filter((p) => p.row === r && p.def.kind === 'shooter').length;
  const rowHasWall = (r) => st.plants.some((p) => p.row === r && p.key === 'wall');
  const alive = st.dragons.filter((d) => !d.dead);

  // 0) 奶怒满了、场上又有几只奶龙，就直接放「奶浪」
  if (st.rageReady && alive.length >= 3) {
    if (activateUltimate(st).ok) return;
  }

  const cardReady = (k) => {
    const card = st.cards.find((c) => c.key === k);
    return !card || card.cd <= 0;
  };

  // 1) 前期先铺奶牛蛙（收入优先，但别把草坪占满）
  if (keyCount('mom') < 7 && milk >= PLANTS.mom.cost) {
    for (const col of [0, 1, 2]) {
      for (let r = 0; r < ROWS; r++) {
        if (!plantAt(st, r, col) && placePlant(st, 'mom', r, col).ok) return;
      }
    }
  }

  // 2) 每行补射手，优先补最少的那一行
  const counts = [...Array(ROWS).keys()].map((r) => rowShooters(r));
  const minRow = counts.indexOf(Math.min(...counts));
  if (counts[minRow] < 5) {
    const want = counts[minRow] < 3 ? 'shooter' : milk >= PLANTS.repeater.cost ? 'repeater' : 'shooter';
    const def = PLANTS[want];
    if (milk >= def.cost) {
      const col = 2 + counts[minRow];
      for (const c of [col, col + 1, col - 1, col + 2]) {
        if (c >= 2 && c <= 7 && !plantAt(st, minRow, c) && placePlant(st, want, minRow, c).ok) return;
      }
    }
  }

  // 3) 有余粮就把主力格合成升级（2 级优先，奶多才冲 3 级）
  for (const plan of [
    { key: 'mom', cols: [0, 1, 2], buf: 40 },
    { key: 'shooter', cols: [2, 3], buf: 40 },
    { key: 'repeater', cols: [4, 3], buf: 120 },
  ]) {
    const def = PLANTS[plan.key];
    const multi = milk >= def.cost * 3 ? 3 : 2;
    if (milk < def.cost + plan.buf || !cardReady(plan.key)) continue;
    for (let r = 0; r < ROWS; r++) {
      for (const c of plan.cols) {
        const p = plantAt(st, r, c);
        if (!p || p.key !== plan.key || (p.tier || 1) >= multi) continue;
        if (mergePlant(st, plan.key, r, c).ok) return;
      }
    }
  }

  // 4) 危险行补冰镇蛙
  const dangerRow = [...Array(ROWS).keys()].sort((a, b) => threat(st, b) - threat(st, a))[0];
  if (threat(st, dangerRow) > 260 && milk >= PLANTS.ice.cost) {
    for (const c of [2, 3, 4, 5]) {
      if (!plantAt(st, dangerRow, c) && placePlant(st, 'ice', dangerRow, c).ok) return;
    }
  }

  // 5) 前排种奶罐（前线吃紧时不惜血本）
  for (let r = 0; r < ROWS; r++) {
    if (rowHasWall(r)) continue;
    const urgent = st.dragons.some((d) => !d.dead && d.row === r && d.x < LAWN.x + 420);
    const need = PLANTS.wall.cost + (urgent ? 20 : 120);
    if (milk >= need && !plantAt(st, r, 7) && placePlant(st, 'wall', r, 7).ok) return;
  }

  // 6) 救急炸弹
  for (let r = 0; r < ROWS; r++) {
    const front = st.dragons.filter((d) => !d.dead && d.row === r && d.x < LAWN.x + 340);
    if (front.length >= 3 && milk >= PLANTS.bomb.cost) {
      const c = front[0].x < LAWN.x + 160 ? 2 : 4;
      if (!plantAt(st, r, c) && placePlant(st, 'bomb', r, c).ok) return;
    }
  }

  // 7) 三头蛙铺前排以外的空格
  if (keyCount('triple') < 4 && milk >= PLANTS.triple.cost + 200) {
    for (const c of [8, 6, 5]) {
      for (let r = 0; r < ROWS; r++) {
        if (!plantAt(st, r, c) && placePlant(st, 'triple', r, c).ok) return;
      }
    }
  }

  // 8) 富余的奶继续堆射手
  if (milk >= PLANTS.repeater.cost + 300) {
    for (const c of [5, 4, 3, 2]) {
      for (let r = 0; r < ROWS; r++) {
        if (!plantAt(st, r, c) && placePlant(st, 'repeater', r, c).ok) return;
      }
    }
  }
}
