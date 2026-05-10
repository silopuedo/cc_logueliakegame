// ================================================================
//  upgrades.js — 升级系统
// ================================================================
// 升级流程：升级触发 → 随机选择3个可用升级 → 展示面板 → 玩家选择 → 应用效果
// 三种模式各有不同的升级规则：
//   单人:    1个玩家的个人升级
//   生存:    2个玩家各自的独立升级
//   合作:    每人1个个人升级 + 1个共享升级
// ================================================================

// ---- 单人模式升级 ----
function showUpgradeSingle() {
  levelingPlayerIdx = -1;
  const avail = CFG.upgrades.filter(u => (upgLvs[u.id] || 0) < 5);
  const ch = [...avail].sort(() => Math.random() - .5).slice(0, 3);
  showUpgradePanelFn(ch);
  upgradeSub.textContent = '选择一个强化';
}

// ---- 生存模式升级 (指定玩家) ----
function showUpgradeSurvival(pl) {
  const idx = players.indexOf(pl);
  levelingPlayerIdx = idx;
  const avail = CFG.upgrades.filter(u => (upgLvs[idx][u.id] || 0) < 5);
  const ch = [...avail].sort(() => Math.random() - .5).slice(0, 3);
  const tagged = ch.map(u => ({ ...u, target: idx }));
  showUpgradePanelFn(tagged);
  upgradeSub.textContent = 'P' + (idx + 1) + ' 选择一个强化';
}

// ---- 合作模式升级 (每人1个 + 1个共享) ----
function showUpgradeCoop() {
  const p1Upgs = CFG.upgrades.filter(u => (upgLvs[0][u.id] || 0) < 5);
  const p2Upgs = CFG.upgrades.filter(u => (upgLvs[1][u.id] || 0) < 5);
  const cUpgs = CFG.coopUpgrades.filter(u => (coopUpgLvs[u.id] || 0) < 4);

  const p1ch = p1Upgs[Math.floor(Math.random() * p1Upgs.length)] || CFG.upgrades[0];
  const p2ch = p2Upgs[Math.floor(Math.random() * p2Upgs.length)] || CFG.upgrades[0];
  const cch = cUpgs[Math.floor(Math.random() * cUpgs.length)] || CFG.coopUpgrades[0];

  const ch = [
    { ...p1ch, isPersonal: true, target: 0 },
    { ...p2ch, isPersonal: true, target: 1 },
    { ...cch, isCoop: true },
  ];
  showUpgradePanelFn(ch);
  upgradeSub.textContent = '选择强化 (个人/合作)';
}

// ---- 升级面板渲染 ----
function showUpgradePanelFn(ch) {
  upgradeChoices.innerHTML = '';

  ch.forEach(c => {
    let valStr = '';
    const u = c;

    if (u.isCoop) {
      switch (u.id) {
        case 'coopDmg':   valStr = '双方伤害+' + u.perLv; break;
        case 'coopHp':    valStr = '双方生命+' + u.perLv; break;
        case 'coopSpd':   valStr = '双方移速+' + u.perLv; break;
        case 'coopRegen': valStr = '双方回复+' + u.perLv + '/s'; break;
      }
    } else {
      switch (u.id) {
        case 'damage': valStr = '+' + u.perLv + ' 伤害'; break;
        case 'attSpd': valStr = '间隔-' + u.perLv.toFixed(2) + 's'; break;
        case 'mSpd':   valStr = '+' + u.perLv + ' 移速'; break;
        case 'multi':  valStr = '+' + u.perLv + ' 子弹'; break;
        case 'pierce': valStr = '+' + u.perLv + ' 穿透'; break;
        case 'pSpd':   valStr = '+' + u.perLv + ' 弹速'; break;
        case 'hpUp':   valStr = '+' + u.perLv + ' 生命'; break;
        case 'regen':  valStr = '+' + u.perLv + '/s 回复'; break;
        case 'magnet': valStr = '+' + u.perLv + ' 范围'; break;
      }
    }

    const card = document.createElement('div');
    card.className = 'ucard' + (u.isCoop ? ' coop' : '');

    let prefix = '';
    if (u.isCoop) prefix = '🤝 ';
    else if (u.target !== undefined) {
      const re = players[u.target].role === 'ice' ? '🧊' : '🔥';
      prefix = (u.target === 0 ? 'P1 ' : 'P2 ') + re + ' ';
    }

    card.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div class="name">${prefix}${u.name}</div>
      <div class="desc">${u.desc || ''}</div>
      <div class="val">${valStr}</div>`;

    card.addEventListener('click', () => applyUpg(c, u));
    card.addEventListener('touchend', e => { e.preventDefault(); applyUpg(c, u); });

    upgradeChoices.appendChild(card);
  });

  upgrading = true;              // 暂停游戏逻辑
  upgradePanel.style.display = 'flex';
}

// ---- 应用升级效果 ----
function applyUpg(cardData) {
  const cd = cardData;

  if (cd.isCoop) {
    // 共享升级：双方都受益
    coopUpgLvs[cd.id] = (coopUpgLvs[cd.id] || 0) + 1;
    switch (cd.id) {
      case 'coopDmg':   players.forEach(p => p.dmg += cd.perLv); break;
      case 'coopHp':    players.forEach(p => { p.maxHp += cd.perLv; p.hp += cd.perLv; }); break;
      case 'coopSpd':   players.forEach(p => p.speed += cd.perLv); break;
      case 'coopRegen': players.forEach(p => p.regen += cd.perLv); break;
    }
  } else if (cd.target !== undefined) {
    // 指定玩家升级 (生存/合作模式的个人升级)
    const pl = players[cd.target];
    upgLvs[cd.target][cd.id] = (upgLvs[cd.target][cd.id] || 0) + 1;
    switch (cd.id) {
      case 'damage': pl.dmg += cd.perLv; break;
      case 'attSpd': pl.atkInt = Math.max(.12, pl.atkInt - cd.perLv); break;
      case 'mSpd':   pl.speed += cd.perLv; break;
      case 'multi':  pl.proj += cd.perLv; break;
      case 'pierce': pl.pierce += cd.perLv; break;
      case 'pSpd':   pl.projSpd += cd.perLv; break;
      case 'hpUp':   pl.maxHp += cd.perLv; pl.hp += cd.perLv; break;
      case 'regen':  pl.regen += cd.perLv; break;
      case 'magnet': pl.magnet += cd.perLv; break;
    }
  } else {
    // 单人模式升级
    const pl = players[0];
    upgLvs[cd.id] = (upgLvs[cd.id] || 0) + 1;
    switch (cd.id) {
      case 'damage': pl.dmg += cd.perLv; break;
      case 'attSpd': pl.atkInt = Math.max(.12, pl.atkInt - cd.perLv); break;
      case 'mSpd':   pl.speed += cd.perLv; break;
      case 'multi':  pl.proj += cd.perLv; break;
      case 'pierce': pl.pierce += cd.perLv; break;
      case 'pSpd':   pl.projSpd += cd.perLv; break;
      case 'hpUp':   pl.maxHp += cd.perLv; pl.hp += cd.perLv; break;
      case 'regen':  pl.regen += cd.perLv; break;
      case 'magnet': pl.magnet += cd.perLv; break;
    }
  }

  upgrading = false;
  upgradePanel.style.display = 'none';
}
