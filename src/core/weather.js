// 昼夜循环 + 天气切换（本作相对 PvZ 的原创机制之一）
//
// 一局之内时间会往前走：清晨 → 正午 → 黄昏 → 夜晚，循环往复。
// 天气再在这个基础上叠加一层随机：晴 / 奶雨 / 浓雾 / 狂风。
// 两者合成一组「全场倍率」，被 statsOf 用来算产奶、射速、伤害、射程……
//
// 纯逻辑，不碰 DOM，也没有随机数以外的外部依赖，所以能和其它 core 模块一样在 Node 里跑。

import { PHASES, WEATHERS, WEATHER_ORDER } from './config.js';

/** 当前时段用哪套配色（draw 里查 PALETTES） */
export const NEUTRAL_MODS = {
  produce: 1,
  fire: 1,
  dmg: 1,
  range: 1,
  dragonSpeed: 1,
  shotSpeed: 1,
  slowPower: 1,
};

export function phaseAt(index) {
  const n = PHASES.length;
  return PHASES[((index % n) + n) % n];
}

export function phaseIndex(key) {
  return Math.max(0, PHASES.findIndex((p) => p.key === key));
}

/** 某个时段用哪套配色（day / dusk / night） */
export function phaseAmbient(index) {
  return PHASES[((index % PHASES.length) + PHASES.length) % PHASES.length].ambient;
}

export function weatherDef(key) {
  return WEATHERS[key] || WEATHERS.clear;
}

/** 时段 × 天气 → 一组全场倍率 */
export function combineMods(phase, weather) {
  const p = phase || PHASES[0];
  const w = weatherDef(weather && weather.key ? weather.key : weather);
  return {
    produce: p.produce * w.produce,
    fire: p.fire * w.fire,
    dmg: p.dmg * w.dmg,
    range: w.range,
    dragonSpeed: p.dragonSpeed * w.dragonSpeed,
    shotSpeed: w.shotSpeed,
    slowPower: p.slowPower,
  };
}

/**
 * 取当前倍率。
 * 传 state 或 env 都能用（statsOf 拿到的常常是 state.env，draw/HUD 拿到的是 state），
 * 两样都没有时给一组中性值，方便纯逻辑单测。
 */
export function modsOf(x) {
  if (!x) return NEUTRAL_MODS;
  if (x.mods) return x.mods;
  if (x.env && x.env.mods) return x.env.mods;
  return NEUTRAL_MODS;
}

export function phaseOf(state) {
  return (state && state.env && phaseAt(state.env.phaseIndex)) || PHASES[0];
}

export function weatherOf(state) {
  return weatherDef(state && state.env ? state.env.weather : 'clear');
}

function randGap(rng, gap) {
  const [a, b] = gap;
  return a + rng() * Math.max(0, b - a);
}

/**
 * 建一份环境状态。
 * level.env 可以配置：
 *   startPhase   起始时段下标（第 2 关从黄昏开始，第 3 关从夜晚开始）
 *   dayLength    每个时段持续多少秒
 *   weatherGap   天气切换间隔 [最小值, 最大值]
 *   weathers     这一关会出现的天气（第 1 关没有浓雾，降低上手难度）
 */
export function initEnv(level, rng) {
  const spec = (level && level.env) || {};
  const start = Math.max(0, Math.min(PHASES.length - 1, spec.startPhase ?? 0));
  const weathers = Array.isArray(spec.weathers) && spec.weathers.length ? spec.weathers.slice() : ['clear'];
  const first = weathers.includes(spec.startWeather) ? spec.startWeather : weathers[0];
  const dayLength = spec.dayLength ?? 70;
  const weatherGap = spec.weatherGap ?? [24, 34];

  const env = {
    phaseIndex: start,
    prevPhaseIndex: start,
    phaseT: dayLength,
    dayLength,
    weather: first,
    weathers,
    weatherT: randGap(rng, weatherGap),
    weatherGap,
    /** 这一关开不开「奶龙合体」 */
    fuse: (level && level.fuse ? level.fuse.enabled : true) !== false,
    /** 换天色时的渐变进度（0 → 1），只影响画面 */
    blend: 1,
    /** 本帧发生的事件（换时段 / 换天气），主控读它播提示，读完后被清空 */
    events: [],
    mods: combineMods(phaseAt(start), first),
  };
  return env;
}

/**
 * 推进时间。返回本帧发生的事件数组（可能为空）。
 * 事件形如 { kind: 'phase' | 'weather', def, reset }
 */
export function tickEnv(state, dt) {
  const env = state.env;
  if (!env) return [];
  env.events = [];
  if (env.blend < 1) env.blend = Math.min(1, env.blend + dt / 5);

  env.phaseT -= dt;
  if (env.phaseT <= 0) {
    env.phaseT += env.dayLength;
    env.prevPhaseIndex = env.phaseIndex;
    env.phaseIndex = (env.phaseIndex + 1) % PHASES.length;
    env.blend = 0;
    env.mods = combineMods(phaseAt(env.phaseIndex), env.weather);
    env.events.push({ kind: 'phase', def: phaseAt(env.phaseIndex) });
  }

  env.weatherT -= dt;
  if (env.weatherT <= 0) {
    env.weatherT = randGap(state.rng, env.weatherGap);
    const next = pickWeather(state, env);
    if (next !== env.weather) {
      env.weather = next;
      env.mods = combineMods(phaseAt(env.phaseIndex), next);
      env.events.push({ kind: 'weather', def: weatherDef(next) });
    }
  }

  return env.events;
}

/** 从这一关允许的天气里随机抽一个（尽量不重复上一个） */
export function pickWeather(state, env) {
  const pool = env.weathers.length ? env.weathers : ['clear'];
  if (pool.length === 1) return pool[0];
  const others = pool.filter((k) => k !== env.weather);
  const list = others.length ? others : pool;
  return list[Math.min(list.length - 1, Math.floor(state.rng() * list.length))];
}

/**
 * 直接指定天气 / 时段。给调试面板、自测用，正常游玩走 tickEnv。
 * 返回是否真的变了。
 */
export function setWeather(state, key) {
  const env = state.env;
  if (!env || !WEATHERS[key] || env.weather === key) return false;
  env.weather = key;
  env.weatherT = randGap(state.rng, env.weatherGap);
  env.mods = combineMods(phaseAt(env.phaseIndex), key);
  env.events = [{ kind: 'weather', def: weatherDef(key) }];
  return true;
}

export function setPhase(state, key) {
  const env = state.env;
  const i = typeof key === 'number' ? key : phaseIndex(key);
  if (!env || i < 0 || env.phaseIndex === i) return false;
  env.prevPhaseIndex = env.phaseIndex;
  env.phaseIndex = i;
  env.phaseT = env.dayLength;
  env.blend = 0;
  env.mods = combineMods(phaseAt(i), env.weather);
  env.events = [{ kind: 'phase', def: phaseAt(i) }];
  return true;
}

/** 一句话描述现在的环境（HUD / 提示气泡共用） */
export function envSummary(state) {
  const p = phaseOf(state);
  const w = weatherOf(state);
  return `${p.icon} ${p.name} · ${w.icon} ${w.name}`;
}

export function envDetail(state) {
  const p = phaseOf(state);
  const w = weatherOf(state);
  return `${p.icon} ${p.name}（${p.desc}）　${w.icon} ${w.name}（${w.desc}）`;
}

/** 面板上用的一整行：交替说明都有哪些时段 / 天气 */
export function envLegend() {
  return {
    phases: PHASES.map((p) => `${p.icon}${p.name}`).join(' → '),
    weathers: WEATHER_ORDER.map((k) => `${WEATHERS[k].icon}${WEATHERS[k].name}`).join(' / '),
  };
}
