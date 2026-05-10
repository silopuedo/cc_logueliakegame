// ================================================================
//  game.js — 游戏核心
// ================================================================
// 这是游戏的大脑：管理全局状态，驱动更新逻辑，控制流程。
// update() 每帧执行一次，推动整个游戏世界向前走一步。
// update 里发生的事情：玩家移动 → 自动攻击 → 子弹飞行 →
// 敌人生成/移动/伤害 → 经验拾取 → 波次检查 → 游戏结束判定。
// ================================================================

// ================================================================
//  1. 全局游戏状态
// ================================================================

let W, H;                     // Canvas 尺寸
let gameState = 'menu';       // menu | playing | paused | gameover
let gameMode = null;          // single | survival | cooperative
let roles = [];               // 角色分配 ['ice','fire'] 或 ['fire','ice']

// 游戏世界中的所有实体
let players = [];
let enemies = [];
let projs = [];    // 子弹 (projectiles)
let gems = [];     // 经验宝石
let parts = [];    // 粒子 (particles)
let floatT = [];   // 浮动文字
let iceWalls = []; // 冰墙

// 游戏数据
let gameTime = 0;             // 已过去秒数
let sharedLv = 1;             // 合作模式共享等级
let sharedXp = 0;
let sharedXpTo = 12;
let kills = 0;
let spawnTimer = 0;           // 敌人生成倒计时
let bossSpawned = false;
let lastT = 0;                // 上一帧时间戳 (用于 dt 计算)
let paused = false;

// 升级
let upgLvs = {};              // 升级等级 { id: level } 或 { playerIdx: { id: level } }
let coopUpgLvs = {};          // 合作升级等级

// 技能
let skillIndTimers = [0, 0];  // 技能提示显示计时

// 复活
let reviveTarget = null;
let reviveProgress = 0;

// 波次
let waveShown = [];

// 升级面板状态
let upgrading = false;
let levelingPlayerIdx = -1;   // 谁在选升级 (生存模式)

// ================================================================
//  2. 主更新函数 (每帧调用)
// ================================================================

function update(dt) {
  // 如果正在选升级，暂停游戏逻辑
  if (gameState !== 'playing' || upgrading) return;

  gameTime += dt;

  // ---- 技能指示器计时 ----
  for (let i = 0; i < 2; i++) {
    if (skillIndTimers[i] > 0) {
      skillIndTimers[i] -= dt;
      if (skillIndTimers[i] <= 0) skillInd.style.display = 'none';
    }
  }

  // ---- 玩家更新 ----
  for (let i = 0; i < players.length; i++) {
    const pl = players[i];
    if (pl.downed) continue;

    // 移动
    const dir = getInputDir(i);
    if (dir.mag > 0) {
      pl.x += dir.mx * pl.speed * dt;
      pl.y += dir.my * pl.speed * dt;
    }
    pl.x = clamp(pl.x, pl.r, W - pl.r);
    pl.y = clamp(pl.y, pl.r, H - pl.r);

    // 无敌计时 & 回血
    if (pl.inv > 0) pl.inv -= dt;
    if (pl.hp < pl.maxHp) pl.hp = Math.min(pl.maxHp, pl.hp + pl.regen * dt);

    // 技能 CD
    if (pl.skillCD > 0) pl.skillCD -= dt;

    // 被动技能
    if (pl.role === 'ice') {
      // 冰守：自动生成护盾
      if (pl.shieldCDTimer > 0) {
        pl.shieldCDTimer -= dt;
        if (pl.shieldCDTimer <= 0) {
          pl.shield = Math.round(pl.maxHp * .2);
          pl.shieldMax = pl.shield;
          pl.shieldCDTimer = 8;
        }
      }
    }
    if (pl.role === 'fire') {
      // 烈焰：攻击速度堆叠
      if (pl.passiveStacks > 0) {
        pl.passiveTimer -= dt;
        if (pl.passiveTimer <= 0) pl.passiveStacks = 0;
      }
    }

    // 自动攻击 (朝最近的敌人射击)
    pl.cd -= dt;
    if (pl.cd <= 0) {
      const t = nearestEnemy(pl);
      if (t && dist(pl, t) < 700) {
        shoot(pl, t);
        pl.cd = pl.atkInt;
      } else {
        pl.cd = .1;  // 没有目标时短暂等待再检测
      }
    }
  }

  // ---- 子弹更新 ----
  for (let i = projs.length - 1; i >= 0; i--) {
    const b = projs[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // 超出范围或寿命耗尽
    if (b.life <= 0 || b.x < -150 || b.x > W + 150 || b.y < -150 || b.y > H + 150) {
      projs.splice(i, 1);
      continue;
    }

    let removed = false;

    // 子弹 vs 敌人碰撞
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (b.hit.has(e)) continue;      // 已命中 (穿透子弹)
      if (dist(b, e) < b.r + e.r) {
        b.hit.add(e);

        let dmg = b.dmg * (1 + rand(0, .1));  // ±10% 随机伤害

        // 元素效果
        if (b.isIce)  e.slowTimer = 2;           // 冰冻：减速
        if (b.isFire && e.slowTimer > 0) {       // 灼烧：需要先减速
          e.burnTimer = 3;
          e.burnDps = b.dmg * .3;
          dmg *= 1.5;
          floatText(e.x, e.y - 15, '🔥燃烧', '#f39c12');
        }

        e.hp -= dmg;
        e.flash = .07;
        spawnParticles(e.x, e.y, '#fff', 3, 50);
        SND.hit();

        // 敌人死亡
        if (e.hp <= 0) {
          kills++;

          // 烈焰射手击杀加攻速 (被动)
          if (b.owner && b.owner.role === 'fire' && b.owner.passiveStacks < 5) {
            b.owner.passiveStacks++;
            b.owner.passiveTimer = 3;
            b.owner.atkInt = Math.max(.15, b.owner.atkInt - .05 * b.owner.passiveStacks);
          }

          spawnParticles(e.x, e.y, e.color, 10, 100);
          const xpAmt = e.xp * (1 + (gameMode === 'cooperative' ? sharedLv : 1) * .02);
          spawnGem(e.x, e.y, xpAmt);
          floatText(e.x, e.y - 10, '+' + Math.floor(xpAmt) + 'XP', '#2ecc71');
          enemies.splice(j, 1);
        }

        // 穿透检查
        if (b.pierce <= 0) { projs.splice(i, 1); removed = true; break; }
        b.pierce--;
      }
    }
    if (removed) continue;
  }

  // ---- 敌人更新 ----
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // 状态效果
    if (e.slowTimer > 0) e.slowTimer -= dt;
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDps * dt;
      e.flash = .05;
      if (e.hp <= 0) {
        // 烧死
        e.hp = 0;
        spawnParticles(e.x, e.y, '#f39c12', 8, 80);
        kills++;
        const xpAmt = e.xp * (1 + gameTime * .008);
        spawnGem(e.x, e.y, xpAmt);
        enemies.splice(i, 1);
        continue;
      }
    }
    if (e.flash > 0) e.flash -= dt;

    // 移动：朝向最近的存活玩家
    const spd = e.slowTimer > 0 ? e.speed * .7 : e.speed;
    let target = players[0];
    if (players.length > 1) {
      let td = Infinity;
      for (const pl of players) {
        if (pl.downed) continue;
        const d = dist(e, pl);
        if (d < td) { td = d; target = pl; }
      }
      if (!target || target.downed) target = players[0];
    }

    const a = ang(e, target);

    // 冰墙阻挡检查
    let blocked = false;
    for (const w of iceWalls) {
      if (wallBlocks(w, e.x + Math.cos(a) * spd * dt, e.y + Math.sin(a) * spd * dt, e.r)) {
        blocked = true;
        w.hp -= e.dmg * dt * .1;     // 敌人攻击冰墙
        break;
      }
    }
    if (!blocked) {
      e.x += Math.cos(a) * spd * dt;
      e.y += Math.sin(a) * spd * dt;
    }

    // 敌人 vs 玩家碰撞
    for (const pl of players) {
      if (pl.downed) continue;
      if (dist(e, pl) < e.r + pl.r) {
        if (pl.inv <= 0) {
          // 伤害计算
          let dmg = e.dmg * .5 / pl.armor;
          // 烈焰在冰墙后减伤
          if (pl.role === 'fire') {
            for (const w of iceWalls) {
              if (dist(pl, w) < w.w + 30) { dmg *= .5; break; }
            }
          }
          // 护盾吸收
          if (pl.shield > 0) {
            const ab = Math.min(dmg, pl.shield);
            pl.shield -= ab;
            dmg -= ab;
          }
          pl.hp -= dmg;
          pl.inv = .3;                  // 无敌时间
          spawnParticles(pl.x, pl.y, '#e74c3c', 6, 60);

          // 死亡判定
          if (pl.hp <= 0) {
            pl.hp = 0;
            if (gameMode === 'cooperative') {
              if (players.every(p => p.hp <= 0)) { gameOver(); return; }
              pl.downed = true;
              floatText(pl.x, pl.y - 20, '倒地!', '#e74c3c');
            } else if (gameMode === 'survival') {
              if (players.every(p => p.hp <= 0)) { gameOver(); return; }
              pl.downed = true;
            } else {
              gameOver();
              return;
            }
          }
        }
        // 击退敌人
        e.x -= Math.cos(a) * 25;
        e.y -= Math.sin(a) * 25;
      }
    }

    // 移除太远的敌人
    if (e.x < -300 || e.x > W + 300 || e.y < -300 || e.y > H + 300) {
      if (dist(e, players[0]) > Math.max(W, H) * 1.5) enemies.splice(i, 1);
    }
  }

  // ---- 冰墙生命周期 ----
  for (let i = iceWalls.length - 1; i >= 0; i--) {
    const w = iceWalls[i];
    w.life -= dt;
    if (w.life <= 0 || w.hp <= 0) {
      spawnParticles(w.x, w.y, '#3498db', 10, 60);
      iceWalls.splice(i, 1);
    }
  }

  // ---- 经验宝石 ----
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.bob += dt * 3;

    for (const pl of players) {
      if (pl.downed) continue;
      const d = dist(pl, g);

      // 磁铁吸引
      if (d < pl.magnet + g.r) {
        const a = ang(g, pl);
        const pull = 180 * (1 - d / (pl.magnet + g.r));
        g.x += Math.cos(a) * pull * dt;
        g.y += Math.sin(a) * pull * dt;
      }

      // 拾取
      if (d < pl.r + g.r) {
        const xpGain = g.amt * (gameMode === 'cooperative' ? 0.67 : 1);

        if (gameMode === 'cooperative') {
          // 合作：共享经验
          sharedXp += xpGain;
          spawnParticles(g.x, g.y, '#2ecc71', 4, 40);
          SND.xp();
          gems.splice(i, 1);
          while (sharedXp >= sharedXpTo) {
            sharedXp -= sharedXpTo;
            sharedLv++;
            sharedXpTo = Math.floor(12 * Math.pow(1.22, sharedLv - 1));
            showUpgradeCoop();
            SND.lvlUp();
          }
        } else if (gameMode === 'survival') {
          // 生存：各自升级
          if (!pl.xp) { pl.xp = 0; pl.xpTo = 12; pl.lv = 1; }
          pl.xp += xpGain;
          spawnParticles(g.x, g.y, '#2ecc71', 4, 40);
          SND.xp();
          gems.splice(i, 1);
          while (pl.xp >= pl.xpTo) {
            pl.xp -= pl.xpTo;
            pl.lv++;
            pl.xpTo = Math.floor(12 * Math.pow(1.22, pl.lv - 1));
            showUpgradeSurvival(pl);
            SND.lvlUp();
          }
        } else {
          // 单人
          if (!pl.xp) { pl.xp = 0; pl.xpTo = 12; pl.lv = 1; }
          pl.xp += xpGain;
          spawnParticles(g.x, g.y, '#2ecc71', 4, 40);
          SND.xp();
          gems.splice(i, 1);
          while (pl.xp >= pl.xpTo) {
            pl.xp -= pl.xpTo;
            pl.lv++;
            pl.xpTo = Math.floor(12 * Math.pow(1.22, pl.lv - 1));
            showUpgradeSingle();
            SND.lvlUp();
          }
        }
        break;
      }
    }

    // 移除太远的宝石
    if (g.x < -100 || g.x > W + 100 || g.y < -100 || g.y > H + 100) {
      gems.splice(i, 1);
    }
  }

  // ---- 复活系统 (合作模式) ----
  if (gameMode === 'cooperative') {
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (!pl.downed) continue;
      const other = players[1 - i];
      if (other.downed) continue;
      if (dist(pl, other) < 80) {
        reviveProgress += dt;
        if (reviveProgress >= 3) {
          pl.downed = false;
          pl.hp = pl.maxHp * .5;
          reviveProgress = 0;
          reviveTarget = null;
          floatText(pl.x, pl.y - 20, '已复活!', '#2ecc71');
          spawnParticles(pl.x, pl.y, '#2ecc71', 15, 100);
        }
        if (reviveTarget !== i) { reviveTarget = i; reviveProgress = 0; }
      } else {
        reviveProgress = Math.max(0, reviveProgress - dt * 2);
      }
    }
    if (players.every(p => p.downed)) { gameOver(); return; }
  }

  // 生存模式全倒判定
  if (gameMode === 'survival' && players.every(p => p.downed || p.hp <= 0)) {
    gameOver();
    return;
  }

  // ---- 粒子 & 浮动文字 ----
  for (let i = parts.length - 1; i >= 0; i--) {
    const pt = parts[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    pt.vx *= .96;
    pt.vy *= .96;
    if (pt.life <= 0) parts.splice(i, 1);
  }
  for (let i = floatT.length - 1; i >= 0; i--) {
    const t = floatT[i];
    t.y += t.vy * dt;
    t.life -= dt;
    if (t.life <= 0) floatT.splice(i, 1);
  }

  // ---- 敌人生成 ----
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const w = getWave();
    const mult = gameMode === 'single' ? 1 : 1.5;  // 多人模式生成更多
    spawnTimer = Math.max(.25, w.si - gameTime * .0015);
    const n = Math.round((w.n + Math.floor(gameTime / 40)) * mult);
    for (let i = 0; i < n; i++) spawnEnemy();

    // 波次通知
    for (let i = 0; i < CFG.waves.length; i++) {
      if (Math.abs(gameTime - CFG.waves[i].t) < .5 && CFG.waves[i].t > 0 && !waveShown[i]) {
        waveShown[i] = true;
        showBanner('第' + (i + 1) + '波');
      }
    }
  }

  // 刷新 HUD
  updateUI();
}

// ================================================================
//  3. 波次 & 敌人生成
// ================================================================

// 获取当前波次配置
function getWave() {
  let w = CFG.waves[CFG.waves.length - 1];
  for (let i = CFG.waves.length - 1; i >= 0; i--) {
    if (gameTime >= CFG.waves[i].t) { w = CFG.waves[i]; break; }
  }
  return w;
}

// 生成一个敌人
function spawnEnemy() {
  const rr = Math.random();
  let type = 'normal';
  if (gameTime > 110 && rr < .07) {
    if (!bossSpawned) { type = 'boss'; bossSpawned = true; }
  } else if (rr < .18) type = 'fast';
  else if (rr < .33) type = 'tank';

  const cfg = CFG.enemies[type];

  // 从屏幕外随机一边进入
  const side = randInt(0, 3);
  const m = 40;
  let x, y;
  if (side === 0)      { x = -m;   y = rand(0, H); }
  else if (side === 1) { x = W + m; y = rand(0, H); }
  else if (side === 2) { x = rand(0, W); y = -m; }
  else                 { x = rand(0, W); y = H + m; }

  // 随时间提升难度
  const scale = 1 + gameTime * .005;

  enemies.push({
    x, y, type,
    r: cfg.r,
    speed: cfg.sp * (1 + gameTime * .0015),
    hp: cfg.hp * scale,
    maxHp: cfg.hp * scale,
    dmg: cfg.dmg * scale,
    xp: cfg.xp * (1 + gameTime * .008),
    color: cfg.color,
    flash: 0,
    slowTimer: 0,
    burnTimer: 0,
    burnDps: 0,
  });
}

// 波次横幅
function showBanner(text) {
  waveBanner.textContent = text;
  waveBanner.style.opacity = '1';
  setTimeout(() => waveBanner.style.opacity = '0', 1800);
}

// ================================================================
//  4. 游戏结束
// ================================================================

function gameOver() {
  gameState = 'gameover';
  SND.over();

  const m = Math.floor(gameTime / 60), s = Math.floor(gameTime % 60);
  const tStr = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

  if (players.length >= 2) {
    goStats.innerHTML = `
      生存: <span>${tStr}</span><br>
      击杀: <span>${kills}</span><br>
      P1 ${players[0].role === 'ice' ? '🧊' : '🔥'} 生命: <span>${Math.ceil(players[0].hp)}/${players[0].maxHp}</span><br>
      P2 ${players[1].role === 'ice' ? '🧊' : '🔥'} 生命: <span>${Math.ceil(players[1].hp)}/${players[1].maxHp}</span>`;
  } else {
    goStats.innerHTML = `
      生存: <span>${tStr}</span><br>
      击杀: <span>${kills}</span><br>
      状态: <span>${players[0]?.downed ? '倒地' : '阵亡'}</span>`;
  }

  gameOverScreen.style.display = 'flex';
  pauseBtn.style.display = 'none';
  ui.style.display = 'none';
}

// ================================================================
//  5. 状态机 — 场景切换
// ================================================================

function enterMenu() {
  gameState = 'menu';
  gameMode = null;
  roles = [];
  players = [];
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

  startScreen.style.display = 'flex';
  pauseBtn.style.display = 'none';
  ui.style.display = 'none';
  gameOverScreen.style.display = 'none';
  upgradePanel.style.display = 'none';
  pauseScreen.style.display = 'none';
  modeScreen.style.display = 'none';
  roleScreen.style.display = 'none';
  howScreen.style.display = 'none';
  coopInfo.style.display = 'none';
  skillInd.style.display = 'none';
  playerTag.style.display = 'none';
  jA1.style.display = 'none';
  jA2.style.display = 'none';

  for (let i = 0; i < 2; i++) {
    touches[i].active = false;
    touches[i].id = -1;
    touches[i].dx = 0;
    touches[i].dy = 0;
  }
}

function enterModeSelect() {
  startScreen.style.display = 'none';
  modeScreen.style.display = 'flex';
  howScreen.style.display = 'none';
}

function enterRoleSelect() {
  modeScreen.style.display = 'none';
  roleScreen.style.display = 'flex';
}

function enterPlaying() {
  gameState = 'playing';
  startScreen.style.display = 'none';
  modeScreen.style.display = 'none';
  roleScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  upgradePanel.style.display = 'none';
  pauseScreen.style.display = 'none';
  pauseBtn.style.display = 'flex';
  ui.style.display = 'flex';
  playerTag.style.display = gameMode === 'single' ? 'none' : 'flex';
  jA1.style.display = 'none';
  jA2.style.display = 'none';

  initGame();
  if (gameMode === 'single')       initSingle();
  else if (gameMode === 'survival')   initSurvival();
  else if (gameMode === 'cooperative') initCooperative(roles);

  resize();
  spawnTimer = .5;
  lastT = 0;
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    pauseScreen.style.display = 'flex';
    pauseBtn.textContent = '▶';
  } else if (gameState === 'paused') {
    gameState = 'playing';
    pauseScreen.style.display = 'none';
    pauseBtn.textContent = '⏸';
    lastT = 0;   // 防止恢复后 dt 跳帧
  }
}

// ================================================================
//  6. 按钮事件绑定
// ================================================================

// 通用绑定 (click + touch)
function bind(el, fn) {
  el.addEventListener('click', fn);
  el.addEventListener('touchend', e => { e.preventDefault(); fn(); });
}

// 防连点
const COOLDOWN = 350;
let lastClick = 0;
function debounce(fn) {
  return function () {
    const now = Date.now();
    if (now - lastClick < COOLDOWN) return;
    lastClick = now;
    fn();
  };
}

// ---- 主菜单 ----
bind($('btnPlay'), debounce(enterModeSelect));
bind($('btnHow'), debounce(() => { startScreen.style.display = 'none'; howScreen.style.display = 'flex'; }));
bind($('btnHowBack'), debounce(() => { howScreen.style.display = 'none'; startScreen.style.display = 'flex'; }));

// ---- 模式选择 ----
$('modeScreen').querySelectorAll('[data-mode]').forEach(b => {
  bind(b, debounce(() => {
    gameMode = b.dataset.mode;
    if (gameMode === 'cooperative') enterRoleSelect();
    else { roles = []; enterPlaying(); }
  }));
});
bind($('btnModeBack'), debounce(enterMenu));

// ---- 角色选择 ----
$('roleScreen').querySelectorAll('[data-roles]').forEach(b => {
  bind(b, debounce(() => {
    roles = b.dataset.roles.split(',');
    enterPlaying();
  }));
});
bind($('btnRoleBack'), debounce(enterModeSelect));

// ---- 暂停 ----
bind(pauseBtn, debounce(togglePause));
bind($('btnResume'), debounce(togglePause));
bind($('btnRestart'), debounce(() => { gameState = 'menu'; enterPlaying(); }));
bind($('btnMenu'), debounce(enterMenu));

// ---- 游戏结束 ----
bind($('btnRetry'), debounce(() => { gameState = 'menu'; enterPlaying(); }));
bind($('btnGoMenu'), debounce(enterMenu));
