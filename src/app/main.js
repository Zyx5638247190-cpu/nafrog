// 控制器：把输入、模拟、渲染串起来

import {
  CANVAS,
  CARD_ORDER,
  PLANTS,
  TIER,
  cellCenter,
  pointToCell,
} from '../core/config.js';
import * as L from '../core/layout.js';
import { LEVELS } from '../core/level.js';
import { createState, resetState, placeOrMerge, placePlant, mergePlant, selectCard, selectShovel, shovelAt, collectDropAt, cardOf, plantAt, dailySeed, dailyLabel, normalizeSeed } from '../core/state.js';
import { activateUltimate, scoreOf, update } from '../core/update.js';
import { envDetail } from '../core/weather.js';
import { statsOf, tileAt } from '../core/stats.js';
import { overlayModel, render } from '../render/draw.js';
import { createInput, fitCanvas } from './input.js';
import * as audio from './audio.js';

const BEST_KEY = 'nafrog.best.v1';
const DAILY_KEY = 'nafrog.daily.v1';

export function boot(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  const fit = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    fitCanvas(canvas, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  window.addEventListener('resize', fit);

  // URL 参数：?seed=1234 固定同一局；?daily=1 用当天日期当种子；?level=2 直接开局
  const params = new URLSearchParams(location.search);
  const rawSeed = params.get('seed');
  const wantDaily = params.get('daily') === '1';
  const rawLevel = Number(params.get('level'));
  const daily = wantDaily ? dailySeed() : null;
  const fixedSeed = daily ?? (rawSeed ? normalizeSeed(rawSeed) : null);

  const state = createState(0);
  const view = {
    screen: 'menu',
    levelIndex: 0,
    time: 0,
    hover: null,
    drag: { active: false, x: 0, y: 0, key: null, moved: false },
    sound: true,
    toast: { text: '', t: 0 },
    best: readBest(),
    /** 每日挑战当天的最好成绩（菜单 / 结算用） */
    dailyBest: readDaily(),
    /** 挑战模式：normal 随机 / seed 固定种子 / daily 每日挑战 */
    quest: {
      mode: daily ? 'daily' : fixedSeed !== null ? 'seed' : 'normal',
      seed: fixedSeed,
      date: daily ? dailyLabel() : null,
    },
  };

  const toast = (text, dur = 1.8) => {
    view.toast = { text, t: dur };
  };

  // 页面底部工具条上的状态文字（在手机上也能一眼看到是不是同一个种子）
  function syncChrome() {
    const el = document.getElementById('seed-note');
    if (el) {
      if (view.quest.mode === 'daily') el.textContent = `每日挑战 ${view.quest.date} · 全世界同一局`;
      else if (view.quest.mode === 'seed') el.textContent = `固定种子 #${view.quest.seed} · 同一局`;
      else el.textContent = '随机地图 · 每局都不一样';
    }
    const btn = document.getElementById('btn-daily');
    if (btn) {
      const daily = view.quest.mode === 'daily';
      btn.textContent = daily ? '回随机地图' : '每日挑战';
      btn.title = daily ? '回到随机地图（每局都不一样）' : '用当天日期当种子，全世界同一局';
    }
  }

  // ------------------------------------------------------------ 流程

  /** 挑战模式下的种子：固定不变，普通模式下返回 undefined（重开就换一套） */
  function seedForRun() {
    return view.quest.seed === null ? undefined : view.quest.seed;
  }

  function startLevel(index) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, index));
    resetState(state, i, { seed: seedForRun() });
    state.selected = null;
    state.shovel = false;
    state.speed = 1;
    state.paused = false;
    view.levelIndex = i;
    view.screen = 'playing';
    view.drag.active = false;
    prevWave = -1;
    prevGrew = state.stats.grew;
    prevFreeze = state.stats.freezes;
    prevRageReady = false;
    prevBanner = null;
    const tag = view.quest.mode === 'daily' ? `每日挑战 ${view.quest.date}　` : view.quest.mode === 'seed' ? `固定种子 #${view.quest.seed}　` : '';
    toast(tag + LEVELS[i].tip, 3.4);
    syncChrome();
    audio.sfx('click');
  }

  /** 切回普通模式（随机地图）并回菜单 */
  function startRandom() {
    view.quest.mode = 'normal';
    view.quest.seed = null;
    view.quest.date = null;
    const url = new URL(location.href);
    url.searchParams.delete('daily');
    url.searchParams.delete('seed');
    history.replaceState(null, '', url);
    syncChrome();
    toMenu();
  }

  /** 进入每日挑战：用当天日期当种子，所有人同一局 */
  function startDaily() {
    view.quest.mode = 'daily';
    view.quest.seed = dailySeed();
    view.quest.date = dailyLabel();
    const url = new URL(location.href);
    url.searchParams.delete('seed');
    url.searchParams.set('daily', '1');
    history.replaceState(null, '', url);
    syncChrome();
    if (view.screen === 'playing') startLevel(view.levelIndex);
    else toMenu();
  }

  /** 本局的分享链接：对方打开就是同一张地图、同一套天气和精英 */
  function shareLink() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('level', String(state.levelIndex + 1));
    if (view.quest.mode === 'daily') url.searchParams.set('daily', '1');
    else if (state.seed) url.searchParams.set('seed', String(state.seed));
    return url.toString();
  }

  function toMenu() {
    view.screen = 'menu';
    audio.sfx('click');
  }

  /** 释放「奶浪」大招 */
  function castUltimate() {
    const r = activateUltimate(state);
    if (!r.ok) {
      toast(r.reason);
      audio.sfx('error');
      return;
    }
    audio.sfx('ultimate');
    state.banner = { text: `奶浪清场！命中 ${r.hits} 只`, t: 1.8 };
  }

  let prevWave = -1;
  let prevGrew = 0;
  let prevFreeze = 0;
  let prevRageReady = false;
  let prevBanner = null;

  /** 画面上的横幅换了一条 → 播对应的音效（天气 / 合体 / 精英出场） */
  const BANNER_SFX = { env: 'weather', fuse: 'fuse', elite: 'elite' };
  function bannerAudio() {
    const banner = state.banner;
    if (banner === prevBanner) return;
    prevBanner = banner;
    if (!banner) return;
    const name = banner.sfx || BANNER_SFX[banner.tone];
    if (name) audio.sfx(name);
  }

  function onTick() {
    if (state.waveIndex !== prevWave) {
      if (state.waveIndex > prevWave && state.banner) audio.sfx('wave');
      prevWave = state.waveIndex;
    }
    bannerAudio();
    // 奶龙吞噬成长：给玩家一个明确的警告
    if (state.stats.grew !== prevGrew) {
      prevGrew = state.stats.grew;
      audio.sfx('grow');
      toast('奶龙把奶蛙吃掉了，它变强了一层！', 2);
    }
    if (state.stats.freezes !== prevFreeze) {
      prevFreeze = state.stats.freezes;
      audio.sfx('freeze');
    }
    if (state.rageReady && !prevRageReady) {
      audio.sfx('merge');
      toast('奶怒已满！点底部的「奶浪」清场', 2.4);
    }
    prevRageReady = state.rageReady;
  }

  function onResult(result) {
    if (result === 'win') {
      audio.sfx('win');
    } else {
      audio.sfx('lose');
    }
    if (state.level.endless) {
      const sc = scoreOf(state);
      if (sc > view.best) {
        view.best = sc;
        writeBest(sc);
      }
    }
    // 每日挑战：把当天的成绩记下来，方便第二天回来对比
    if (view.quest.mode === 'daily') {
      const sc = scoreOf(state);
      const rec = readDaily();
      if (!rec || rec.date !== view.quest.date || sc > (rec.score || 0)) {
        const next = { date: view.quest.date, score: sc, result };
        writeDaily(next);
        view.dailyBest = next;
      } else {
        view.dailyBest = rec;
      }
    }
  }

  // ------------------------------------------------------------ 点击逻辑

  function handleButton(id) {
    switch (id) {
      case 'pause':
        state.paused = !state.paused;
        audio.sfx('click');
        break;
      case 'speed':
        state.speed = state.speed > 1 ? 1 : 2;
        audio.sfx('click');
        break;
      case 'sound':
        view.sound = !view.sound;
        audio.setEnabled(view.sound);
        audio.sfx('click');
        break;
      case 'auto':
        state.autoCollect = !state.autoCollect;
        toast(state.autoCollect ? '自动收奶：开' : '自动收奶：关，记得手点奶瓶');
        audio.sfx('click');
        break;
      case 'shovel':
        selectShovel(state, !state.shovel);
        audio.sfx('click');
        break;
      case 'restart':
        startLevel(state.levelIndex);
        break;
      default:
        break;
    }
  }

  function handleOverlayClick(model, x, y) {
    for (const r of model.buttons) {
      if (!L.inRect(r, x, y)) continue;
      audio.unlock();
      if (r.id === 'start') {
        startLevel(view.levelIndex);
      } else if (r.id.startsWith('level-')) {
        view.levelIndex = r.index;
        audio.sfx('select');
      } else if (r.id === 'resume') {
        state.paused = false;
        audio.sfx('click');
      } else if (r.id === 'retry') {
        startLevel(state.levelIndex);
      } else if (r.id === 'next') {
        startLevel(state.levelIndex + 1);
      } else if (r.id === 'menu') {
        toMenu();
      }
      return true;
    }
    return false;
  }

  function handleDown(x, y) {
    audio.unlock();

    // 菜单 / 暂停 / 结算等覆盖层优先处理（无论是否点中按钮，都不再往下走）
    const model = overlayModel(state, view);
    if (model) {
      handleOverlayClick(model, x, y);
      return;
    }

    for (const id of L.BUTTON_IDS) {
      if (L.inRect(L.buttonRect(id), x, y)) {
        handleButton(id);
        return;
      }
    }

    // 底部技能条：奶怒满了放「奶浪」
    if (L.inRect(L.RAGE_BAR, x, y)) {
      castUltimate();
      return;
    }

    // 天气条：点一下看当前昼夜 / 天气到底改了什么数值
    if (L.inRect(L.ENV_BADGE, x, y)) {
      toast(envDetail(state), 4.5);
      audio.sfx('select');
      return;
    }

    // 点奶量条：收下所有已经落地的奶
    if (L.inRect(L.MILK_BADGE, x, y)) {
      let n = 0;
      for (const d of state.drops) {
        if (d.phase === 'idle' || d.phase === 'pop' || d.phase === 'fall') {
          d.phase = 'fly';
          n++;
        }
      }
      if (n) audio.sfx('collect');
      return;
    }

    // 卡片
    for (let i = 0; i < CARD_ORDER.length; i++) {
      const key = CARD_ORDER[i];
      if (!L.inRect(L.cardRect(i), x, y)) continue;
      const def = PLANTS[key];
      const card = cardOf(state, key);
      if (state.result) return;
      if (card && card.cd > 0) {
        toast(`${def.name} 还在冷却（${Math.ceil(card.cd)} 秒）`);
        audio.sfx('error');
        return;
      }
      if (state.milk < def.cost) {
        toast(`奶不够：需要 ${def.cost}，现在只有 ${Math.floor(state.milk)}`);
        audio.sfx('error');
        return;
      }
      selectCard(state, key);
      view.drag = { active: true, x, y, key, moved: false };
      audio.sfx('select');
      return;
    }

    // 收奶
    if (collectDropAt(state, x, y)) {
      audio.sfx('collect');
      return;
    }

    const cell = pointToCell(x, y);
    if (cell) {
      if (state.shovel) {
        const r = shovelAt(state, cell.row, cell.col);
        if (r.ok) audio.sfx('plant');
        else {
          toast(r.reason);
          audio.sfx('error');
        }
        return;
      }
      if (state.selected) {
        const key = state.selected;
        const r = placeOrMerge(state, key, cell.row, cell.col);
        if (r.ok) {
          state.selected = null;
          afterPlace(key, r);
        } else {
          toast(r.reason);
          audio.sfx('error');
        }
        return;
      }
    }
    if (state.selected) state.selected = null;
  }

  let startPt = { x: 0, y: 0 };

  function handleMove(x, y) {
    view.hover = { x, y };
    if (view.drag.active) {
      view.drag.x = x;
      view.drag.y = y;
      if (Math.hypot(x - startPt.x, y - startPt.y) > 8) view.drag.moved = true;
    }
  }

  function handleUp(x, y) {
    if (view.screen !== 'playing') {
      view.drag.active = false;
      return;
    }
    if (view.drag.active && view.drag.key) {
      const key = view.drag.key;
      const cell = pointToCell(x, y);
      const moved = view.drag.moved;
      view.drag.active = false;
      if (moved && cell && !isHud(x, y)) {
        const r = placeOrMerge(state, key, cell.row, cell.col);
        if (r.ok) {
          state.selected = null;
          afterPlace(key, r);
        } else {
          toast(r.reason);
          audio.sfx('error');
        }
      }
    } else {
      view.drag.active = false;
    }
  }

  /** 种植 / 合成成功后的统一反馈 */
  function afterPlace(key, r) {
    if (r.merged) {
      audio.sfx('merge');
      toast(`合成升级！「${PLANTS[key].name}」${TIER.stars[r.tier]}`);
    } else {
      audio.sfx('plant');
    }
  }

  const isHud = (x, y) => y < L.HUD_BOTTOM;

  function handleKey(e) {
    audio.unlock();
    const k = e.key;
    if (k >= '1' && k <= '7') {
      const key = CARD_ORDER[Number(k) - 1];
      if (key && view.screen === 'playing' && !state.paused) {
        const card = cardOf(state, key);
        if (card && card.cd > 0) {
          toast(`${PLANTS[key].name} 还在冷却`);
          audio.sfx('error');
        } else {
          selectCard(state, key);
          audio.sfx('select');
        }
      }
      return;
    }
    if (k === ' ' || k === 'p' || k === 'P') {
      if (view.screen === 'playing' && !state.result) {
        state.paused = !state.paused;
        audio.sfx('click');
      }
      e.preventDefault();
      return;
    }
    if (k === 'q' || k === 'Q') {
      if (view.screen === 'playing' && !state.paused && !state.result) castUltimate();
      return;
    }
    if (k === 'Escape') {
      if (view.screen === 'playing') {
        if (state.paused || state.result) {
          if (state.result === 'win') toMenu();
          else state.paused = false;
        } else {
          state.selected = null;
          selectShovel(state, false);
        }
      }
      return;
    }
    if (k === 's' || k === 'S') {
      if (view.screen === 'playing') selectShovel(state, !state.shovel);
      return;
    }
    if (k === 'd' || k === 'D') {
      state.autoCollect = !state.autoCollect;
      toast(state.autoCollect ? '自动收奶：开' : '自动收奶：关');
      return;
    }
    if (k === 'Enter' && view.screen === 'menu') {
      startLevel(view.levelIndex);
    }
  }

  createInput(canvas, {
    onDown(x, y, meta) {
      startPt = { x, y };
      if (meta && meta.locked) return;
      handleDown(x, y);
    },
    onMove: handleMove,
    onUp: handleUp,
    onLeave: () => {
      view.hover = null;
    },
    onKey: handleKey,
  });

  window.addEventListener('blur', () => {
    if (view.screen === 'playing' && !state.result) state.paused = true;
  });

  // ------------------------------------------------------------ 主循环

  let last = performance.now();
  let prevResult = null;
  let raf = 0;

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    view.time += dt;
    if (view.toast.t > 0) view.toast.t -= dt;

    if (view.screen === 'playing') {
      update(state, dt);
      onTick();
      if (state.result && state.result !== prevResult) {
        prevResult = state.result;
        onResult(state.result);
      }
      if (!state.result) prevResult = null;
    }

    render(ctx, state, view);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // ------------------------------------------------------------ 调试 / 测试接口

  const api = {
    state,
    view,
    startLevel,
    toMenu,
    startDaily,
    startRandom,
    shareLink,
    syncChrome,
    /** 分享链接（给页面工具条的「复制本局链接」用） */
    copyShareLink: async () => {
      const link = shareLink();
      let ok = false;
      try {
        await navigator.clipboard.writeText(link);
        ok = true;
      } catch (err) {
        ok = false;
      }
      if (ok) {
        toast('链接已复制，发给朋友就是同一局！', 3);
        audio.sfx('share');
      } else {
        toast(link, 6);
        audio.sfx('error');
      }
      return { ok, link };
    },
    /** 推进 n 帧（默认 1/60 秒一帧） */
    tick(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) update(state, dt);
      return state;
    },
    /** 推进 seconds 秒 */
    run(seconds, dt = 1 / 60) {
      const steps = Math.round(seconds / dt);
      for (let i = 0; i < steps; i++) update(state, dt);
      return state;
    },
    place(row, col, key) {
      const r = placePlant(state, key, row, col);
      return r;
    },
    merge(row, col, key) {
      return mergePlant(state, key, row, col);
    },
    placeOrMerge(row, col, key) {
      return placeOrMerge(state, key, row, col);
    },
    castRage() {
      return activateUltimate(state);
    },
    tileAt: (row, col) => tileAt(state, row, col),
    statsAt: (row, col) => {
      const p = plantAt(state, row, col);
      return p ? statsOf(p, tileAt(state, row, col)) : null;
    },
    plantRow(row, key, cols = [0, 1, 2, 3, 4, 5]) {
      const out = [];
      for (const c of cols) out.push(placePlant(state, key, row, c).ok);
      return out;
    },
    cellCenter,
    plantAt: (row, col) => plantAt(state, row, col),
    cellOf: (x, y) => pointToCell(x, y),
    clickAt(x, y) {
      handleDown(x, y);
      handleUp(x, y);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };

  window.__nafrog = api;

  // 分享 / 每日挑战链接：进来就直接开打（?level=2&seed=123 或 ?level=1&daily=1）
  syncChrome();
  if (Number.isFinite(rawLevel) && rawLevel >= 1 && rawLevel <= LEVELS.length && (fixedSeed !== null || params.has('level'))) {
    view.levelIndex = rawLevel - 1;
    startLevel(view.levelIndex);
  }

  return api;
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* 忽略 */
  }
}

/** 每日挑战的最好成绩（同一天里只留最高的那一次） */
function readDaily() {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDaily(rec) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(rec));
  } catch {
    /* 忽略 */
  }
}

export { CANVAS };
