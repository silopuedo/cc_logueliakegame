// ================================================================
//  entity.js — 实体创建与管理
// ================================================================
// 实体(entity) = 游戏世界中能被互动的东西。
// 创建函数像工厂一样生产实体对象，update逻辑驱动它们的行为。
// 把创建和更新放在一起，方便追踪每个实体的完整生命周期。
// ================================================================

// ================================================================
//  1. 玩家 (Player)
// ================================================================

// 玩家工厂函数 —— 用配置参数生成一个玩家对象
function createPlayer(cfg, x, y, role) {
  const base = CFG.player;
  const p = {
    x, y,
    r: cfg.r || base.r,
    speed: cfg.speed || base.speed,
    hp: cfg.hp || base.hp,
    maxHp: cfg.maxHp || base.hp,
    dmg: cfg.dmg || 15,
    atkInt: cfg.atkInt || base.atkInt,
    cd: 0,             // 攻击冷却计时器
    proj: cfg.proj || 1,
    projSpd: cfg.projSpd || base.projSpd,
    pierce: cfg.pierce || 0,
    regen: cfg.regen || 1,
    magnet: cfg.magnet || 80,
    inv: 0,            // 受伤无敌时间
    role: role || null,
    armor: cfg.armor || 1,
    skillCD: 0,
    skillMaxCD: cfg.skillCD || 0,
    skillDur: 0,
    skillKey: cfg.skillKey || '',
    passiveTimer: 0,
    passiveStacks: 0,
    shield: 0,
    shieldMax: 0,
    shieldCDTimer: 0,
    downed: false,     // 倒地状态 (合作模式)
  };

  // 角色倍率叠加
  if (cfg.spMult)  { p.speed = Math.round(p.speed * cfg.spMult); }
  if (cfg.hpMult)  { p.maxHp = Math.round(p.maxHp * cfg.hpMult); p.hp = p.maxHp; }
  if (cfg.armorMult) p.armor = cfg.armorMult;
  if (cfg.skillCD)   p.skillMaxCD = cfg.skillCD;
  if (cfg.passive && cfg.passive.shieldCD) p.shieldCDTimer = cfg.passive.shieldCD;

  return p;
}

// ---- 模式初始化 ----

// 单人模式：1个玩家在屏幕中央
function initSingle() {
  players = [
    createPlayer({
      r:16, speed:280, hp:100, dmg:15, atkInt:.55,
      proj:1, projSpd:600, pierce:0, regen:1, magnet:80, armor:1
    }, W/2, H/2, null)
  ];
  upgLvs = {};
  CFG.upgrades.forEach(u => upgLvs[u.id] = 0);
  CFG.coopUpgrades.forEach(u => coopUpgLvs[u.id] = 0);
}

// 双人生存：2个普通玩家
function initSurvival() {
  players = [
    createPlayer({ r:16, speed:280, hp:100, dmg:15, atkInt:.55, proj:1, projSpd:600, pierce:0, regen:1, magnet:80, armor:1 }, W/3, H/2, null),
    createPlayer({ r:16, speed:280, hp:100, dmg:15, atkInt:.55, proj:1, projSpd:600, pierce:0, regen:1, magnet:80, armor:1 }, W*2/3, H/2, null),
  ];
  upgLvs = {};
  players.forEach((_, i) => { upgLvs[i] = {}; CFG.upgrades.forEach(u => upgLvs[i][u.id] = 0); });
  CFG.coopUpgrades.forEach(u => coopUpgLvs[u.id] = 0);
}

// 双人合作：冰守 + 烈焰
function initCooperative(roleArr) {
  const iceCfg = {
    r:18, speed:280, hp:200, dmg:12, atkInt:.65, proj:1, projSpd:500, pierce:0,
    regen:1.5, magnet:80, armor:1.5, spMult:.8, hpMult:2,
    skillCD:12, skillKey:' ', role:'ice',
    passive: { shieldCD:8, shieldPct:.2 }
  };
  const fireCfg = {
    r:14, speed:280, hp:70, dmg:22, atkInt:.45, proj:1, projSpd:700, pierce:1,
    regen:.5, magnet:80, armor:.5, spMult:1.2, hpMult:.7,
    skillCD:10, skillKey:'enter', role:'fire',
    passive: { killSpdBonus:.05, maxStacks:5, dur:3 }
  };

  players = [
    roleArr[0] === 'ice' ? createPlayer(iceCfg, W/3, H/2, 'ice') : createPlayer(fireCfg, W/3, H/2, 'fire'),
    roleArr[1] === 'ice' ? createPlayer(iceCfg, W*2/3, H/2, 'ice') : createPlayer(fireCfg, W*2/3, H/2, 'fire'),
  ];

  upgLvs = {};
  players.forEach((_, i) => { upgLvs[i] = {}; CFG.upgrades.forEach(u => upgLvs[i][u.id] = 0); });
  CFG.coopUpgrades.forEach(u => coopUpgLvs[u.id] = 0);
}

// 全局重置
function initGame() {
  enemies = [];
  projs = [];
  gems = [];
  parts = [];
  floatT = [];
  iceWalls = [];
  gameTime = 0;
  sharedLv = 1;
  sharedXp = 0;
  sharedXpTo = 12;
  kills = 0;
  spawnTimer = 0;
  bossSpawned = false;
  reviveTarget = null;
  reviveProgress = 0;
  waveShown = [];
  skillIndTimers = [0, 0];
  upgrading = false;
  levelingPlayerIdx = -1;
}

// ================================================================
//  2. 射击 & 子弹 (Projectile)
// ================================================================

// 朝目标发射子弹
function shoot(pl, target) {
  const a = ang(pl, target);
  const cnt = pl.proj;
  const spread = cnt > 1 ? .1 : 0;
  const off = cnt > 1 ? (cnt - 1) * spread / 2 : 0;

  for (let i = 0; i < cnt; i++) {
    const aa = a - off + i * spread;
    projs.push({
      x: pl.x, y: pl.y,
      vx: Math.cos(aa) * pl.projSpd,
      vy: Math.sin(aa) * pl.projSpd,
      dmg: pl.dmg,
      pierce: pl.pierce,
      hit: new Set(),     // 已命中敌人集合 (防止穿透重复伤害)
      r: 4,
      life: 1.8,          // 子弹存活时间 (秒)
      isIce: pl.role === 'ice',
      isFire: pl.role === 'fire',
      owner: pl,
    });
  }
  SND.shoot();
}

// ================================================================
//  3. 经验宝石 & 粒子 & 浮动文字
// ================================================================

// 掉落宝石 (怪物死亡时)
function spawnGem(x, y, amt) {
  const a = rand(0, Math.PI * 2);
  const d = rand(15, 40);
  gems.push({
    x: x + Math.cos(a) * d,
    y: y + Math.sin(a) * d,
    amt,
    r: 5 + Math.min(amt, 25) * .3,
    bob: rand(0, Math.PI * 2),  // 浮动动画偏移
  });
}

// 粒子爆发 (击中/爆炸特效)
function spawnParticles(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(spd * .3, spd);
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(.2, .45),
      maxL: rand(.2, .45),
      r: rand(1.5, 3.5),
      color,
    });
  }
}

// 浮动文字 (伤害/经验等)
function floatText(x, y, text, color) {
  floatT.push({ x, y, text, color, life: .7, maxL: .7, vy: -50 });
}

// ================================================================
//  4. 图形绘制辅助 (Shape Primitives)
// ================================================================
// 每种敌人/角色用不同形状来区分，不需要图片资源。
// 这些都是 Canvas 2D 的基础绘图命令。

function drawCircle(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

function drawDiamond(cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
}

function drawSquare(cx, cy, r) {
  ctx.beginPath();
  ctx.rect(cx - r, cy - r, r * 2, r * 2);
}

function drawTriangle(cx, cy, r, a) {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const aa = a - Math.PI / 2 + i * Math.PI * 2 / 3;
    const px = cx + Math.cos(aa) * r;
    const py = cy + Math.sin(aa) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawStar(cx, cy, r, ir, a) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const aa = a - Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : ir;
    const px = cx + Math.cos(aa) * rr;
    const py = cy + Math.sin(aa) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHexagon(cx, cy, r, a) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const aa = a + i * Math.PI / 3;
    const px = cx + Math.cos(aa) * r;
    const py = cy + Math.sin(aa) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// 绘制任意实体 (根据 type 选择形状)
function drawEntity(cx, cy, r, color, type, flash, extra) {
  ctx.save();
  // Boss 发光效果
  if (type === 'boss') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 + Math.sin((extra || 0) * 3) * 5;
  }
  // 阴影
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, r * .7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.fill();

  const col = flash > 0 ? '#fff' : color;
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 1.5;
  const a = extra || 0;

  switch (type) {
    case 'normal': drawCircle(cx, cy, r); break;
    case 'fast':   drawDiamond(cx, cy, r); break;
    case 'tank':   drawSquare(cx, cy, r); break;
    case 'boss':   drawStar(cx, cy, r, r * .5, a); break;
    case 'ice':    drawHexagon(cx, cy, r, a); break;
    case 'fire':   drawTriangle(cx, cy, r, a); break;
    case 'single': drawCircle(cx, cy, r); break;
    default:       drawCircle(cx, cy, r);
  }

  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// 子弹形状
function drawProjShape(x, y, r, isFire, isIce) {
  if (isFire) drawTriangle(x, y, r, Math.atan2(1, 0));
  else if (isIce) drawDiamond(x, y, r);
  else drawCircle(x, y, r);
}

// ================================================================
//  5. 辅助逻辑
// ================================================================

// 找最近的敌人
function nearestEnemy(pl) {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    const d = dist(pl, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// 冰墙碰撞检测
// 把敌人坐标旋转到冰墙本地坐标系，做 AABB 碰撞
function wallBlocks(w, ex, ey, er) {
  const cos = Math.cos(-w.angle), sin = Math.sin(-w.angle);
  const rx = (ex - w.x) * cos - (ey - w.y) * sin;
  const ry = (ex - w.x) * sin + (ey - w.y) * cos;
  const hw = w.w / 2, hh = w.h / 2;
  const cx = clamp(rx, -hw, hw);
  const cy = clamp(ry, -hh, hh);
  const dx = rx - cx, dy = ry - cy;
  return Math.hypot(dx, dy) < er;
}
