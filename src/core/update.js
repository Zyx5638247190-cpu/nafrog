// 每帧模拟（纯逻辑）

import {
  BREACH_X,
  CELL,
  DRAGONS,
  FROST,
  HUD_H,
  LAWN,
  LAWN_W,
  MILK,
  MOWER,
  MOWER_PARK_X,
  MOWER_X,
  RAGE,
  ROWS,
  CANVAS,
} from './config.js';
import { addDragon, addMilk, growDragon, rand, spawnDrop, spawnFx } from './state.js';
import { statsOf, tileAt } from './stats.js';
import { isFinalWave, waveFor } from './level.js';
import { tickEnv } from './weather.js';
import { absorbDamage, affixOf, berserkMult, leechHeal, rollAffix, splitPlan } from './affix.js';
import { tryFuse } from './fuse.js';

const GRAVITY = 520;
const PLANT_HALF = 44;
const MILK_TARGET = { x: 96, y: 52 };

export function update(state, dtRaw) {
  if (state.result || state.paused) return;
  const dt = Math.min(dtRaw, 0.05) * state.speed;
  state.time += dt;

  // 昼夜推进 / 天气切换（换的时候往 state.banner 里塞提示）
  for (const ev of tickEnv(state, dt)) announceEnv(state, ev);

  updateCards(state, dt);
  updateSky(state, dt);
  updateWaves(state, dt);
  updatePlants(state, dt);
  updateShots(state, dt);
  updateDragons(state, dt);
  // 合体要在奶龙都移动完再判定，免得同一帧里挤成一团连着合
  for (const ev of tryFuse(state)) announceFuse(state, ev);
  updateMowers(state, dt);
  updateDrops(state, dt);
  updateFx(state, dt);

  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  if (state.rageFlash > 0) state.rageFlash = Math.max(0, state.rageFlash - dt * 1.6);
  if (state.ultWave > 0) state.ultWave = Math.max(0, state.ultWave - dt * 0.85);

  checkOutcome(state, dt);
}

/** 换时段 / 换天气的提示 */
function announceEnv(state, ev) {
  const def = ev.def;
  const label = ev.kind === 'phase' ? `天色转${def.name}` : `${def.icon} ${def.name}来了`;
  const text = `${label}：${def.desc}`;
  state.banner = { text, t: 2.5, tone: 'env' };
  state.env.news = { kind: ev.kind, key: def.key, name: def.name, text };
}

/** 合体提示 */
function announceFuse(state, ev) {
  const def = DRAGONS[ev.key] || DRAGONS.baby;
  const heads = Math.min(4, ev.fuse + 1);
  const name = `${['', '双', '三', '四'][heads - 1] || heads + ' 头'}${def.name}`;
  state.banner = { text: `合体！两只${def.name} → ${name}`, t: 2.4, tone: 'fuse' };
  state.shake = Math.max(state.shake, 7);
  state.stats.lastFuse = name;
}

// ------------------------------------------------------------------ 天上掉奶

function updateSky(state, dt) {
  state.skyTimer -= dt;
  if (state.skyTimer > 0) return;
  const [a, b] = MILK.interval;
  state.skyTimer = rand(state, a, b);
  const x = LAWN.x + rand(state, 30, LAWN_W - 30);
  spawnDrop(state, x, HUD_H - 16, MILK.amount, 'sky');
}

// ------------------------------------------------------------------ 卡片冷却

function updateCards(state, dt) {
  for (const card of state.cards) {
    if (card.cd > 0) card.cd = Math.max(0, card.cd - dt);
  }
}

// ------------------------------------------------------------------ 波次

function updateWaves(state, dt) {
  const level = state.level;

  // 战场清空时提前催下一波
  if (state.waveIndex >= 0 && state.pending.length === 0 && state.dragons.length === 0 && !state.result) {
    state.waveTimer = Math.min(state.waveTimer, 2.5);
  }

  state.waveTimer -= dt;
  if (state.waveTimer <= 0) {
    const next = waveFor(level, state.waveIndex + 1);
    if (next) {
      startWave(state, state.waveIndex + 1, next);
    } else if (!level.endless) {
      state.waveTimer = 999;
    } else {
      state.waveTimer = 6;
    }
  }

  // 到点刷龙
  for (let i = state.pending.length - 1; i >= 0; i--) {
    const item = state.pending[i];
    if (state.time >= item.at) {
      state.pending.splice(i, 1);
      spawnDragon(state, item);
    }
  }
}

function spawnDragon(state, item) {
  const def = DRAGONS[item.type] || DRAGONS.baby;
  const d = addDragon(state, item.type, item.row, item.hp / def.hp, item.speed / def.speed, {
    hp: item.hp,
    speed: item.speed,
    affix: item.affix || null,
  });
  d.x = CANVAS.w + 40 + rand(state, 0, 110);
  if (d.affix) {
    const def2 = affixOf(d);
    state.banner = { text: `精英${def2.name}「${def2.icon}」出场：${def2.desc}`, t: 2.6, tone: 'elite' };
    state.stats.lastElite = def2.key;
  }
  return d;
}

function startWave(state, index, wave) {
  const level = state.level;
  state.waveIndex = index;
  state.waveFused = 0;
  const gap = level.waveGap || [18, 24];
  state.waveTimer = rand(state, gap[0], gap[1]);

  const hpScale = (wave.hpScale ?? level.hpScale ?? 1) * (level.endless ? 1 : 1);
  const speedScale = wave.speedScale ?? level.speedScale ?? 1;
  const bigMult = wave.big ? 1.4 : 1;

  let stagger = 0;
  // 精英词缀是「彩蛋级」事件，所以每波有硬上限（大波也不会挤满精英）
  const eliteCap = level.elite?.maxPerWave ?? 2;
  let eliteCount = 0;
  for (const entry of wave.spawns || []) {
    const total = Math.max(1, Math.round(entry.count * bigMult));
    for (let i = 0; i < total; i++) {
      const row = pickLane(state);
      const def = DRAGONS[entry.type] || DRAGONS.baby;
      const hp = Math.round(def.hp * hpScale);
      // 精英词缀在这里就抽好，出场时才可见
      const affix = eliteCount < eliteCap ? rollAffix(state, level, index, entry.type) : null;
      if (affix) eliteCount++;
      state.pending.push({
        type: entry.type,
        row,
        at: state.time + stagger,
        hp,
        speed: def.speed * speedScale,
        affix,
      });
      stagger += entry.type === 'boss' ? 1.6 : rand(state, 0.35, 1.05);
    }
  }

  if (wave.big) {
    state.banner = {
      text: isFinalWave(level, index) ? '最后一波！奶龙王来了！' : '一大波奶龙来袭！',
      t: 2.8,
    };
    state.shake = 6;
  }
}

function pickLane(state) {
  // 优先选择压力小的行，避免全部挤在一起
  const counts = new Array(ROWS).fill(0);
  for (const item of state.pending) counts[item.row]++;
  for (const d of state.dragons) if (!d.dead) counts[d.row]++;
  const min = Math.min(...counts);
  const pool = [];
  for (let r = 0; r < ROWS; r++) if (counts[r] === min) pool.push(r);
  if (state.rng() < 0.55) return pool[Math.floor(state.rng() * pool.length)];
  return Math.floor(state.rng() * ROWS);
}

// ------------------------------------------------------------------ 奶蛙

function updatePlants(state, dt) {
  for (let i = state.plants.length - 1; i >= 0; i--) {
    const p = state.plants[i];
    if (p.dead) {
      state.plants.splice(i, 1);
      continue;
    }
    p.age += dt;
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 4);
    if (p.mergeFlash > 0) p.mergeFlash = Math.max(0, p.mergeFlash - dt * 1.6);
    if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 3.2);
    if (p.hp <= 0) {
      p.dead = true;
      spawnFx(state, p.x, p.y, 'dig', 16);
      state.plants.splice(i, 1);
      continue;
    }

    const def = p.def;
    const st = statsOf(p, tileAt(state, p.row, p.col), state.env);

    if (def.kind === 'producer') {
      p.produceLeft -= dt;
      if (p.produceLeft <= 0) {
        p.produceLeft = st.produce.interval;
        const nearby = state.drops.filter(
          (d) => d.kind === 'plant' && Math.abs(d.x - p.x) < 150 && Math.abs(d.y - p.y) < 90,
        ).length;
        if (nearby < 4) {
          spawnDrop(state, p.x + rand(state, -8, 8), p.y - 10, st.produce.amount, 'plant');
        }
      }
      continue;
    }

    if (def.kind === 'shooter') {
      // 射程会随天气变（浓雾里打不到远处）
      const hasTarget = state.dragons.some(
        (d) => !d.dead && d.row === p.row && d.x > p.x - 30 && d.x < p.x + st.fire.range,
      );
      if (!hasTarget && p.burstLeft <= 0) {
        p.fireLeft = Math.min(p.fireLeft, st.fire.interval * 0.5);
        continue;
      }
      if (p.burstLeft > 0) {
        p.burstGap -= dt;
        if (p.burstGap <= 0) {
          fireShot(state, p, st);
          p.burstLeft--;
          p.burstGap = 0.16;
        }
        continue;
      }
      p.fireLeft -= dt;
      if (p.fireLeft <= 0) {
        p.fireLeft = st.fire.interval;
        const burst = st.fire.burst || 1;
        fireShot(state, p, st);
        if (burst > 1) {
          p.burstLeft = burst - 1;
          p.burstGap = 0.16;
        }
      }
      continue;
    }

    if (def.kind === 'bomb') {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        explode(state, p, st.bomb);
        p.dead = true;
        state.plants.splice(i, 1);
      }
    }
  }
}

function fireShot(state, p, st) {
  const f = st ? st.fire : p.def.fire;
  const lanes = f.lanes || [0];
  const range = f.range || 1150;
  for (const offset of lanes) {
    const row = p.row + offset;
    if (row < 0 || row >= ROWS) continue;
    const hasEnemy = state.dragons.some(
      (d) => !d.dead && d.row === row && d.x > p.x - 20 && d.x < p.x + range,
    );
    if (!hasEnemy) continue;
    state.shots.push({
      x: p.x + 26,
      y: p.y - 16 + offset * 10,
      row,
      dmg: f.dmg,
      speed: f.speed,
      slow: f.slow || null,
      kind: f.kind || (f.slow ? 'ice' : 'milk'),
      life: 3.2,
      wobble: rand(state, 0, Math.PI * 2),
    });
  }
}

function explode(state, p, bomb) {
  const bombDef = bomb || p.def.bomb;
  const r = bombDef.radius;
  // 快照一份：精英「分裂」会在这一击里生出新奶龙，
  // 新生的那两只不应该被同一发炸弹顺手带走（不然「分裂」等于没有）
  for (const d of state.dragons.slice()) {
    if (d.dead) continue;
    const dx = (d.x - p.x) / CELL.w;
    const dy = (d.row - p.row) / 1.0;
    const dist = Math.hypot(dx, dy);
    if (dist <= r) {
      damageDragon(state, d, bombDef.dmg);
    }
  }
  state.shake = 9;
  for (let i = 0; i < 46; i++) {
    const a = rand(state, 0, Math.PI * 2);
    const sp = rand(state, 120, 520);
    state.fx.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.7,
      life: rand(state, 0.4, 0.95),
      maxLife: 0.95,
      size: rand(state, 4, 13),
      kind: 'bubble',
      color: null,
    });
  }
}

// ------------------------------------------------------------------ 子弹

function updateShots(state, dt) {
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const s = state.shots[i];
    s.x += s.speed * dt;
    s.life -= dt;
    s.wobble += dt * 12;

    if (s.life <= 0 || s.x > CANVAS.w + 60) {
      state.shots.splice(i, 1);
      continue;
    }

    let hit = null;
    for (const d of state.dragons) {
      if (d.dead || d.row !== s.row) continue;
      const half = 30 * d.scale;
      if (s.x > d.x - half && s.x < d.x + half + 10) {
        hit = d;
        break;
      }
    }
    if (hit) {
      damageDragon(state, hit, s.dmg);
      if (s.slow) {
        hit.slowT = Math.max(hit.slowT, s.slow.duration);
        hit.slowFactor = Math.min(hit.slowFactor, s.slow.factor);
        addFrost(state, hit);
      }
      for (let k = 0; k < 6; k++) {
        state.fx.push({
          x: s.x,
          y: s.y,
          vx: rand(state, -70, 130),
          vy: rand(state, -90, 40),
          life: rand(state, 0.2, 0.45),
          maxLife: 0.45,
          size: rand(state, 2, 5),
          kind: s.slow ? 'ice' : 'milk',
          color: null,
        });
      }
      state.shots.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ 奶龙

/**
 * 统一的伤害入口。
 * 精英「奶盾」会先吃伤害，护盾破了才轮到本体。
 */
function damageDragon(state, d, amount) {
  if (d.dead || amount <= 0) return;
  const res = absorbDamage(d, amount);
  d.hitFlash = 1;
  if (res.shield > 0) {
    for (let k = 0; k < 3; k++) {
      state.fx.push({
        x: d.x + rand(state, -20, 20),
        y: d.y - rand(state, 20, 70) * d.scale,
        vx: rand(state, -40, 40),
        vy: rand(state, -50, -10),
        life: rand(state, 0.18, 0.4),
        maxLife: 0.4,
        size: rand(state, 2, 4),
        kind: 'shield',
        color: null,
      });
    }
    if (res.broke) {
      state.shake = Math.max(state.shake, 3);
      spawnFx(state, d.x, d.y - 50 * d.scale, 'bubble', 14);
    }
  }
  if (res.hp <= 0) return;
  d.hp -= res.hp;
  if (d.hp <= 0) {
    d.hp = 0;
    killDragon(state, d);
  }
}

/** 冰霜叠层：叠满 FROST.max 层直接冻结（奶龙王免疫冻结，只会被重减速） */
function addFrost(state, d) {
  if (d.dead) return;
  d.frost = Math.min(FROST.max, (d.frost || 0) + 1);
  d.frostT = FROST.decay;
  if (d.frost >= FROST.max) {
    d.frost = 0;
    d.frostT = 0;
    if (d.key === 'boss') {
      d.slowT = Math.max(d.slowT, 1.4);
      d.slowFactor = Math.min(d.slowFactor, 0.5);
    } else {
      d.freezeT = Math.max(d.freezeT || 0, FROST.freeze);
      state.stats.freezes++;
      for (let k = 0; k < 10; k++) {
        state.fx.push({
          x: d.x + rand(state, -26, 26),
          y: d.y - rand(state, 20, 80) * d.scale,
          vx: rand(state, -30, 30),
          vy: rand(state, -60, -10),
          life: rand(state, 0.3, 0.6),
          maxLife: 0.6,
          size: rand(state, 2, 4.5),
          kind: 'ice',
          color: null,
        });
      }
    }
  }
}

/** 奶怒：击杀积累怒气 */
function addRage(state, amount) {
  if (state.rage >= RAGE.max) return;
  state.rage = Math.min(RAGE.max, state.rage + amount);
  if (state.rage >= RAGE.max) {
    state.rageReady = true;
    state.rageFlash = 1;
  }
}

/**
 * 奶怒大招「奶浪」：清屏级的全屏伤害 + 冻结。
 * 这是本作相对 PvZ 的主动技能层：攒满怒气后由玩家手动释放。
 */
export function activateUltimate(state) {
  if (state.result) return { ok: false, reason: '本关已结束' };
  if (!state.rageReady) {
    return { ok: false, reason: `奶怒还没攒满（${Math.floor(state.rage)}/${RAGE.max}）` };
  }
  state.rage = 0;
  state.rageReady = false;
  state.rageFlash = 0;
  state.ultWave = 1;
  state.shake = RAGE.shake;
  state.stats.ultimates++;
  state.ultimate.used++;
  state.ultimate.lastWave = state.waveIndex;

  let hits = 0;
  // 同样先快照：这一发奶浪不该顺手打死刚刚分裂出来的小龙
  for (const d of state.dragons.slice()) {
    if (d.dead) continue;
    const boss = d.key === 'boss';
    damageDragon(state, d, RAGE.dmg * (boss ? RAGE.bossFactor : 1));
    if (d.dead) continue;
    hits++;
    if (boss) {
      d.slowT = Math.max(d.slowT, 2);
      d.slowFactor = Math.min(d.slowFactor, 0.6);
    } else {
      d.freezeT = Math.max(d.freezeT || 0, RAGE.freeze);
    }
  }
  for (let i = 0; i < 70; i++) {
    state.fx.push({
      x: rand(state, LAWN.x, CANVAS.w),
      y: rand(state, HUD_H + 40, CANVAS.h - 40),
      vx: rand(state, -90, 90),
      vy: rand(state, -220, -40),
      life: rand(state, 0.4, 0.9),
      maxLife: 0.9,
      size: rand(state, 3, 9),
      kind: 'bubble',
      color: null,
    });
  }
  return { ok: true, hits };
}

function killDragon(state, d) {
  d.dead = true;
  d.deathT = 0;
  if (d.scored !== false) state.stats.killed++;
  if (d.scored !== false && d.affix) state.stats.eliteKills = (state.stats.eliteKills || 0) + 1;
  addRage(state, d.key === 'boss' ? RAGE.perBoss : RAGE.perKill);
  spawnFx(state, d.x, d.y - 26 * d.scale, 'poof', 18);

  // 精英「分裂」：倒下时裂成两只小奶龙（它们不再带词缀，也不会再分裂）
  const plan = splitPlan(d);
  if (plan) {
    d.splitting = true;
    const hp = Math.max(1, Math.round(d.maxHp * plan.hpRatio));
    for (let k = 0; k < plan.count; k++) {
      const child = addDragon(state, d.key, d.row, 1, 1, {
        hp,
        speed: d.baseSpeed ?? d.speed,
        x: d.x + (k === 0 ? -22 : 22),
        scored: false,
      });
      child.scale = (d.baseScale ?? d.def.scale) * 0.78;
      child.baseScale = child.scale;
      child.grow = Math.min(2, d.grow || 0);
      child.hitFlash = 1;
    }
    state.stats.splits = (state.stats.splits || 0) + 1;
    state.shake = Math.max(state.shake, 5);
    state.banner = { text: `「裂」分裂成 ${plan.count} 只！`, t: 1.5, tone: 'elite', sfx: 'split' };
  }

  if (d.key === 'boss') {
    state.shake = 10;
    spawnDrop(state, d.x, d.y - 20, 100, 'bounty');
    spawnFx(state, d.x, d.y - 26, 'bubble', 40);
  }
}

function updateDragons(state, dt) {
  const mods = (state.env && state.env.mods) || {};
  const envSpeed = mods.dragonSpeed || 1;
  for (let i = state.dragons.length - 1; i >= 0; i--) {
    const d = state.dragons[i];

    if (d.dead) {
      d.deathT += dt;
      d.x -= 6 * dt;
      if (d.deathT > 0.75) state.dragons.splice(i, 1);
      continue;
    }

    d.age += dt;
    if (d.fuseCd > 0) d.fuseCd = Math.max(0, d.fuseCd - dt);
    if (d.hitFlash > 0) d.hitFlash = Math.max(0, d.hitFlash - dt * 6);
    if (d.slowT > 0) {
      d.slowT -= dt;
      if (d.slowT <= 0) d.slowFactor = 1;
    }
    if (d.frostT > 0) {
      d.frostT -= dt;
      if (d.frostT <= 0) d.frost = 0;
    }
    if (d.freezeT > 0) d.freezeT = Math.max(0, d.freezeT - dt);
    const moveScale = d.freezeT > 0 ? 0 : d.slowFactor;
    // 精英「狂暴」：血量低了会更快、咬得更凶（不永久改数值，掉血瞬间就见效）
    const rage = berserkMult(d);

    // 找正前方最近的奶蛙
    let target = null;
    for (const p of state.plants) {
      if (p.dead || p.row !== d.row) continue;
      if (d.x - 26 * d.scale <= p.x + PLANT_HALF && d.x >= p.x - 6) {
        if (!target || p.x > target.x) target = p;
      }
    }
    d.eating = target;

    if (target) {
      const dps = d.dps * rage.dps;
      d.biteT += dt;
      target.hp -= dps * dt;
      target.hitFlash = Math.min(1, target.hitFlash + dt * 2);
      // 精英「吸血」：边啃边回血
      if (leechHeal(d, dps * dt) > 0) d.leechT = 0.2;
      if (d.leechT > 0) d.leechT = Math.max(0, d.leechT - dt);
      if (d.biteT > 0.5) {
        d.biteT = 0;
        state.fx.push({
          x: d.x - 40 * d.scale,
          y: d.y - 30 * d.scale,
          vx: rand(state, -40, 20),
          vy: rand(state, -70, -10),
          life: 0.35,
          maxLife: 0.35,
          size: rand(state, 2, 4.5),
          kind: 'chomp',
          color: null,
        });
      }
      // 吞噬成长：啃掉这个奶蛙就长一层
      if (target.hp <= 0 && !target.growDone) {
        target.growDone = true;
        if (growDragon(state, d)) {
          state.fx.push({
            x: d.x,
            y: d.y - 90 * d.scale,
            vx: 0,
            vy: -70,
            life: 0.8,
            maxLife: 0.8,
            size: 6,
            kind: 'grow',
            color: null,
          });
        }
      }
    } else {
      d.x -= d.speed * rage.speed * envSpeed * moveScale * dt;
      d.walk += dt * (0.6 + d.speed * 0.03) * (moveScale || 0.35);
      d.biteT = 0;
    }
    d.y = 0;

    if (d.x <= MOWER_X) tryMower(state, d);
    if (d.x <= BREACH_X) {
      state.result = 'lose';
      state.shake = 14;
    }
  }
}

// ------------------------------------------------------------------ 推车

function tryMower(state, d) {
  const row = d.row;
  if (!state.mowers[row]) return;
  if (state.mowerRuns.some((m) => m.row === row)) return;
  state.mowers[row] = false;
  state.mowerRuns.push({ row, x: MOWER_PARK_X, spin: 0 });
  state.shake = 6;
}

function updateMowers(state, dt) {
  for (let i = state.mowerRuns.length - 1; i >= 0; i--) {
    const m = state.mowerRuns[i];
    m.x += MOWER.speed * dt;
    m.spin += dt * 18;
    for (const d of state.dragons) {
      if (d.dead || d.row !== m.row) continue;
      if (Math.abs(d.x - m.x) < MOWER.killRadius) {
        damageDragon(state, d, 99999);
      }
    }
    if (m.x > CANVAS.w + 80) state.mowerRuns.splice(i, 1);
  }
}

// ------------------------------------------------------------------ 奶滴

function updateDrops(state, dt) {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    d.t += dt;
    d.spin += dt * 1.6;

    if (d.phase === 'fall' || d.phase === 'pop') {
      d.vy += GRAVITY * dt * (d.phase === 'pop' ? 1 : 0.6);
      d.y += d.vy * dt;
      d.x += (d.vx || 0) * dt;
      if (d.y >= d.targetY) {
        d.phase = 'idle';
        d.y = d.targetY;
        d.vy = 0;
        d.vx = 0;
      }
    } else if (d.phase === 'idle') {
      d.life -= dt;
      if (state.autoCollect) {
        d.autoT += dt;
        if (d.autoT > 0.8) d.phase = 'fly';
      }
      if (d.life <= 0) {
        state.drops.splice(i, 1);
        continue;
      }
    } else if (d.phase === 'fly') {
      const dx = MILK_TARGET.x - d.x;
      const dy = MILK_TARGET.y - d.y;
      const dist = Math.hypot(dx, dy);
      const step = MILK.flySpeed * dt;
      if (dist <= step + 8) {
        addMilk(state, d.amount, true);
        state.drops.splice(i, 1);
        continue;
      }
      d.x += (dx / dist) * step;
      d.y += (dy / dist) * step;
    }
  }
}

function updateFx(state, dt) {
  for (let i = state.fx.length - 1; i >= 0; i--) {
    const f = state.fx[i];
    f.life -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 260 * dt;
    f.vx *= 1 - Math.min(1, dt * 1.4);
    if (f.life <= 0) state.fx.splice(i, 1);
  }
}

// ------------------------------------------------------------------ 胜负

function checkOutcome(state, dt) {
  if (state.result) return;
  const level = state.level;
  if (level.endless) {
    state.stats.wavesCleared = state.waveIndex + 1;
    return;
  }
  const lastIndex = level.waves.length - 1;
  if (state.waveIndex >= lastIndex && state.pending.length === 0 && state.dragons.length === 0) {
    state.clearT = (state.clearT || 0) + dt;
    if (state.clearT > 1.4) {
      state.result = 'win';
      state.stats.wavesCleared = state.waveIndex + 1;
    }
  } else {
    state.clearT = 0;
  }
}

/** 无尽模式分数：击杀、波次、奶浪、合成升级、合体击杀都记分 */
export function scoreOf(state) {
  const s = state.stats;
  return (
    s.killed * 10 +
    Math.max(0, state.waveIndex + 1) * 50 +
    (s.ultimates || 0) * 60 +
    (s.merged || 0) * 15 +
    (s.eliteKills || 0) * 40
  );
}
