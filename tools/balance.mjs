// 数值平衡扫描：同一关跑多个随机种子，统计脚本 AI 的胜率和剩余推车。
// 用来回答「新加的天气 / 精英词缀 / 奶龙合体，到底把难度推高了多少」。
//
// 用法:
//   node tools/balance.mjs 2            # 第 2 关，20 个种子，新系统全开
//   node tools/balance.mjs 2 40 off     # 40 个种子，把新系统全部关掉做对照
//   node tools/balance.mjs 3 12         # 无尽模式看能撑到第几波

import { LEVELS } from '../src/core/level.js';
import { createState } from '../src/core/state.js';
import { update } from '../src/core/update.js';
import { playSmart } from './ai.mjs';

const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, Number(process.argv[2] || 2) - 1));
const seeds = Math.max(1, Number(process.argv[3] || 20));
const mode = process.argv[4] || 'on';

if (mode === 'off') {
  const lv = LEVELS[levelIndex];
  lv.env = { startPhase: 0, dayLength: 1e9, weatherGap: [1e9, 1e9], weathers: ['clear'] };
  lv.elite = { minWave: 999, chance: 0, ramp: 0 };
  lv.fuse = { enabled: false, minWave: 999 };
}

const dt = 1 / 60;
const runs = [];

for (let i = 0; i < seeds; i++) {
  const state = createState(levelIndex, { autoCollect: true, seed: 20261013 + i * 7919 });
  const limit = state.level.endless ? 900 : 1200;
  for (let t = 0; t < limit && !state.result; t += dt) {
    update(state, dt);
    playSmart(state);
  }
  runs.push({
    win: state.result === 'win',
    time: state.time,
    wave: state.waveIndex + 1,
    mowers: state.mowers.filter(Boolean).length,
    killed: state.stats.killed,
    elites: state.stats.elites || 0,
    fused: state.stats.fused || 0,
    splits: state.stats.splits || 0,
  });
}

const wins = runs.filter((r) => r.win).length;
const avg = (f) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
const mowersOfWins = runs.filter((r) => r.win).map((r) => r.mowers);
const avgMowers = mowersOfWins.length
  ? (mowersOfWins.reduce((a, b) => a + b, 0) / mowersOfWins.length).toFixed(1)
  : '—';

console.log(`\n=== ${LEVELS[levelIndex].name} · 新系统 ${mode === 'off' ? '关闭（对照）' : '开启'} · ${seeds} 个种子 ===`);
console.log(`胜率 ${wins}/${seeds}（${Math.round((wins / seeds) * 100)}%）`);
if (LEVELS[levelIndex].endless) {
  console.log(`平均撑到第 ${avg((r) => r.wave)} 波，击杀 ${avg((r) => r.killed)}`);
} else {
  console.log(`通关时平均剩余推车 ${avgMowers} / 5`);
}
console.log(`平均出场精英 ${avg((r) => r.elites)}，合体 ${avg((r) => r.fused)}，分裂 ${avg((r) => r.splits)}`);
console.log('');
