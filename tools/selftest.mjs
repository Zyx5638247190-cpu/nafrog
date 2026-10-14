// 无头自测：只依赖纯逻辑层（src/core），在 Node 里跑完整对局
// 用法: node tools/selftest.mjs [--verbose]

import { PLANTS, CARD_ORDER, DRAGONS, ROWS, COLS, CANVAS, HUD_H, CELL, LAWN, LAWN_H, cellCenter, MOWER_X, PHASES, WEATHERS, AFFIXES, FUSE, TILES } from '../src/core/config.js';
import * as L from '../src/core/layout.js';
import { LEVELS, waveFor, endlessWave } from '../src/core/level.js';
import { createState, placePlant, canPlace, cardOf, selectCard, shovelAt, collectDropAt, addDragon, plantAt, dailySeed, normalizeSeed } from '../src/core/state.js';
import { update, scoreOf } from '../src/core/update.js';
import { statsOf } from '../src/core/stats.js';
import { phaseAt, setPhase, setWeather, combineMods } from '../src/core/weather.js';
import { absorbDamage, berserkMult, leechHeal, splitPlan, eliteChance, rollAffix } from '../src/core/affix.js';
import { canFuse } from '../src/core/fuse.js';
import { overlayModel } from '../src/render/draw.js';
import { playSmart, threat } from './ai.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HUD_BOTTOM = HUD_H;
const cardRect = L.cardRect;
const buttonRect = L.buttonRect;
const BUTTON_IDS = L.BUTTON_IDS;

const VERBOSE = process.argv.includes('--verbose');
let pass = 0;
const failures = [];

function check(name, fn) {
  try {
    const info = fn();
    pass++;
    console.log(`  ✓ ${name}${info ? ` — ${info}` : ''}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

function assertFinite(state, msg) {
  const vals = [state.milk, state.time];
  for (const v of vals) assert(Number.isFinite(v), `${msg}: 出现非法数值 ${v}`);
  for (const p of state.plants) assert(Number.isFinite(p.hp) && Number.isFinite(p.x), `${msg}: 奶蛙数值异常`);
  for (const d of state.dragons) assert(Number.isFinite(d.hp) && Number.isFinite(d.x), `${msg}: 奶龙数值异常`);
  for (const s of state.shots) assert(Number.isFinite(s.x), `${msg}: 子弹数值异常`);
}

/** 用固定步长推进模拟 seconds 秒，每 step 调用一次 hook */
function run(state, seconds, hook, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    update(state, dt);
    if (hook) hook(state, i * dt);
    if (state.result) return state.result;
  }
  return state.result;
}

console.log('\n奶蛙大战奶龙 · 无头自测\n');

// ------------------------------------------------------------------ 1. 数据一致性
console.log('[1] 配置数据');

check('卡槽顺序里的每个奶蛙都有定义', () => {
  for (const key of CARD_ORDER) assert(PLANTS[key], `缺少定义: ${key}`);
  return `${CARD_ORDER.length} 张卡`;
});

check('奶蛙字段完整', () => {
  for (const [key, def] of Object.entries(PLANTS)) {
    assert(def.name, `${key} 缺 name`);
    assert(def.cost > 0, `${key} 缺 cost`);
    assert(def.cd > 0, `${key} 缺 cd`);
    assert(def.hp > 0, `${key} 缺 hp`);
    assert(['producer', 'shooter', 'wall', 'bomb'].includes(def.kind), `${key} kind 非法`);
    if (def.kind === 'shooter') assert(def.fire && def.fire.dmg > 0 && def.fire.interval > 0, `${key} 缺开火参数`);
    if (def.kind === 'producer') assert(def.produce.amount > 0, `${key} 缺产奶参数`);
    if (def.kind === 'bomb') assert(def.bomb.dmg > 0 && def.bomb.fuse > 0, `${key} 缺爆炸参数`);
  }
  return `${Object.keys(PLANTS).length} 种奶蛙`;
});

check('所有波次引用的奶龙都存在于 DRAGONS', () => {
  for (const lv of LEVELS) {
    for (const w of lv.waves) {
      for (const s of w.spawns) assert(DRAGONS[s.type], `第 ${lv.id} 关引用了未知奶龙 ${s.type}`);
    }
  }
  for (let i = 0; i < 40; i++) {
    for (const s of endlessWave(i).spawns) assert(DRAGONS[s.type], `无尽第 ${i} 波引用了未知奶龙 ${s.type}`);
  }
  return '全部有效';
});

check('关卡数值合理', () => {
  for (const lv of LEVELS) {
    assert(lv.startMilk >= 100, `${lv.name} 初始奶太少`);
    assert(lv.firstDelay > 0 && lv.firstDelay < 40, `${lv.name} 首波时间异常`);
    assert(Array.isArray(lv.waveGap) && lv.waveGap[0] > 0, `${lv.name} 波次间隔异常`);
    assert(lv.endless || lv.waves.length > 0, `${lv.name} 没有波次表`);
  }
  return `${LEVELS.length} 个关卡`;
});

// ------------------------------------------------------------------ 2. 放置规则
console.log('\n[2] 种植规则');

check('奶不够 / 冷却 / 占位 都会被拦住', () => {
  const s = createState(0);
  s.milk = 0;
  assert(!canPlace(s, 'shooter', 0, 0).ok, '奶不足时不应该能种');
  s.milk = 1000;
  assert(canPlace(s, 'shooter', 0, 0).ok, '条件满足时应该能种');
  placePlant(s, 'shooter', 0, 0);
  assert(s.milk === 900, `扣费错误: ${s.milk}`);
  assert(!canPlace(s, 'shooter', 0, 0).ok, '同一格不应该能重复种');
  assert(!canPlace(s, 'shooter', 0, 1).ok, '冷却中不应该能继续种');
  assert(canPlace(s, 'mom', 0, 1).ok, '不同卡片各自独立冷却');
  assert(!canPlace(s, 'shooter', 0, 9).ok, '越界格子不应该能种');
  return '通过';
});

check('草坪格子坐标正确', () => {
  const p = cellCenter(2, 3);
  assert(p.x > LAWN.x && p.x < CANVAS.w, 'x 越界');
  assert(p.y > 0 && p.y < CANVAS.h, 'y 越界');
  return `行 0..${ROWS - 1} / 列 0..${COLS - 1}`;
});

check('铲子能移除奶蛙并返还一部分奶', () => {
  const s = createState(0);
  s.milk = 1000;
  placePlant(s, 'shooter', 1, 1);
  const before = s.milk;
  const r = shovelAt(s, 1, 1);
  assert(r.ok, '铲除失败');
  assert(s.milk > before, '没有返还奶');
  assert(s.plants.length === 0, '奶蛙没被移除');
  assert(!plantAt(s, 1, 1), '格子没空出来');
  return `返还 ${s.milk - before} 奶`;
});

// ------------------------------------------------------------------ 3. 经济
console.log('\n[3] 奶的经济');

check('奶牛蛙会产奶，自动收集后进入奶量', () => {
  const s = createState(0, { autoCollect: true });
  s.milk = 1000;
  placePlant(s, 'mom', 2, 0);
  run(s, 12);
  assert(s.stats.milkCollected >= 25, `没有收到产出的奶: ${s.stats.milkCollected}`);
  return `12 秒收奶 ${s.stats.milkCollected}`;
});

check('天上会掉奶', () => {
  const s = createState(0, { autoCollect: true });
  run(s, 30);
  assert(s.stats.milkCollected >= 25, `30 秒内天上没掉奶（收到 ${s.stats.milkCollected}）`);
  return `30 秒掉落收入 ${s.stats.milkCollected}`;
});

check('手动点奶瓶可以收奶', () => {
  const s = createState(0, { autoCollect: false });
  run(s, 12);
  const drop = s.drops.find((d) => d.phase === 'idle');
  assert(drop, '没有落地的奶瓶');
  const before = s.milk;
  const hit = collectDropAt(s, drop.x, drop.y);
  assert(hit, '点击没有命中奶瓶');
  run(s, 1);
  assert(s.milk === before + drop.amount, `收奶数值不对: ${s.milk} vs ${before + drop.amount}`);
  return `+${drop.amount}`;
});

// ------------------------------------------------------------------ 4. 战斗
console.log('\n[4] 战斗');

check('奶瓶蛙能打死小奶龙', () => {
  const s = createState(0);
  s.milk = 1000;
  placePlant(s, 'shooter', 2, 0);
  addDragon(s, 'baby', 2);
  run(s, 40);
  assert(s.stats.killed >= 1, '奶龙没被打死');
  return `40 秒击杀 ${s.stats.killed}`;
});

check('冰镇蛙会减速', () => {
  const s = createState(0);
  s.milk = 1000;
  placePlant(s, 'ice', 2, 0);
  const d = addDragon(s, 'baby', 2);
  run(s, 8);
  const target = s.dragons[0];
  assert(target, '奶龙消失了');
  assert(target.slowT > 0, '没有被减速');
  assert(target.slowFactor < 1, '减速系数没生效');
  return `减速到 ${(target.slowFactor * 100).toFixed(0)}%`;
});

check('奶泡炸弹能范围清场', () => {
  const s = createState(0);
  s.milk = 1000;
  for (let r = 0; r < ROWS; r++) addDragon(s, 'baby', r);
  for (const d of s.dragons) d.x = cellCenter(2, 4).x + (d.row - 2) * 10;
  placePlant(s, 'bomb', 2, 4);
  run(s, 2);
  assert(s.plants.every((p) => p.def.kind !== 'bomb'), '炸弹没有消耗掉');
  assert(s.stats.killed >= 3, `炸弹只炸死 ${s.stats.killed} 只，范围不合理`);
  return `炸死 ${s.stats.killed} 只`;
});

check('奶龙会啃掉挡路的奶蛙', () => {
  const s = createState(0);
  s.milk = 1000;
  placePlant(s, 'shooter', 3, 4);
  const d = addDragon(s, 'baby', 3);
  d.x = cellCenter(3, 5).x;
  run(s, 6);
  assert(s.plants.length === 0, '奶蛙没被吃掉');
  assert(s.stats.killed === 0, '奶龙不应该被打死');
  return '啃咬生效';
});

// ------------------------------------------------------------------ 5. 推车与胜负
console.log('\n[5] 推车与胜负');

check('奶龙逼近时推车会启动并清掉这一行', () => {
  const s = createState(0);
  const d = addDragon(s, 'baby', 0);
  d.x = MOWER_X + 10;
  run(s, 5);
  assert(s.mowers[0] === false, '推车没有启动');
  assert(s.stats.killed >= 1, '推车没有清理奶龙');
  return '推车工作正常';
});

check('完全不防守会输', () => {
  const s = createState(0);
  const result = run(s, 600);
  assert(result === 'lose', `期望失败，实际 ${result}`);
  return `${Math.round(s.time)} 秒后失守`;
});

check('脚本 AI 能通关第 1 关（验证数值可玩）', () => {
  const s = createState(0, { autoCollect: true });
  const result = run(s, 900, (st) => playSmart(st));
  assert(result === 'win', `期望通关，实际 ${result}（第 ${s.waveIndex + 1} 波，击杀 ${s.stats.killed}）`);
  return `${Math.round(s.time)} 秒通关 / 击杀 ${s.stats.killed}`;
});

check('无尽模式能持续推进且数值健康', () => {
  const s = createState(2, { autoCollect: true });
  run(s, 420, (st) => playSmart(st));
  assertFinite(s, '无尽');
  assert(s.waveIndex >= 5, `无尽只推进到第 ${s.waveIndex + 1} 波`);
  return `推进到第 ${s.waveIndex + 1} 波，击杀 ${s.stats.killed}，分数 ${scoreOf(s)}`;
});

// ------------------------------------------------------------------ 简化 AI（模拟一个还算聪明的玩家）

// ------------------------------------------------------------------ 6. 界面布局
console.log('\n[6] 界面布局（覆盖层与 HUD 命中区）');

check('菜单覆盖层给出关卡按钮和开始按钮', () => {
  const model = overlayModel(createState(0), { screen: 'menu' });
  assert(model && model.kind === 'menu', '菜单没有返回覆盖层模型');
  const ids = model.buttons.map((b) => b.id);
  assert(ids[0] === 'level-0' && ids[1] === 'level-1' && ids[2] === 'level-2', `关卡按钮缺失: ${ids}`);
  assert(ids.includes('start'), '缺少开始按钮');
  return `${model.buttons.length} 个按钮`;
});

check('菜单按钮互不重叠且都在画布内', () => {
  const model = overlayModel(createState(0), { screen: 'menu' });
  for (const r of model.buttons) {
    assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= CANVAS.w && r.y + r.h <= CANVAS.h, `${r.id} 超出画布`);
  }
  for (let i = 0; i < model.buttons.length; i++) {
    for (let j = i + 1; j < model.buttons.length; j++) {
      const a = model.buttons[i];
      const b = model.buttons[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert(!overlap, `${a.id} 与 ${b.id} 重叠`);
    }
  }
  return '无重叠';
});

check('暂停 / 胜利 / 失败覆盖层按钮正常', () => {
  const win = createState(0);
  win.result = 'win';
  const w = overlayModel(win, { screen: 'playing' });
  assert(w && w.kind === 'win', '胜利没有覆盖层');
  assert(w.buttons.map((b) => b.id).includes('next'), '胜利缺少下一关按钮');
  const lose = createState(0);
  lose.result = 'lose';
  const l = overlayModel(lose, { screen: 'playing' });
  assert(l && l.kind === 'lose', '失败没有覆盖层');
  const pause = createState(0);
  pause.paused = true;
  const p = overlayModel(pause, { screen: 'playing' });
  assert(p && p.kind === 'pause', '暂停没有覆盖层');
  assert(p.buttons.map((b) => b.id).includes('resume'), '暂停缺少继续按钮');
  for (const m of [w, l, p]) {
    for (const r of m.buttons) {
      assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= CANVAS.w && r.y + r.h <= CANVAS.h, `${r.id} 超出画布`);
    }
  }
  return '3 种覆盖层';
});

check('正常对局时没有覆盖层（点击能落到草坪）', () => {
  const s = createState(0);
  assert(overlayModel(s, { screen: 'playing' }) === null, '对局中不应该有覆盖层');
  return '通过';
});

check('HUD 元素不互相遮挡', () => {
  const cards = CARD_ORDER.map((_, i) => cardRect(i));
  for (const r of cards) {
    assert(r.y + r.h <= CANVAS.h, '卡片超出画布');
  }
  for (const id of BUTTON_IDS) {
    const b = buttonRect(id);
    for (const c of cards) {
      const overlap = b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h;
      assert(!overlap, `按钮 ${id} 压住了卡片`);
    }
  }
  // 卡片 / 按钮不能压到草坪第一行
  const topOfLawn = CANVAS.h - 1;
  assert(LAWN.y >= HUD_BOTTOM, `草坪顶部 ${LAWN.y} 应该在 HUD(${HUD_BOTTOM}) 下面`);
  assert(LAWN.y + LAWN_H <= topOfLawn, '草坪底部超出画布');
  assert(LAWN.x + COLS * CELL.w <= CANVAS.w, '草坪右边超出画布');
  return '卡片 7 张 / 按钮 6 个互不遮挡';
});

// ------------------------------------------------------------------ 7. 原创机制
console.log('\n[7] 原创机制（PvZ 没有的东西）');

/** 造一个不会刷奶龙的状态，方便安静地测环境 / 天气 */
function quietState(levelIndex = 0, opts = {}) {
  const s = createState(levelIndex, opts);
  s.waveTimer = 1e9;
  s.pending.length = 0;
  return s;
}

check('昼夜会推进，并且真的改变全场倍率', () => {
  const s = quietState(0);
  const first = s.env.phaseIndex;
  const before = { ...s.env.mods };
  let sawBanner = false;
  run(s, s.env.dayLength + 3, (st) => {
    if (st.banner && st.banner.tone === 'env') sawBanner = true;
  });
  assert(s.env.phaseIndex !== first, '时间过去了，天色没变');
  assert(sawBanner, '换天色时没有给出提示横幅');
  const changed = Object.keys(before).some((k) => before[k] !== s.env.mods[k]);
  assert(changed, '换了天色，倍率却没变');
  return `${PHASES.length} 个时段轮流 · ${PHASES[first].name} → ${PHASES[s.env.phaseIndex].name}`;
});

check('天气会自己换（两分钟至少换一次）', () => {
  const s = quietState(1);
  let changes = 0;
  let last = s.env.weather;
  run(s, 150, (st) => {
    if (st.env.weather !== last) {
      changes++;
      last = st.env.weather;
    }
  });
  assert(changes >= 1, '两分半里天气一次都没换');
  assert(WEATHERS[last], `出现了未知天气 ${last}`);
  return `换了 ${changes} 次 · 现在是「${WEATHERS[last].name}」`;
});

check('天气真的改数值：奶雨多产奶、浓雾砍射程、夜晚少产奶', () => {
  const s = quietState(0);
  s.milk = 9999;
  const shooter = placePlant(s, 'shooter', 2, 0).plant;
  const mom = placePlant(s, 'mom', 3, 0).plant;

  setWeather(s, 'clear');
  const clearRange = statsOf(shooter, null, s.env).fire.range;
  const clearInterval = statsOf(shooter, null, s.env).fire.interval;
  const clearMilk = statsOf(mom, null, s.env).produce.amount;

  setWeather(s, 'fog');
  const fogRange = statsOf(shooter, null, s.env).fire.range;
  const fogInterval = statsOf(shooter, null, s.env).fire.interval;
  assert(fogRange < clearRange, `浓雾没有砍射程：${fogRange} vs ${clearRange}`);
  assert(fogInterval > clearInterval, '浓雾没有降低射速');

  setPhase(s, 'dawn');
  setWeather(s, 'rain');
  const rainMilk = statsOf(mom, null, s.env).produce.amount;
  assert(rainMilk > clearMilk, `奶雨没有多产奶：${rainMilk} vs ${clearMilk}`);

  setPhase(s, 'night');
  setWeather(s, 'clear');
  const nightMilk = statsOf(mom, null, s.env).produce.amount;
  assert(nightMilk < clearMilk, `夜晚没有减产：${nightMilk} vs ${clearMilk}`);

  setPhase(s, 'night');
  const nightSlow = statsOf(shooter, null, s.env);
  setPhase(s, 'dawn');
  assert(nightSlow.fire.interval > 0, '夜晚射速算出来是非法值');
  return `浓雾射程 ${Math.round(clearRange)}→${Math.round(fogRange)} · 奶雨产奶 ${clearMilk}→${rainMilk} · 夜晚 ${nightMilk}`;
});

check('昼夜 × 天气的倍率表本身是完整的', () => {
  for (const phase of PHASES) {
    for (const key of Object.keys(WEATHERS)) {
      const mods = combineMods(phase, key);
      for (const [k, v] of Object.entries(mods)) {
        assert(Number.isFinite(v) && v > 0, `${phase.name} × ${WEATHERS[key].name} 的 ${k} 非法: ${v}`);
      }
    }
  }
  const rain = combineMods(phaseAt(0), 'rain');
  const fog = combineMods(phaseAt(0), 'fog');
  assert(rain.produce > 1 && rain.dmg < 1, '奶雨应该有得有失');
  assert(fog.range < 1, '浓雾应该砍射程');
  return `${PHASES.length} 时段 × ${Object.keys(WEATHERS).length} 天气`;
});

check('精英「奶盾」先吃伤害，盾不破本体不掉血', () => {
  const dummy = { hp: 100, maxHp: 100, shield: 30, shieldMax: 30 };
  const r1 = absorbDamage(dummy, 12);
  assert(r1.hp === 0 && r1.shield === 12, '护盾没有吸收伤害');
  const r2 = absorbDamage(dummy, 30);
  assert(r2.shield === 18 && r2.hp === 12 && r2.broke, '破盾那一击的结算不对');

  const s = createState(0);
  s.milk = 9999;
  placePlant(s, 'shooter', 2, 0);
  const elite = addDragon(s, 'baby', 2, 1, 1, { affix: 'shield' });
  assert(elite.shield > 0, '精英没有拿到护盾');
  let shieldDropped = false;
  let bodyIntact = true;
  run(s, 8, (st) => {
    const d = st.dragons[0];
    if (!d || d.dead) return;
    if (d.shield < d.shieldMax) shieldDropped = true;
    if (d.shield > 0 && d.hp < d.maxHp) bodyIntact = false;
  });
  assert(shieldDropped, '打了 8 秒，护盾没掉');
  assert(bodyIntact, '护盾还在，本体却掉血了');
  return `护盾 ${elite.shieldMax} 点先挡刀`;
});

check('精英「狂暴 / 吸血 / 迅捷」数值生效', () => {
  const calm = { hp: 100, maxHp: 100, affix: 'berserk' };
  assert(!berserkMult(calm).on, '满血就狂暴了');
  const mad = { hp: 30, maxHp: 100, affix: 'berserk' };
  const m = berserkMult(mad);
  assert(m.on && m.speed > 1 && m.dps > 1, '残血没有狂暴加成');
  assert(!berserkMult({ hp: 1, maxHp: 1 }).on, '没有词缀的奶龙不该有加成');

  const leech = { hp: 50, maxHp: 200, affix: 'leech' };
  const healed = leechHeal(leech, 20);
  assert(healed > 0 && leech.hp > 50, '吸血没有回血');
  const full = { hp: 200, maxHp: 200, affix: 'leech' };
  assert(leechHeal(full, 20) === 0, '满血不该继续回血');

  const s = createState(0);
  const swift = addDragon(s, 'baby', 1, 1, 1, { affix: 'swift' });
  const plain = addDragon(s, 'baby', 2);
  assert(swift.speed > plain.speed, '迅捷没有变快');
  assert(swift.scale < plain.scale, '迅捷没有变小');
  assert(!splitPlan(plain), '普通奶龙不该分裂');
  assert(splitPlan({ affix: 'split' }).count === 2, '分裂数量不对');
  return `狂暴 ×${m.speed.toFixed(2)} / 吸血 +${healed} / 迅捷 ×${(swift.speed / plain.speed).toFixed(2)}`;
});

check('精英「分裂」：倒下变两只，且不计分也不再分裂', () => {
  const s = createState(0);
  s.milk = 9999;
  const elite = addDragon(s, 'baby', 2, 1, 1, { affix: 'split' });
  elite.x = cellCenter(2, 5).x;
  placePlant(s, 'bomb', 2, 5);
  run(s, 2.5);
  const alive = s.dragons.filter((d) => !d.dead);
  assert(s.stats.splits === 1, `分裂次数不对: ${s.stats.splits}`);
  assert(alive.length === 2, `分裂出 ${alive.length} 只，应该是 2 只`);
  assert(alive.every((d) => d.scored === false), '分裂出来的小龙不该计分');
  assert(alive.every((d) => !d.affix), '分裂出来的小龙不该带词缀');
  assert(s.stats.killed === 1, `只该算本体那一次击杀，实际 ${s.stats.killed}`);
  return `血量 ${alive.map((d) => d.hp).join(' / ')}`;
});

check('精英抽取规则：晚波才出、有概率上限、boss 不带词缀', () => {
  const level = LEVELS[1];
  assert(eliteChance(level, 0) === 0, '第一波就出精英了');
  assert(eliteChance(level, level.elite.minWave) > 0, `第 ${level.elite.minWave} 波应该开始出精英`);
  const capped = eliteChance(level, 999);
  assert(capped <= level.elite.max, `精英概率超过上限: ${capped} > ${level.elite.max}`);
  const s = createState(0);
  assert(rollAffix(s, LEVELS[0], 20, 'boss') === null, 'boss 不该带词缀');
  assert(rollAffix(s, LEVELS[0], 0, 'baby') === null, '第 1 波不该出精英');
  return `第 ${level.elite.minWave} 波起，最高 ${(level.elite.max * 100).toFixed(0)}%`;
});

check('奶龙合体：血量相加不补血，一回合一波只合一次', () => {
  const s = quietState(1); // 第 2 关：合体开启
  s.waveIndex = 6;
  const front = addDragon(s, 'baby', 2, 1, 1, { x: 900, hp: 200 });
  const rear = addDragon(s, 'baby', 2, 1, 1, { x: 930, hp: 200 });
  front.hp = 60;
  rear.hp = 60;
  const biteBefore = front.dps;
  run(s, 3);
  assert(s.stats.fused === 1, `合体次数不对: ${s.stats.fused}`);
  const big = s.dragons.filter((d) => !d.dead);
  assert(big.length === 1, '合体后应该只剩一只');
  assert(big[0].fuse === 1, '合体层数不对');
  assert(big[0].hp <= 120 && big[0].hp >= 100, `合体补血了: ${big[0].hp}`);
  assert(big[0].maxHp > 200, '合体后血量上限没有变厚');
  assert(big[0].dps > biteBefore, '合体后啃咬没有变强');
  assert(big[0].scale > DRAGONS.baby.scale, '合体后体型没有变大');

  // 同一波里再挤两只，不该再合（合体是「大事件」）
  addDragon(s, 'baby', 4, 1, 1, { x: 900 });
  addDragon(s, 'baby', 4, 1, 1, { x: 930 });
  run(s, 3);
  assert(s.stats.fused === 1, '一波里合体了不止一次');
  return `残血合体 ${big[0].hp}/${big[0].maxHp} · 一波 ${FUSE.perWave} 次`;
});

check('第 1 关不开合体（教学关先把基础玩法学会）', () => {
  const s = quietState(0);
  s.waveIndex = 6;
  addDragon(s, 'baby', 2, 1, 1, { x: 900 });
  addDragon(s, 'baby', 2, 1, 1, { x: 930 });
  run(s, 3);
  assert(s.stats.fused === 0, '第 1 关不应该合体');
  const d = createState(0);
  assert(d.env.fuse === false, '第 1 关 env.fuse 应该是关的');
  assert(!canFuse({ age: 99, fuseCd: 0, fuse: 0, key: 'baby', fuseMinWave: 99 }, 6), 'minWave 没拦住');
  return '第 1 关安全';
});

check('同一个种子 = 同一局（每日挑战 / 分享链接的基础）', () => {
  const a = quietState(1, { seed: 123456 });
  const b = quietState(1, { seed: 123456 });
  const shape = (st) => JSON.stringify({ tiles: st.tiles, phase: st.env.phaseIndex, weather: st.env.weather });
  assert(shape(a) === shape(b), '同种子的地块 / 天气不一样');

  const r1 = createState(1, { seed: 777 });
  const r2 = createState(1, { seed: 777 });
  run(r1, 60);
  run(r2, 60);
  const timeline = (st) => JSON.stringify({ wave: st.waveIndex, killed: st.stats.killed, xs: st.dragons.map((d) => Math.round(d.x)) });
  assert(timeline(r1) === timeline(r2), '同种子的出怪节奏不一样');

  const r3 = createState(1, { seed: 778 });
  run(r3, 60);
  assert(timeline(r3) !== timeline(r1) || shape(r3) !== shape(r1), '换了种子结果却完全一样');

  assert(dailySeed(new Date(2026, 9, 14)) === 20261014, `每日种子不对: ${dailySeed(new Date(2026, 9, 14))}`);
  assert(normalizeSeed('123456') === 123456, 'URL 里的种子没有解析对');
  assert(normalizeSeed('abc', 88) === 88, '非法种子应该回落到默认值');
  assert(Number.isInteger(createState(0).seed), 'state.seed 应该是整数');
  return `种子 ${r1.seed} · 60 秒后第 ${r1.waveIndex + 1} 波一致`;
});

check('第 2 关（昼夜 / 天气 / 精英 / 合体全开）脚本 AI 依然能通关', () => {
  const s = createState(1, { autoCollect: true });
  const result = run(s, 900, (st) => playSmart(st));
  assert(result === 'win', `期望通关，实际 ${result}（第 ${s.waveIndex + 1} 波，击杀 ${s.stats.killed}）`);
  return `${Math.round(s.time)} 秒通关 / 精英 ${s.stats.elites || 0} 只 · 合体 ${s.stats.fused || 0} 次 · 推车剩 ${s.mowers.filter(Boolean).length}`;
});

// ------------------------------------------------------------------ 8. 网站化 / 多设备
console.log('\n[8] 网站化（手机 / 平板 / 电脑 / 离线）');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readText = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const hasFile = (p) => existsSync(resolve(ROOT, p.replace(/^\.\//, '')));

check('manifest 是中文 PWA 配置，且全部用相对路径（子目录部署才不白屏）', () => {
  const mf = JSON.parse(readText('manifest.webmanifest'));
  assert(mf.name.includes('奶'), '名字不是中文');
  assert(mf.lang === 'zh-CN', 'lang 不是 zh-CN');
  assert(mf.start_url === './' && mf.scope === './', 'start_url / scope 必须是相对路径');
  assert(mf.display === 'standalone', '不是可以装到桌面的模式');
  assert(mf.orientation === 'landscape', '应该是横屏游戏');
  for (const icon of mf.icons) assert(hasFile(icon.src), `图标缺失: ${icon.src}`);
  return `${mf.name} · ${mf.icons.length} 个图标`;
});

check('离线清单覆盖全部源码模块（少一个断网就白屏）', () => {
  const sw = readText('sw.js');
  const listed = new Set([...sw.matchAll(/'(\.[^']*)'/g)].map((m) => m[1]));
  const modules = [];
  const walk = (dir) => {
    for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(p);
      else if (p.endsWith('.js')) modules.push(p);
    }
  };
  walk('src');
  for (const m of modules) assert(listed.has('./' + m), `sw.js 的离线清单里少了 ${m}`);
  for (const url of listed) assert(hasFile(url), `sw.js 里列了不存在的文件: ${url}`);
  return `${modules.length} 个模块全部在缓存清单里`;
});

check('页面外壳适配各设备：中文、安全区、横屏提示、全屏 / 分享 / 每日挑战', () => {
  const html = readText('index.html');
  assert(html.includes('lang="zh-CN"'), 'lang 不是中文');
  assert(html.includes('viewport-fit=cover'), '缺少刘海屏安全区适配');
  assert(html.includes('user-scalable=no'), '手机上双指缩放会打断操作');
  for (const id of ['btn-fullscreen', 'btn-share', 'btn-daily', 'rotate-hint']) {
    assert(html.includes(id), `页面缺少 ${id}`);
  }
  assert(html.includes("from './src/app/main.js'"), '入口必须是相对路径，否则子目录部署会 404');
  assert(hasFile('src/app/main.js') && hasFile('src/app/shell.js'), '入口文件不存在');
  const css = readText('styles.css');
  assert(css.includes('env(safe-area-inset'), '样式里没有处理安全区');
  assert(css.includes('touch-action: none'), '画布没有关掉浏览器手势');
  const manifest = readText('manifest.webmanifest');
  assert(manifest.includes('奶蛙大战奶龙'), 'manifest 里没有中文名');
  return '全屏 / 分享 / 每日挑战 / 竖屏提示 都在';
});

check('本地也能起服务给同网络的其他设备玩', () => {
  const server = readText('server.mjs');
  assert(/createServer/.test(server), '没有内置静态服务');
  assert(hasFile('start.cmd'), '缺少 Windows 一键启动脚本');
  const pkg = JSON.parse(readText('package.json'));
  assert(pkg.scripts.start.includes('server.mjs'), 'npm start 没有指向本地服务');
  assert(pkg.scripts.test.includes('selftest'), 'npm test 没有指向自测');
  return 'npm start / start.cmd 可用';
});

// ------------------------------------------------------------------ 汇总
console.log('');
if (failures.length) {
  console.log(`\n${failures.length} 项失败：`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log(`全部 ${pass} 项自测通过 ✅\n`);
