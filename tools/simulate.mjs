// 用脚本 AI 跑一局，打印逐波战报（用来观察难度曲线）
// 用法: node tools/simulate.mjs [关卡序号 1-3] [最长秒数]

import { createState } from '../src/core/state.js';
import { update, scoreOf } from '../src/core/update.js';
import { LEVELS } from '../src/core/level.js';
import { ROWS } from '../src/core/config.js';
import { playSmart } from './ai.mjs';

const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, Number(process.argv[2] || 1) - 1));
const maxSeconds = Number(process.argv[3] || 900);
const dt = 1 / 60;

const state = createState(levelIndex, { autoCollect: true });
const level = state.level;

console.log(`\n=== ${level.name} ===`);
console.log(`初始奶 ${state.milk}，首波 ${level.firstDelay} 秒后，间隔 ${level.waveGap.join('-')} 秒\n`);

let lastWave = state.waveIndex;
let lastLog = -30;

for (let t = 0; t < maxSeconds && !state.result; t += dt) {
  update(state, dt);
  playSmart(state);

  if (state.waveIndex !== lastWave) {
    lastWave = state.waveIndex;
    const wave = level.endless ? '∞' : `${lastWave + 1}/${level.waves.length}`;
    const mowersLeft = state.mowers.filter(Boolean).length;
    console.log(
      `[${state.time.toFixed(0).padStart(3)}s] 第 ${wave} 波开始  ` +
        `奶 ${String(Math.floor(state.milk)).padStart(4)}  ` +
        `奶蛙 ${String(state.plants.length).padStart(2)}  ` +
        `击杀 ${String(state.stats.killed).padStart(3)}  ` +
        `推车剩 ${mowersLeft}`,
    );
  }

  if (t - lastLog >= 30) {
    lastLog = t;
    const lane = [...Array(ROWS).keys()]
      .map((r) => {
        const inLane = state.dragons.filter((d) => d.row === r && !d.dead);
        return inLane.length ? `${inLane.length}` : '·';
      })
      .join('');
    if (state.dragons.length) {
      console.log(
        `[${state.time.toFixed(0).padStart(3)}s] 场上奶龙 ${state.dragons.length} 行分布 ${lane}  ` +
          `每行最小 x ${Math.min(...state.dragons.map((d) => Math.round(d.x)))}`,
      );
    }
  }
}

console.log('');
console.log(`结果: ${state.result || '未结束'}  用时 ${state.time.toFixed(0)}s`);
console.log(
  `击杀 ${state.stats.killed} / 出场 ${state.totalDragons}，` +
    `种下 ${state.stats.planted} 个奶蛙，收奶 ${state.stats.milkCollected}，` +
    `剩余奶 ${Math.floor(state.milk)}，推车剩 ${state.mowers.filter(Boolean).length}/5`,
);
if (level.endless) console.log(`分数 ${scoreOf(state)}`);
console.log('');
