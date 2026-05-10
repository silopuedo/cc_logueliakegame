// ================================================================
//  skills.js — 技能系统
// ================================================================
// 冰之守护者 → 冰墙屏障 (防御/控场)
// 烈焰射手   → 烈焰爆发 (范围爆发)
// 组合技     → 蒸汽爆炸 (火打冰墙产生额外伤害)
// ================================================================

// 使用技能 (由 input.js 检测到按键后调用)
function useSkill(idx) {
  const pl = players[idx];
  if (!pl || pl.downed || pl.skillCD > 0) return;

  if (pl.role === 'ice') {
    // ---- 冰墙屏障 ----
    // 在玩家前方 60px 处生成一面冰墙阻挡敌人
    const dir = getInputDir(idx);
    let ax = 1, ay = 0;
    if (dir.mag > .1) { ax = dir.mx; ay = dir.my; }
    const wx = pl.x + ax * 60;
    const wy = pl.y + ay * 60;

    iceWalls.push({
      x: wx, y: wy,
      w: 70, h: 16,
      life: 6, maxLife: 6,     // 持续6秒
      hp: 300, maxHp: 300,     // 冰墙也有血量
      angle: Math.atan2(ay, ax),
      owner: pl,
    });

    pl.skillCD = pl.skillMaxCD;
    spawnParticles(wx, wy, '#3498db', 15, 80);
    SND.ice();
    showSkillMsg(idx, '冰墙屏障!');

  } else if (pl.role === 'fire') {
    // ---- 烈焰爆发 ----
    // 360° 范围发射 16 枚火焰弹
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 / n * i;
      projs.push({
        x: pl.x, y: pl.y,
        vx: Math.cos(a) * 450,
        vy: Math.sin(a) * 450,
        dmg: pl.dmg * 1.5,
        pierce: 2,
        hit: new Set(),
        r: 5,
        life: .5,
        isFire: true,
      });
    }

    pl.skillCD = pl.skillMaxCD;
    spawnParticles(pl.x, pl.y, '#e74c3c', 20, 150);
    SND.fire();
    showSkillMsg(idx, '烈焰爆发!');

    // ---- 蒸汽爆炸 (联动技) ----
    // 如果烈焰爆发的范围覆盖了冰墙，引发蒸汽爆炸
    for (let i = iceWalls.length - 1; i >= 0; i--) {
      const w = iceWalls[i];
      if (dist(pl, w) < 100) {
        spawnParticles(w.x, w.y, '#fff', 25, 200);
        SND.steam();
        // 对附近敌人造成大量伤害 + 灼烧
        for (const e of enemies) {
          if (dist(w, e) < 150) {
            e.hp -= pl.dmg * 1.5 * 1.5;
            e.flash = .1;
            if (e.slowTimer > 0) {
              e.burnTimer = 3;
              e.burnDps = pl.dmg * .3;
            }
          }
        }
        showSkillMsg(idx, '蒸汽爆炸!!');
        iceWalls.splice(i, 1);  // 冰墙被摧毁
      }
    }
  }
}

// 显示技能提示 (HUD)
function showSkillMsg(idx, msg) {
  skillIndTimers[idx] = 2;
  skillInd.style.display = 'flex';
  skillInd.innerHTML = `<div class="sk">${players[idx].role === 'ice' ? '🧊' : '🔥'} ${msg}</div>`;
}
