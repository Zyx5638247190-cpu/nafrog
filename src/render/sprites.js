// 全部美术资源都是代码画的（Canvas 2D 路径），无需任何图片


function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function shadow(ctx, y, rx, ry = 8, alpha = 0.18) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1d3b2a';
  ellipse(ctx, 0, y, rx, ry);
  ctx.fill();
  ctx.restore();
}

/** 半透明覆盖层，用于受伤闪白 / 冰冻 */
function overlay(ctx, draw, color, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, alpha);
  ctx.fillStyle = color;
  draw(ctx);
  ctx.restore();
}

function eyed(ctx, ex, ey, r, look = -1.2, blink = 1) {
  ctx.fillStyle = '#2f3330';
  if (blink < 0.12) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2f3330';
    ctx.moveTo(ex - r, ey);
    ctx.lineTo(ex + r, ey);
    ctx.stroke();
    return;
  }
  ellipse(ctx, ex, ey, r, r * (0.82 + 0.18 * blink));
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, ex + r * 0.34, ey - r * 0.36, r * 0.34, r * 0.3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ellipse(ctx, ex + look * r * 0.2, ey + r * 0.35, r * 0.18, r * 0.16);
  ctx.fill();
}

function blush(ctx, x, y, r = 5) {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ff8ea8';
  ellipse(ctx, x, y, r, r * 0.62);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ 奶瓶

export function drawMilkBottle(ctx, x, y, s = 1, rot = 0, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  // 瓶身
  const g = ctx.createLinearGradient(-8, -10, 8, 10);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, opts.ice ? '#cfeeff' : '#e6f1ff');
  ctx.fillStyle = g;
  rr(ctx, -7, -10, 14, 20, 5);
  ctx.fill();
  // 奶液
  ctx.fillStyle = opts.ice ? 'rgba(146,220,255,0.9)' : 'rgba(255,255,255,0.95)';
  rr(ctx, -5, -3, 10, 12, 4);
  ctx.fill();
  // 瓶颈 + 奶嘴
  ctx.fillStyle = opts.ice ? '#9fdcff' : '#ffd166';
  rr(ctx, -4, -14, 8, 5, 2);
  ctx.fill();
  ctx.fillStyle = opts.ice ? '#cdedff' : '#ffe9b0';
  ellipse(ctx, 0, -17, 4.2, 3.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,150,170,0.5)';
  ctx.lineWidth = 1;
  rr(ctx, -7, -10, 14, 20, 5);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ 奶蛙

/**
 * 奶蛙（防守方）的招牌配色。
 *
 * 奶蛙是黄澄澄的梨形身子 + 大块奶油色肚皮 + 深橄榄色的细长手脚，
 * 一对凸起的圆眼（眼白泛绿、瞳孔就是个小黑点）顶着一条笑到合不拢的大嘴。
 * 和奶龙一眼分得开：奶龙的瞳孔又大又圆、四肢短小；奶蛙眼白泛绿、手脚更长更深色。
 */
const FROG = {
  body: '#f9d93b',
  bodyDark: '#eabf22',
  belly: '#fff3cf',
  limb: '#9a8e46',
  limbDark: '#787033',
  sclera: '#eef8dc',
  pupil: '#1e2418',
  mouth: '#8d3b34',
  tongue: '#e2797f',
  spots: 'rgba(74,66,40,0.88)',
};

/**
 * 一张奶蛙脸：圆脑袋 + 两只凸起的圆眼 + 大笑的嘴。
 * 调用前先把坐标系挪到「脑袋中心」，r 是脑袋半径（主头 30，副头按比例缩小）。
 */
function frogFace(ctx, r, t, phase, opt = {}) {
  const { body, bodyDark, blink = 1, open = 0.5 } = opt;

  const g = ctx.createLinearGradient(0, -r, 0, r * 0.9);
  g.addColorStop(0, mix(body, '#ffffff', 0.26));
  g.addColorStop(1, bodyDark);
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, r, r * 0.94);
  ctx.fill();

  // 大嘴：张开度跟着呼吸和开火变
  const mw = r * 0.8;
  const top = r * 0.1;
  const deep = r * (0.34 + 0.24 * open);
  ctx.fillStyle = FROG.mouth;
  ctx.beginPath();
  ctx.moveTo(-mw, top);
  ctx.quadraticCurveTo(0, top + deep * 1.7, mw, top);
  ctx.quadraticCurveTo(0, top - r * 0.22, -mw, top);
  ctx.closePath();
  ctx.fill();
  // 舌头
  ctx.fillStyle = FROG.tongue;
  ellipse(ctx, 0, top + deep * 0.72, mw * 0.46, deep * 0.36);
  ctx.fill();
  // 两颗小门牙
  ctx.fillStyle = '#ffffff';
  rr(ctx, -r * 0.22, top - r * 0.02, r * 0.17, r * 0.15, r * 0.05);
  ctx.fill();
  rr(ctx, r * 0.05, top - r * 0.02, r * 0.17, r * 0.15, r * 0.05);
  ctx.fill();
  // 两个嘴角的笑纹
  ctx.strokeStyle = 'rgba(140,110,40,0.5)';
  ctx.lineWidth = Math.max(1.4, r * 0.055);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * mw, top + r * 0.05, r * 0.16, -Math.PI * 0.5, Math.PI * 0.5, dir < 0);
    ctx.stroke();
  }

  // 凸起的圆眼：眼白泛绿，瞳孔是小黑点，两只都朝右边看（奶龙来的方向）
  for (const dir of [-1, 1]) {
    const ex = dir * r * 0.57;
    const ey = -r * 0.55;
    const er = r * 0.5;
    if (blink < 0.12) {
      ctx.strokeStyle = FROG.pupil;
      ctx.lineWidth = Math.max(2, r * 0.085);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.75, ey);
      ctx.lineTo(ex + er * 0.75, ey);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = FROG.sclera;
    ellipse(ctx, ex, ey, er, er * (0.86 + 0.14 * blink));
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,138,74,0.5)';
    ctx.lineWidth = Math.max(1.3, r * 0.045);
    ctx.stroke();
    ctx.fillStyle = FROG.pupil;
    ellipse(ctx, ex + er * 0.26, ey + er * 0.08, er * 0.24, er * 0.28);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ellipse(ctx, ex + er * 0.42, ey - er * 0.16, er * 0.11, er * 0.13);
    ctx.fill();
  }
}

/** 冰镇蛙的头冠：几根冰锥从眼睛后面竖起来 + 一层寒气 */
function drawIceSpikes(ctx, t, phase) {
  ctx.save();
  const spikes = [
    [-26, -90, 16, 14],
    [-9, -96, 24, 18],
    [11, -96, 22, 16],
    [27, -90, 14, 12],
  ];
  for (const [sx, base, h, w] of spikes) {
    const g = ctx.createLinearGradient(0, base, 0, base - h);
    g.addColorStop(0, 'rgba(146,213,244,0.95)');
    g.addColorStop(1, 'rgba(241,252,255,0.98)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, base);
    ctx.lineTo(sx, base - h);
    ctx.lineTo(sx + w / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,196,238,0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 5 + phase);
  ctx.fillStyle = '#9fe3ff';
  ctx.beginPath();
  ctx.arc(0, -52, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFrog(ctx, o) {
  const { x, y, t = 0, scale = 1 } = o;
  const kind = o.kind || 'shooter';
  const look = o.look || kind;
  const phase = o.phase || 0;
  const damage = o.damage || 0;
  // 每张卡保留自己的颜色身份：身体底色往卡牌色偏一点点（不能多，奶蛙的招牌黄要留住），
  // 真正拉开区分度的是肚皮颜色、手里的道具和头顶的饰物
  const accent = o.accent || '#4fb7e8';
  const belly = o.tint || FROG.belly;
  const body = mix(FROG.body, accent, 0.06);
  const bodyDark = mix(FROG.bodyDark, accent, 0.1);
  const bob = Math.sin(t * 2.8 + phase) * 2.2;
  // 奶蛙的日常表情就是笑：呼吸之间嘴一开一合，开火时张到最大
  const openAt = (off) => (o.firing ? 1 : 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.6 + phase + off)));
  const blinkAt = (off) => 0.5 + 0.5 * Math.sin(t * 1.7 + phase * 2.3 + off);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (1 + (o.pop || 0) * 0.12), scale * (1 - (o.pop || 0) * 0.06));
  shadow(ctx, 0, 27, 9);
  ctx.translate(0, bob);

  // 冰镇蛙的冰锥先画：下半截会被身子和眼睛压住，只露出头顶那几根
  if (look === 'ice') drawIceSpikes(ctx, t, phase);

  // 细长的腿 + 大脚掌
  ctx.strokeStyle = FROG.limb;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 12, -30);
    ctx.quadraticCurveTo(dir * 21, -18, dir * 18, -5);
    ctx.stroke();
  }
  ctx.fillStyle = FROG.limbDark;
  for (const dir of [-1, 1]) {
    ellipse(ctx, dir * 18, -3, 11, 5);
    ctx.fill();
  }

  // 梨形身子
  const bg = ctx.createLinearGradient(0, -68, 0, -10);
  bg.addColorStop(0, mix(body, '#ffffff', 0.26));
  bg.addColorStop(1, bodyDark);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-28, -30);
  ctx.bezierCurveTo(-34, -48, -30, -62, -17, -69);
  ctx.bezierCurveTo(-6, -74, 6, -74, 17, -69);
  ctx.bezierCurveTo(30, -62, 34, -48, 28, -30);
  ctx.bezierCurveTo(18, -14, -18, -14, -28, -30);
  ctx.closePath();
  ctx.fill();

  // 大块奶油色肚皮
  ctx.fillStyle = belly;
  ellipse(ctx, 3, -34, 19, 21);
  ctx.fill();

  // 奶牛蛙：身上两块奶牛斑
  if (o.badge === 'cow') {
    ctx.fillStyle = FROG.spots;
    ellipse(ctx, -23, -44, 7, 5.4, -0.35);
    ctx.fill();
    ellipse(ctx, 24, -40, 6, 4.6, 0.4);
    ctx.fill();
  }

  // 三头蛙：两只小脑袋从主头两侧往上探出来（照奶龙合体的排法，一眼就懂是「三头」）
  if (look === 'triple') {
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(dir * 36, -94);
      frogFace(ctx, 18, t, phase + dir, {
        body,
        bodyDark,
        blink: blinkAt(dir > 0 ? 3.1 : 1.6),
        open: openAt(dir > 0 ? 1.4 : 2.2),
      });
      ctx.restore();
    }
  }

  // 主头
  ctx.save();
  ctx.translate(0, -74);
  frogFace(ctx, 30, t, phase, { body, bodyDark, blink: blinkAt(0), open: openAt(0) });
  ctx.restore();

  // 道具先摆好，手再盖上去，看起来才像真的握着
  const bottle = (bx, by, rot, sc) => drawMilkBottle(ctx, bx, by, sc, rot, { ice: look === 'ice' });
  if (look === 'repeater') {
    bottle(31, -52, -0.3, 0.95);
    bottle(37, -38, -0.1, 0.95);
  } else if (kind === 'shooter') {
    bottle(33, -47, -0.25, 1.05);
  } else if (look === 'mom') {
    // 小奶桶
    ctx.fillStyle = '#cfd9e2';
    rr(ctx, 23, -40, 17, 21, 3);
    ctx.fill();
    ctx.fillStyle = '#eef4f9';
    rr(ctx, 23, -43, 17, 5, 2.5);
    ctx.fill();
  }

  // 两条又细又长的手臂：左手永远捧着肚子（奶蛙的招牌动作）
  ctx.strokeStyle = FROG.limb;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-28, -56);
  ctx.quadraticCurveTo(-41, -47, -20, -39);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, -56);
  if (look === 'mom') ctx.quadraticCurveTo(39, -50, 31, -38);
  else if (look === 'repeater') ctx.quadraticCurveTo(40, -54, 35, -44);
  else ctx.quadraticCurveTo(39, -52, 33, -44);
  ctx.stroke();
  // 手掌
  ctx.fillStyle = FROG.limbDark;
  ellipse(ctx, -19, -39, 6, 5);
  ctx.fill();
  if (look === 'mom') ellipse(ctx, 31, -38, 6, 5);
  else if (look === 'repeater') ellipse(ctx, 35, -44, 6, 5);
  else if (kind === 'shooter') ellipse(ctx, 33, -44, 6, 5);
  ctx.fill();

  if (o.firing && kind === 'shooter') {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = look === 'ice' ? '#d6f2ff' : '#ffffff';
    ellipse(ctx, 46, -48, 11, 7);
    ctx.fill();
    ctx.restore();
  }

  // 产奶光环
  if (look === 'mom') {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3 + phase);
    ctx.strokeStyle = '#fff6c9';
    ctx.lineWidth = 2.5;
    ellipse(ctx, 0, -40, 32 + Math.sin(t * 3) * 3, 26 + Math.sin(t * 3) * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 冰镇蛙的冷气雪花
  if (look === 'ice') {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const a = t * 1.6 + (i / 5) * Math.PI * 2;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4 + i);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 30, -52 + Math.sin(a * 1.3) * 24, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  overlay(ctx, (c) => ellipse(c, 0, -50, 29, 40), '#ff4d4d', damage * 0.42);
  ctx.restore();
}


// ------------------------------------------------------------------ 奶罐墙

export function drawMilkCan(ctx, o) {
  const { x, y, t = 0, scale = 1 } = o;
  const hp = o.hpRatio ?? 1;
  const damage = 1 - hp;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  shadow(ctx, 0, 30, 10);

  const g = ctx.createLinearGradient(-30, 0, 26, 0);
  g.addColorStop(0, '#b9c6d2');
  g.addColorStop(0.45, '#f2f7fb');
  g.addColorStop(1, '#9dadbb');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-26, -8);
  ctx.lineTo(-21, -62);
  ctx.lineTo(21, -62);
  ctx.lineTo(26, -8);
  ctx.quadraticCurveTo(0, -2, -26, -8);
  ctx.closePath();
  ctx.fill();

  // 桶身环
  ctx.strokeStyle = 'rgba(120,140,160,0.65)';
  ctx.lineWidth = 2;
  for (const yy of [-24, -40]) {
    ctx.beginPath();
    ctx.moveTo(-24, yy);
    ctx.lineTo(24, yy);
    ctx.stroke();
  }
  // 顶盖
  ctx.fillStyle = '#dfe8f0';
  rr(ctx, -25, -72, 50, 12, 5);
  ctx.fill();
  ctx.fillStyle = '#f7fbff';
  rr(ctx, -9, -78, 18, 7, 3);
  ctx.fill();
  // 提手
  ctx.strokeStyle = '#9dadbb';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-27, -38, 8, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(27, -38, 8, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  // 表情
  const blink = 0.5 + 0.5 * Math.sin(t * 1.4 + (o.phase || 0));
  eyed(ctx, -9, -44, 4.6, -1, blink);
  eyed(ctx, 9, -44, 4.6, -1, blink);
  blush(ctx, -17, -36, 5);
  blush(ctx, 17, -36, 5);
  ctx.strokeStyle = '#5c6b78';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (damage > 0.55) {
    ctx.arc(0, -32, 6, Math.PI * 1.1, Math.PI * 1.9);
  } else {
    ctx.arc(0, -34, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();

  // 裂纹
  if (damage > 0.3) {
    ctx.strokeStyle = 'rgba(70,90,105,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -60);
    ctx.lineTo(-2, -48);
    ctx.lineTo(-10, -38);
    ctx.stroke();
  }
  if (damage > 0.6) {
    ctx.beginPath();
    ctx.moveTo(16, -20);
    ctx.lineTo(8, -30);
    ctx.lineTo(15, -42);
    ctx.stroke();
  }
  overlay(ctx, (c) => ellipse(c, 0, -40, 26, 34), '#ff4d4d', Math.min(0.4, damage * 0.5));
  ctx.restore();
}

// ------------------------------------------------------------------ 奶泡炸弹

export function drawMilkBomb(ctx, o) {
  const { x, y, t = 0, scale = 1 } = o;
  const fuse = Math.max(0, Math.min(1, o.fuseRatio ?? 1));
  const pulse = 1 + (1 - fuse) * 0.16 * Math.sin(t * 26);
  ctx.save();
  ctx.translate(x, y - 30);
  ctx.scale(scale * pulse, scale * pulse);
  shadow(ctx, 30, 26, 8, 0.14);

  const g = ctx.createRadialGradient(-9, -12, 4, 0, 0, 34);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.55, 'rgba(226,246,255,0.9)');
  g.addColorStop(1, 'rgba(168,222,255,0.72)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 反光
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, -11, -12, 7, 5, -0.6);
  ctx.fill();
  ellipse(ctx, 8, 12, 3.5, 2.5);
  ctx.fill();
  ctx.restore();

  // 引线
  ctx.strokeStyle = '#b98a4e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, -28);
  ctx.quadraticCurveTo(22, -42, 12, -50);
  ctx.stroke();
  const sparkS = 1 + 0.4 * Math.sin(t * 22);
  ctx.fillStyle = fuse < 0.4 ? '#ffd166' : '#ffb703';
  ctx.beginPath();
  ctx.arc(12, -51, 5 * sparkS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(12, -51, 2.4 * sparkS, 0, Math.PI * 2);
  ctx.fill();

  // 表情
  eyed(ctx, -10, -2, 4.4, -1, 1);
  eyed(ctx, 10, -2, 4.4, -1, 1);
  ctx.strokeStyle = '#5aa6cf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 6, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ 推车

export function drawMower(ctx, o) {
  const { x, y, spin = 0 } = o;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 4, 26, 7, 0.22);
  // 车身
  ctx.fillStyle = '#ff8f4d';
  rr(ctx, -24, -34, 48, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd08a';
  rr(ctx, -20, -30, 20, 12, 4);
  ctx.fill();
  // 大奶瓶
  drawMilkBottle(ctx, 2, -48, 1.15, -0.15, {});
  // 轮子
  ctx.fillStyle = '#3c4650';
  for (const wx of [-14, 14]) {
    ctx.save();
    ctx.translate(wx, -4);
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aebcc8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 奶龙

export function drawDragon(ctx, o) {
  const { x, y, scale = 1, t = 0 } = o;
  const pal = o.palette || { body: '#f6bc22', dark: '#d0911a', belly: '#fffaea', horn: '#ff9a3c' };
  const walk = o.walk || 0;
  const step = Math.sin(walk * 2.2);
  const sway = Math.sin(walk * 1.1) * 1.6;
  const eating = Boolean(o.eating);
  const chomp = eating ? Math.abs(Math.sin(t * 9)) : 0;
  const hp = o.hpRatio ?? 1;
  const type = o.type || 'baby';

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (o.dead) {
    const k = Math.min(1, (o.deathT || 0) / 0.75);
    ctx.globalAlpha = 1 - k;
    ctx.rotate(k * 0.9);
    ctx.translate(0, k * 10);
  }
  shadow(ctx, -2, 30, 9, 0.2);

  const dark = mix(pal.dark, '#2a2f38', hp < 0.7 ? 0.1 * (1 - hp) : 0);
  const body = mix(pal.body, '#5c6a72', hp < 0.7 ? 0.12 * (1 - hp) : 0);
  // 奶龙和奶蛙都是黄的，靠一圈深色描边把「敌方」的轮廓钉出来（植物/僵尸那种区分方式）
  const outline = mix(pal.dark, '#452805', 0.68);
  const line = (w) => {
    ctx.strokeStyle = outline;
    ctx.lineWidth = w;
    ctx.stroke();
  };

  // 尾巴
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(16, -30);
  ctx.quadraticCurveTo(46 + sway * 3, -22 + Math.sin(walk * 2) * 4, 62, -44 + sway * 2);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.fillStyle = pal.horn;
  ctx.beginPath();
  ctx.moveTo(60, -46 + sway * 2);
  ctx.lineTo(78, -56 + sway * 2);
  ctx.lineTo(62, -30 + sway * 2);
  ctx.closePath();
  ctx.fill();
  line(2);
  ctx.restore();

  // 翅膀
  const flap = Math.sin(t * 4 + walk) * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = mix(dark, '#ffffff', 0.18);
  ctx.beginPath();
  ctx.moveTo(6, -56);
  ctx.quadraticCurveTo(30, -74 + flap * 8, 40, -50 + flap * 10);
  ctx.quadraticCurveTo(24, -46, 6, -56);
  ctx.closePath();
  ctx.fill();
  line(2);
  ctx.restore();

  // 腿
  ctx.fillStyle = dark;
  rr(ctx, -16 + step * 2, -22, 15, 22, 6);
  ctx.fill();
  line(2);
  rr(ctx, 4 - step * 2, -22, 15, 22, 6);
  ctx.fill();
  line(2);
  ctx.fillStyle = mix(dark, '#ffffff', 0.25);
  ellipse(ctx, -9 + step * 2, -3, 9, 5);
  ctx.fill();
  line(1.8);
  ellipse(ctx, 11 - step * 2, -3, 9, 5);
  ctx.fill();
  line(1.8);

  // 身体
  const bg = ctx.createLinearGradient(0, -80, 0, -10);
  bg.addColorStop(0, mix(body, '#ffffff', 0.12));
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ellipse(ctx, 0, -46 + sway * 0.4, 25, 31);
  ctx.fill();
  line(2.8);
  ctx.fillStyle = pal.belly;
  ellipse(ctx, -6, -42 + sway * 0.4, 14, 21);
  ctx.fill();

  // 背刺
  ctx.fillStyle = pal.horn;
  for (let i = 0; i < 3; i++) {
    const bx = 6 + i * 9;
    const by = -70 + i * 7;
    ctx.beginPath();
    ctx.moveTo(bx, by + 8);
    ctx.lineTo(bx + 6, by - (type === 'boss' ? 12 : 8));
    ctx.lineTo(bx + 12, by + 8);
    ctx.closePath();
    ctx.fill();
    line(1.8);
  }

  // 手臂
  ctx.fillStyle = body;
  ellipse(ctx, -18, -52 + chomp * 2, 8, 10, -0.4);
  ctx.fill();
  line(2);
  ellipse(ctx, 8, -58, 8, 10, 0.4);
  ctx.fill();
  line(2);

  // 头（合体过的奶龙会多长几个头，见下面 heads 循环）
  const hy = -74 + sway * 0.5 + chomp * 3;

  const drawHead = (fx, fy, s, main) => {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(s, s);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    line(2.6);
    // 吻部
    ctx.fillStyle = mix(body, '#ffffff', 0.1);
    ellipse(ctx, -22, 6, 15, 11, -0.12);
    ctx.fill();
    // 鼻孔
    ctx.fillStyle = 'rgba(40,60,55,0.7)';
    ellipse(ctx, -31, 2, 2.1, 1.6);
    ctx.fill();
    ellipse(ctx, -26, 3.4, 2.1, 1.6);
    ctx.fill();
    // 嘴
    ctx.strokeStyle = 'rgba(35,55,50,0.75)';
    ctx.lineWidth = 2;
    if (eating && chomp > 0.35 && main) {
      ctx.fillStyle = '#7a3b46';
      ellipse(ctx, -20, 12, 8, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-25, 8);
      ctx.lineTo(-21, 13);
      ctx.lineTo(-17, 8);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(-20, 4, 9, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // 眼睛
    const look = eating ? 0 : -0.6;
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, -4, -6, 7.6, 8.4);
    ctx.fill();
    line(1.6);
    ellipse(ctx, 12, -6, 6.2, 7);
    ctx.fill();
    line(1.6);
    const pupil = type === 'boss' ? '#c62828' : '#20262b';
    ctx.fillStyle = pupil;
    ellipse(ctx, -6 + look * 2.5, -5, 3.7, 4.2);
    ctx.fill();
    ellipse(ctx, 10 + look * 2.5, -5, 3.1, 3.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ellipse(ctx, -7.5 + look * 2.5, -7, 1.5, 1.5);
    ctx.fill();
    ellipse(ctx, 8.6 + look * 2.5, -7, 1.2, 1.2);
    ctx.fill();

    // 角
    ctx.fillStyle = pal.horn;
    drawHorn(ctx, -8, -20, -1);
    drawHorn(ctx, 12, -20, 1);

    // 头饰（多头的副头不再戴帽子，免得糊成一团）
    if (main) {
      if (type === 'cone') drawConeHat(ctx);
      if (type === 'armor') drawBucketHelmet(ctx);
      if (type === 'boss') drawCrown(ctx);
      if (type === 'fast') {
        // 汗滴
        ctx.fillStyle = '#9fdcff';
        ctx.beginPath();
        ctx.arc(18, -26, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(24, -18, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // 合体层数 → 头数（1 层合体 = 双头，最多 4 头）
  const heads = Math.max(1, Math.min(4, (o.fuse || 0) + 1));
  for (let h = heads - 1; h >= 1; h--) {
    const dir = h % 2 === 1 ? -1 : 1;
    const ring = Math.floor((h + 1) / 2);
    drawHead(-4 + dir * (30 + ring * 8), hy - 26 - ring * 7, 0.82 - ring * 0.05, false);
  }
  drawHead(-4, hy, 1, true);

  // 冲刺龙的围巾
  if (type === 'fast') {
    ctx.strokeStyle = '#e4574f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, -68);
    ctx.quadraticCurveTo(30, -74 + Math.sin(t * 8) * 6, 50, -66 + Math.sin(t * 8) * 8);
    ctx.stroke();
    ctx.fillStyle = '#e4574f';
    ellipse(ctx, 2, -68, 8, 6);
    ctx.fill();
  }

  // 冰冻 / 受伤
  if (o.slow) {
    overlay(ctx, (c) => ellipse(c, 0, -52, 34, 44), '#bfe9ff', 0.4);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#eafaff';
    for (const [sx, sy, r] of [[-26, -60, 5], [16, -34, 4]]) {
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 冰霜叠层：脚下结霜，叠满会被冻结
  if (o.frost > 0 && !o.freeze) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * o.frost;
    ctx.fillStyle = '#dff4ff';
    ctx.strokeStyle = '#9fdcff';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < o.frost; i++) {
      ctx.beginPath();
      ctx.arc(-26 + i * 24, -2, 6 - i * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 冻结：整只被冰封
  if (o.freeze > 0) {
    ctx.save();
    const k = Math.min(1, o.freeze * 1.4);
    ctx.globalAlpha = 0.3 + 0.28 * k;
    ctx.fillStyle = '#bfe9ff';
    rr(ctx, -40, -106, 86, 110, 18);
    ctx.fill();
    ctx.globalAlpha = 0.55 + 0.35 * k;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-40, -106);
    ctx.lineTo(-6, -74);
    ctx.lineTo(-40, -34);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#eafaff';
    ctx.lineWidth = 2.5;
    rr(ctx, -40, -106, 86, 110, 18);
    ctx.stroke();
    ctx.restore();
  }

  // 吞噬成长：吃掉奶蛙后变强，身上冒出怒气光环
  if (o.grow > 0) {
    const n = Math.min(3, o.grow);
    ctx.save();
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.26 + 0.16 * Math.sin(t * 3 + i * 0.9);
      ctx.strokeStyle = i === 0 ? '#ff8a5c' : '#ff5f5f';
      ctx.lineWidth = 3.2;
      ellipse(ctx, 0, -52, 31 + i * 7, 42 + i * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < n; i++) {
      const fx = -4 + (i - (n - 1) / 2) * 13;
      const h = 14 + i * 2 + Math.sin(t * 7 + i) * 2.5;
      const fg = ctx.createLinearGradient(fx, -104, fx, -104 - h);
      fg.addColorStop(0, '#ffd166');
      fg.addColorStop(1, 'rgba(255,80,60,0.15)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - 4.5, -100);
      ctx.quadraticCurveTo(fx, -104 - h, fx + 4.5, -100);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 合体 / 狂暴 / 吸血：精英与合体形态的状态提示
  if (o.fuse > 0) drawFusedAura(ctx, t, o.fuse);
  if (o.berserk) drawBerserk(ctx, t);
  if (o.leech) drawLeech(ctx, t);

  if (o.flash > 0.02) {
    overlay(ctx, (c) => ellipse(c, 0, -52, 34, 44), '#ffffff', o.flash * 0.55);
  }
  ctx.restore();
}

/** 精英「狂暴」：血少了会烧起来的怒气环 */
function drawBerserk(ctx, t) {
  ctx.save();
  const pulse = 0.6 + 0.4 * Math.sin(t * 9);
  ctx.globalAlpha = 0.34 + 0.22 * pulse;
  ctx.strokeStyle = '#ff4d3d';
  ctx.lineWidth = 4;
  ellipse(ctx, 0, -54, 34 + pulse * 5, 46 + pulse * 6);
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#ff6b4a';
  ellipse(ctx, 0, -54, 30, 42);
  ctx.fill();
  ctx.restore();
}

/** 精英「吸血」：刚啃到奶蛙时冒出的绿色心形脉冲 */
function drawLeech(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#8ee08a';
  for (let i = 0; i < 3; i++) {
    const k = (t * 2.2 + i * 0.33) % 1;
    const x = -20 + i * 20;
    const y = -96 - k * 30;
    ctx.globalAlpha = 0.75 * (1 - k);
    ctx.beginPath();
    ctx.arc(x, y, 6 - k * 3, 0, Math.PI * 2);
    ctx.arc(x, y - 3, 4 - k * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, -66);
  ctx.lineTo(-9, -78);
  ctx.lineTo(9, -78);
  ctx.closePath();
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.restore();
}

/** 合体过的奶龙：身下多一层紫色光环，一眼能看出「这只不一样」 */
function drawFusedAura(ctx, t, fuse) {
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.14 * Math.sin(t * 3);
  ctx.strokeStyle = '#c9a7ff';
  ctx.lineWidth = 3.4;
  for (let i = 0; i < fuse; i++) {
    ellipse(ctx, 0, -50, 34 + i * 8, 46 + i * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#b07ff0';
  ellipse(ctx, 0, -50, 30 + fuse * 7, 42 + fuse * 9);
  ctx.fill();
  ctx.restore();
}

function drawHorn(ctx, hx, hy, dir) {
  ctx.beginPath();
  ctx.moveTo(hx, hy + 10);
  ctx.quadraticCurveTo(hx + dir * 8, hy - 6, hx + dir * 14, hy - 2);
  ctx.quadraticCurveTo(hx + dir * 8, hy + 6, hx + dir * 2, hy + 12);
  ctx.closePath();
  ctx.fill();
}

function drawConeHat(ctx) {
  ctx.save();
  ctx.translate(0, -22);
  ctx.fillStyle = '#fdfdfd';
  ctx.beginPath();
  ctx.moveTo(-19, 0);
  ctx.lineTo(0, -34);
  ctx.lineTo(19, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e4574f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.lineTo(11, -14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.lineTo(9, -26);
  ctx.stroke();
  ctx.fillStyle = '#e9eef2';
  ellipse(ctx, 0, 0, 19, 5);
  ctx.fill();
  ctx.restore();
}

function drawBucketHelmet(ctx) {
  ctx.save();
  ctx.translate(0, -24);
  const g = ctx.createLinearGradient(-22, 0, 22, 0);
  g.addColorStop(0, '#8d99a5');
  g.addColorStop(0.5, '#dbe4ec');
  g.addColorStop(1, '#7f8b97');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-20, 4);
  ctx.lineTo(-15, -30);
  ctx.lineTo(15, -30);
  ctx.lineTo(20, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eef4f9';
  ellipse(ctx, 0, 4, 21, 6);
  ctx.fill();
  ctx.fillStyle = '#6f7b87';
  for (const rx of [-10, 0, 10]) {
    ctx.beginPath();
    ctx.arc(rx, -20, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(70,80,90,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, -12);
  ctx.lineTo(-2, -6);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.restore();
}

function drawCrown(ctx) {
  ctx.save();
  ctx.translate(0, -30);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(-20, 6);
  ctx.lineTo(-20, -10);
  ctx.lineTo(-10, -1);
  ctx.lineTo(0, -16);
  ctx.lineTo(10, -1);
  ctx.lineTo(20, -10);
  ctx.lineTo(20, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e4574f';
  ctx.beginPath();
  ctx.arc(0, 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mix(hexA, hexB, k) {
  if (!k) return hexA;
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * k);
  const g = Math.round(a[1] + (b[1] - a[1]) * k);
  const bl = Math.round(a[2] + (b[2] - a[2]) * k);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/\d+/g);
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// ------------------------------------------------------------------ 奶滴 / 星星

export function drawMilkDrop(ctx, o) {
  const { x, y, t = 0, scale = 1 } = o;
  const pulse = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * pulse, scale * pulse);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff8d8';
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.rotate(Math.sin(t * 1.6) * 0.15);
  drawMilkBottle(ctx, 0, 0, 1.25, 0, { ice: o.ice });
  ctx.restore();
}

export function drawBadge(ctx, x, y, text, size = 12, bg = 'rgba(255,255,255,0.9)', fg = '#2b3b46') {
  ctx.save();
  ctx.font = `700 ${size}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`;
  const w = ctx.measureText(text).width + size * 0.9;
  const h = size * 1.55;
  ctx.fillStyle = bg;
  rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/** 特殊地块：奶泉地的泉眼 / 冰晶地的冰簇 */
export function drawTileMark(ctx, o) {
  const { x, y, kind, t = 0, pulse = 0 } = o;
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'spring') {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.22 * Math.sin(t * 2.4 + pulse);
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 2; i++) {
      ellipse(ctx, 0, 0, 22 + i * 11, 13 + i * 6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,252,225,0.92)';
    ellipse(ctx, 0, 0, 13, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ellipse(ctx, 0, -3, 5, 4);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.6 + (i / 3) * Math.PI * 2 + pulse;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 17, -Math.abs(Math.sin(a)) * 10 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'frost') {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 2.2 + pulse);
    ctx.strokeStyle = '#dff4ff';
    ctx.lineWidth = 2.4;
    ellipse(ctx, 0, 0, 24, 13);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * 11;
      const h = 12 + i * 3;
      ctx.fillStyle = 'rgba(224,246,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(sx - 5, 2);
      ctx.lineTo(sx, -h);
      ctx.lineTo(sx + 5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,200,240,0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export { rr, ellipse, mix };
