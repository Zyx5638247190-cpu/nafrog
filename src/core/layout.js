// 界面布局（绘制与点击命中共用同一份数据）

import { HUD_H } from './config.js';

export const MILK_BADGE = { x: 14, y: 12, w: 142, h: 80 };

export const CARD = { x: 166, y: 8, w: 88, h: 88, gap: 8 };
export const cardRect = (i) => ({
  x: CARD.x + i * (CARD.w + CARD.gap),
  y: CARD.y,
  w: CARD.w,
  h: CARD.h,
});

export const BUTTON_IDS = ['pause', 'speed', 'sound', 'auto', 'shovel', 'restart'];
export const BUTTON = { x: 846, y: 8, w: 40, h: 40, gap: 7 };
export const buttonRect = (id) => {
  const i = Math.max(0, BUTTON_IDS.indexOf(id));
  return { x: BUTTON.x + i * (BUTTON.w + BUTTON.gap), y: BUTTON.y, w: BUTTON.w, h: BUTTON.h };
};

export const PROGRESS = { x: 846, y: 62, w: 420, h: 20 };
export const LABELS = { x: 1128, y: 12, w: 138, h: 40 };

/** HUD 最下面一条：当前时段 + 天气（点一下看详细说明） */
export const ENV_BADGE = { x: 846, y: 83, w: 420, h: 19 };

/** 底部技能条：奶怒攒满后，点这里放「奶浪」清场 */
export const RAGE_BAR = { x: 402, y: 728, w: 476, h: 54 };

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const HUD_BOTTOM = HUD_H;

// ------------------------------------------------------------- 覆盖层

export const PANEL = { x: 250, y: 60, w: 780, h: 676 };
export const SMALL_PANEL = { x: 392, y: 168, w: 496, h: 408 };

export function levelButtonRects(count = 3) {
  const out = [];
  const w = 620;
  const h = 74;
  const x = PANEL.x + (PANEL.w - w) / 2;
  const startY = PANEL.y + 168;
  for (let i = 0; i < count; i++) {
    out.push({ id: `level-${i}`, index: i, x, y: startY + i * (h + 14), w, h });
  }
  return out;
}

export const MENU_START = {
  id: 'start',
  x: PANEL.x + (PANEL.w - 380) / 2,
  y: PANEL.y + 470,
  w: 380,
  h: 66,
};

export function smallPanelButtons(ids) {
  const w = 320;
  const h = 62;
  const x = SMALL_PANEL.x + (SMALL_PANEL.w - w) / 2;
  const startY = SMALL_PANEL.y + 158;
  return ids.map((id, i) => ({ id, x, y: startY + i * (h + 16), w, h }));
}
