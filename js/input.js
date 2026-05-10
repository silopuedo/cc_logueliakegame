// ================================================================
//  input.js — 输入系统
// ================================================================
// 把玩家的物理操作（按键/触摸）转换成游戏可理解的"方向指令"。
// 这样游戏逻辑就不需要关心玩家是用键盘还是触屏了 ——
// 这就是"抽象"的基本概念。
// ================================================================

// ---- 键盘状态 ----
const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;

  // 升级面板打开时，数字键 1/2/3 快速选择
  if (upgrading && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault();
    const cards = upgradeChoices.children;
    const idx = parseInt(e.key) - 1;
    if (cards[idx]) cards[idx].click();
    return;
  }

  // 游戏中按 Escape 暂停
  if (gameState === 'playing') {
    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
    // P1 技能
    const p1 = players[0];
    if (p1 && p1.skillKey && e.key.toLowerCase() === p1.skillKey.toLowerCase() && p1.skillCD <= 0 && !p1.downed) {
      useSkill(0);
    }
    // P2 技能
    const p2 = players[1];
    if (p2 && p2.skillKey && e.key.toLowerCase() === p2.skillKey.toLowerCase() && p2.skillCD <= 0 && !p2.downed) {
      useSkill(1);
    }
  }

  // 防止方向键滚动页面
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

// ---- 触屏摇杆状态 ----
let touches = [
  { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 },
  { active: false, id: -1, sx: 0, sy: 0, dx: 0, dy: 0 },
];
let jAreas = [$('jArea1'), $('jArea2')];

// ---- 触屏：触摸开始 ----
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameState !== 'playing' || paused) return;
  for (const t of e.changedTouches) {
    let slot = -1;
    for (let i = 0; i < 2; i++) { if (!touches[i].active) { slot = i; break; } }
    if (slot === -1) break;
    const side = t.clientX < window.innerWidth * .5 ? 0 : 1;
    let useSlot = slot;
    if (!touches[side].active) useSlot = side;
    if (touches[useSlot].active) break;

    touches[useSlot].active = true;
    touches[useSlot].id = t.identifier;
    touches[useSlot].sx = t.clientX;
    touches[useSlot].sy = t.clientY;
    touches[useSlot].dx = 0;
    touches[useSlot].dy = 0;

    const sz = Math.min(120, window.innerWidth * .2);
    const ja = jAreas[useSlot];
    ja.style.width = sz + 'px';
    ja.style.height = sz + 'px';
    ja.style.display = 'block';
    ja.style.left = (t.clientX - sz / 2) + 'px';
    ja.style.top = (t.clientY - sz / 2) + 'px';
    const knob = ja.querySelector('.jKnob');
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  }
}, { passive: false });

// ---- 触屏：滑动中 ----
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    for (let i = 0; i < 2; i++) {
      if (touches[i].active && t.identifier === touches[i].id) {
        const ja = jAreas[i];
        const maxR = ja.offsetWidth * .35;
        let dx = t.clientX - touches[i].sx;
        let dy = t.clientY - touches[i].sy;
        const d = Math.hypot(dx, dy);
        if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }
        touches[i].dx = d > 3 ? dx / maxR : 0;
        touches[i].dy = d > 3 ? dy / maxR : 0;
        const knob = ja.querySelector('.jKnob');
        if (knob) knob.style.transform = `translate(${-50 + dx / maxR * 45}%, ${-50 + dy / maxR * 45}%)`;
        break;
      }
    }
  }
}, { passive: false });

// ---- 触屏：触摸结束 ----
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    for (let i = 0; i < 2; i++) {
      if (touches[i].active && t.identifier === touches[i].id) {
        touches[i].active = false;
        touches[i].id = -1;
        touches[i].dx = 0;
        touches[i].dy = 0;
        jAreas[i].style.display = 'none';
        const knob = jAreas[i].querySelector('.jKnob');
        if (knob) knob.style.transform = 'translate(-50%,-50%)';
        break;
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  for (let i = 0; i < 2; i++) {
    touches[i].active = false;
    touches[i].id = -1;
    touches[i].dx = 0;
    touches[i].dy = 0;
    jAreas[i].style.display = 'none';
  }
}, { passive: false });

// ---- 获取玩家移动方向 ----
// 核心函数：把键盘状态 + 触屏状态 统一为 (mx, my, mag) 指令
function getInputDir(idx) {
  let mx = 0, my = 0;

  if (idx === 0) {
    // P1: WASD (单人模式时方向键也可用)
    if (keys['w'] || (keys['arrowup'] && !players[1])) my = -1;
    if (keys['s'] || (keys['arrowdown'] && !players[1])) my = 1;
    if (keys['a'] || (keys['arrowleft'] && !players[1])) mx = -1;
    if (keys['d'] || (keys['arrowright'] && !players[1])) mx = 1;
    if (gameMode === 'single') {
      if (keys['arrowup']) my = -1;
      if (keys['arrowdown']) my = 1;
      if (keys['arrowleft']) mx = -1;
      if (keys['arrowright']) mx = 1;
    }
  } else {
    // P2: 方向键
    if (keys['arrowup']) my = -1;
    if (keys['arrowdown']) my = 1;
    if (keys['arrowleft']) mx = -1;
    if (keys['arrowright']) mx = 1;
  }

  // 叠加触屏输入
  if (touches[idx] && touches[idx].active) {
    mx += touches[idx].dx;
    my += touches[idx].dy;
  }

  // 归一化：保证斜向移动速度不变
  const mag = Math.hypot(mx, my);
  if (mag > 0) { mx /= mag; my /= mag; }

  return { mx, my, mag };
}
