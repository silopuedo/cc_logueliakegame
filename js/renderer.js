// ================================================================
//  renderer.js — 渲染系统
// ================================================================
// 职责：把游戏世界"画"到 Canvas 上。
// 每帧调用一次 render()，它不修改任何游戏数据——只做"视觉呈现"。
// 这样后面如果想换 Three.js 或 WebGL，只需要改这个文件。
// ================================================================

// ---- 主渲染函数 ----
function render() {
  // 1. 背景
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);

  // 2. 网格线 (跟随玩家滚动)
  const gs = 40;
  ctx.strokeStyle = 'rgba(255,255,255,.03)';
  ctx.lineWidth = 1;
  const ox = -((players[0]?.x || 0) % gs);
  const oy = -((players[0]?.y || 0) % gs);
  ctx.beginPath();
  for (let x = ox; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // 菜单状态不画游戏内容
  if (gameState !== 'playing' && gameState !== 'paused') return;

  // 3. 冰墙
  for (const w of iceWalls) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle);
    const grd = ctx.createLinearGradient(-w.w/2, 0, w.w/2, 0);
    grd.addColorStop(0, 'rgba(52,152,219,.2)');
    grd.addColorStop(.5, 'rgba(52,152,219,.5)');
    grd.addColorStop(1, 'rgba(52,152,219,.2)');
    ctx.fillStyle = grd;
    ctx.fillRect(-w.w/2, -w.h/2, w.w, w.h);
    ctx.strokeStyle = 'rgba(52,152,219,.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w.w/2, -w.h/2, w.w, w.h);
    ctx.restore();
  }

  // 4. 经验宝石 (带浮动动画)
  for (const g of gems) {
    const by = Math.sin(g.bob) * 2.5;
    ctx.beginPath();
    ctx.arc(g.x, g.y + by, g.r, 0, Math.PI * 2);
    const grd = ctx.createRadialGradient(g.x, g.y + by, 0, g.x, g.y + by, g.r);
    grd.addColorStop(0, '#2ecc71');
    grd.addColorStop(1, 'rgba(39,174,96,0)');
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(g.x, g.y + by, g.r * .35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fill();
  }

  // 5. 合作模式灵魂链接线
  if (gameMode === 'cooperative' && players.length >= 2 && !players[0].downed && !players[1].downed) {
    ctx.beginPath();
    ctx.moveTo(players[0].x, players[0].y);
    ctx.lineTo(players[1].x, players[1].y);
    ctx.strokeStyle = `rgba(52,152,219,${.3 + Math.sin(gameTime * 2) * .1})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 6. 敌人
  for (const e of enemies) {
    let col = e.flash > 0 ? '#fff' : e.color;
    if (e.burnTimer > 0) col = '#f39c12';
    const drawType = e.type === 'boss' ? 'boss' : e.type === 'fast' ? 'fast' : e.type === 'tank' ? 'tank' : 'normal';
    drawEntity(e.x, e.y, e.r, col, drawType, e.flash, gameTime);

    // Boss 轨道粒子
    if (e.type === 'boss') {
      const orbR = e.r + 10;
      for (let o = 0; o < 3; o++) {
        const oa = gameTime * 2.5 + o * Math.PI * 2 / 3;
        const ox = e.x + Math.cos(oa) * orbR;
        const oy = e.y + Math.sin(oa) * orbR;
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(241,196,15,${.5 + Math.sin(gameTime * 4 + o) * .3})`;
        ctx.fill();
      }
    }

    // 状态光环
    if (e.slowTimer > 0) {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(52,152,219,.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (e.burnTimer > 0) {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(243,156,18,.5)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }

    // 血条
    if (e.hp < e.maxHp) {
      const bw = e.r * 1.8, bh = 3;
      const bx = e.x - bw / 2, by = e.y - e.r - 8;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = e.hp / e.maxHp > .5 ? '#2ecc71' : e.hp / e.maxHp > .25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
  }

  // 7. 子弹 (带拖尾光效)
  for (const b of projs) {
    ctx.save();
    // 拖尾 (残影)
    for (let i = 3; i > 0; i--) {
      const a = i / 3 * .2;
      const px = b.x - b.vx * .012 * i;
      const py = b.y - b.vy * .012 * i;
      drawProjShape(px, py, b.r * i / 3 * .5, b.isFire, b.isIce);
      ctx.fillStyle = `rgba(${b.isFire ? '231,76,60' : b.isIce ? '52,152,219' : '241,196,15'},${a})`;
      ctx.fill();
    }
    // 子弹本体
    drawProjShape(b.x, b.y, b.r, b.isFire, b.isIce);
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    if (b.isFire)       { grd.addColorStop(0, '#fff'); grd.addColorStop(.4, '#e74c3c'); grd.addColorStop(1, '#c0392b'); }
    else if (b.isIce)   { grd.addColorStop(0, '#fff'); grd.addColorStop(.4, '#3498db'); grd.addColorStop(1, '#2980b9'); }
    else                { grd.addColorStop(0, '#fff'); grd.addColorStop(.4, '#f1c40f'); grd.addColorStop(1, '#e67e22'); }
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.restore();
  }

  // 8. 玩家
  for (const pl of players) {
    ctx.save();
    const roleCol = pl.role === 'ice' ? '#3498db' : pl.role === 'fire' ? '#e74c3c' : '#5dade2';
    const c1 = pl.role === 'ice' ? '#74b9ff' : pl.role === 'fire' ? '#ff7675' : '#5dade2';
    const c2 = pl.role === 'ice' ? '#0984e3' : pl.role === 'fire' ? '#d63031' : '#2e86c1';
    const c3 = pl.role === 'ice' ? '#0652a0' : pl.role === 'fire' ? '#8b0000' : '#1a5276';
    const drawType = pl.role === 'ice' ? 'ice' : pl.role === 'fire' ? 'fire' : 'single';

    // 根据移动方向决定面朝角度
    const dir = getInputDir(players.indexOf(pl));
    let faceA = 0;
    if (dir.mag > .1) faceA = Math.atan2(dir.my, dir.mx) + Math.PI / 2;

    drawEntity(pl.x, pl.y, pl.r, roleCol, drawType, 0, faceA);

    // 角色颜色渐变层
    const grd = ctx.createRadialGradient(pl.x - 3, pl.y - 3, 0, pl.x, pl.y, pl.r);
    grd.addColorStop(0, c1); grd.addColorStop(.6, c2); grd.addColorStop(1, c3);
    ctx.globalAlpha = .35;
    ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.globalAlpha = 1;

    // 高光
    ctx.beginPath(); ctx.arc(pl.x - 3, pl.y - 3, pl.r * .3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();

    // 角色标识
    if (pl.role === 'ice')  { ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('❄', pl.x, pl.y - pl.r - 6); }
    if (pl.role === 'fire') { ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('🔥', pl.x, pl.y - pl.r - 6); }

    // 护盾环
    if (pl.shield > 0) {
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 2, 0, Math.PI * 2 * (pl.shield / pl.shieldMax));
      ctx.strokeStyle = 'rgba(52,152,219,.6)'; ctx.lineWidth = 3; ctx.stroke();
    }

    // 无敌闪烁
    if (pl.inv > 0 && Math.floor(pl.inv * 20) % 2 === 0) {
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // 倒地状态
    if (pl.downed) {
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(231,76,60,.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(231,76,60,.3)'; ctx.fill();
    }

    // 复活进度条
    if (reviveTarget !== null && reviveProgress > 0 && players.some(p => p === pl && p.downed)) {
      const bw = pl.r * 2, bx = pl.x - bw / 2, by = pl.y - pl.r - 10;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#2ecc71'; ctx.fillRect(bx, by, bw * (reviveProgress / 3), 4);
    }

    ctx.restore();
  }

  // 9. 粒子
  for (const pt of parts) {
    const a = pt.life / pt.maxL;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * a, 0, Math.PI * 2);
    ctx.fillStyle = pt.color; ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 10. 浮动文字
  for (const t of floatT) {
    const a = t.life / t.maxL;
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.font = 'bold 13px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // 11. 技能冷却条
  if (gameMode === 'cooperative' || gameMode === 'survival') {
    for (let i = 0; i < players.length; i++) {
      const pl = players[i];
      if (pl.skillMaxCD > 0) {
        const cd = pl.skillCD / pl.skillMaxCD;
        const sx = pl.x - 15, sy = pl.y + pl.r + 6;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(sx, sy, 30, 4);
        ctx.fillStyle = cd <= 0 ? '#2ecc71' : '#f39c12';
        ctx.fillRect(sx, sy, 30 * (1 - cd), 4);
        if (cd <= 0) {
          ctx.fillStyle = '#f1c40f'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(pl.skillKey === 'e' ? '[E]' : '[回车]', pl.x, pl.y + pl.r + 16);
        }
      }
    }
  }
}

// ================================================================
//  HUD 更新 (HTML overlay，不是 Canvas)
// ================================================================

function updateUI() {
  if (players.length === 1) {
    // 单人: 1套血条+经验
    const pl = players[0];
    p1UI.innerHTML = `
      <div class="ui-box">
        <span style="color:#5dade2">⛊</span>
        <div class="hpBarOuter">
          <div class="hpBar red" style="width:${pl.hp / pl.maxHp * 100}%"></div>
          <div class="hpText">${Math.ceil(pl.hp)}/${pl.maxHp}</div>
        </div>
      </div>
      <div class="ui-box">
        <div class="xpBarOuter">
          <div class="xpBar" style="width:${pl.xp ? Math.min(100, pl.xp / pl.xpTo * 100) : 0}%"></div>
        </div>
      </div>
      <div class="ui-box">Lv.${sharedLv || pl.lv || 1}</div>`;
  } else {
    // 多人: 每人1套
    const r0 = players[0].role || '';
    const r1 = players[1].role || '';
    const r0e = r0 === 'ice' ? '🧊' : r0 === 'fire' ? '🔥' : '';
    const r1e = r1 === 'ice' ? '🧊' : r1 === 'fire' ? '🔥' : '';

    p1UI.innerHTML = `
      <div class="ui-box">
        <span style="color:${r0 === 'ice' ? '#3498db' : r0 === 'fire' ? '#e74c3c' : '#5dade2'}">${r0e} P1</span>
        <div class="hpBarOuter">
          <div class="hpBar ${r0 === 'ice' ? 'blue' : r0 === 'fire' ? 'orange' : 'red'}" style="width:${players[0].hp / players[0].maxHp * 100}%"></div>
          <div class="hpText">${Math.ceil(players[0].hp)}/${players[0].maxHp}</div>
        </div>
        ${players[0].shield > 0 ? ` 🛡${Math.ceil(players[0].shield)}` : ''}
        ${players[0].downed ? ' 💀倒地' : ''}
      </div>
      <div class="ui-box">
        <div class="xpBarOuter">
          <div class="xpBar" style="width:${players[0].xp ? Math.min(100, players[0].xp / players[0].xpTo * 100) : 0}%"></div>
        </div>
      </div>
      <div class="ui-box">Lv.${players[0].lv || 1}</div>`;

    p2UI.style.display = 'flex';
    p2UI.innerHTML = `
      <div class="ui-box" style="text-align:right">
        <span style="color:${r1 === 'ice' ? '#3498db' : r1 === 'fire' ? '#e74c3c' : '#5dade2'}">${r1e} P2</span>
        <div class="hpBarOuter">
          <div class="hpBar ${r1 === 'ice' ? 'blue' : r1 === 'fire' ? 'orange' : 'red'}" style="width:${players[1].hp / players[1].maxHp * 100}%"></div>
          <div class="hpText">${Math.ceil(players[1].hp)}/${players[1].maxHp}</div>
        </div>
        ${players[1].shield > 0 ? ` 🛡${Math.ceil(players[1].shield)}` : ''}
        ${players[1].downed ? ' 💀倒地' : ''}
      </div>
      <div class="ui-box" style="text-align:right">
        <div class="xpBarOuter">
          <div class="xpBar" style="width:${players[1].xp ? Math.min(100, players[1].xp / players[1].xpTo * 100) : 0}%"></div>
        </div>
      </div>
      <div class="ui-box" style="text-align:right">Lv.${players[1].lv || 1}</div>`;
  }

  // 合作模式额外信息
  if (gameMode === 'cooperative') {
    statKills.textContent = '击杀 ' + kills;
    coopInfo.style.display = 'flex';
    coopInfo.innerHTML = `<span>Lv.${sharedLv}</span><span>XP ${Math.floor(sharedXp)}/${sharedXpTo}</span>`;
  } else {
    statKills.textContent = '击杀 ' + kills;
    coopInfo.style.display = 'none';
  }

  // 计时器
  const m = Math.floor(gameTime / 60), s = Math.floor(gameTime % 60);
  statTime.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
