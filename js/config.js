// ================================================================
//  config.js — 游戏配置
// ================================================================
// 为什么要有这个文件？
// 把"数值"和"逻辑"分开是游戏开发的第一课。
// 所有需要调整的常量（伤害、速度、冷却、波次…）都放在这，
// 而不是散落在代码各处，这样调平衡性时不用翻逻辑代码。
// ================================================================

const CFG = {

  // ---- 玩家基础属性 ----
  player: {
    r: 16,          // 碰撞半径
    speed: 280,     // 移动速度 (px/s)
    hp: 100,        // 生命值
    atkInt: 0.55,   // 攻击间隔 (秒)
    proj: 1,        // 每次射击子弹数
    projSpd: 600,   // 子弹速度
    pierce: 0,      // 穿透数 (0=打中1个就消失)
    regen: 1,       // 每秒回血
    magnet: 80,     // 吸宝石范围
  },

  // ---- 敌人类型表 ----
  enemies: {
    normal: { r:12, sp:90,  hp:30,  dmg:8,  xp:5,  color:'#e74c3c' },
    fast:   { r:10, sp:160, hp:18,  dmg:5,  xp:7,  color:'#e67e22' },
    tank:   { r:20, sp:45,  hp:90,  dmg:12, xp:12, color:'#9b59b6' },
    boss:   { r:34, sp:55,  hp:400, dmg:25, xp:50, color:'#f1c40f' },
  },

  // ---- 波次表 ----
  // t: 触发时间(秒)  si: 生成间隔  n: 基础生成数量
  waves: [
    { t:0,   si:2.0, n:2 },
    { t:30,  si:1.6, n:2 },
    { t:60,  si:1.3, n:3 },
    { t:120, si:1.0, n:3 },
    { t:180, si:0.85, n:4 },
    { t:240, si:0.7,  n:4 },
    { t:300, si:0.55, n:5 },
  ],

  // ---- 双人角色：冰之守护者 ----
  ice: {
    name: '冰之守护者',
    color: '#3498db',
    r: 18,
    spMult: 0.8,      // 速度倍率
    hpMult: 2,         // 血量倍率
    armorMult: 1.5,    // 护甲倍率
    dmg: 12,
    atkInt: 0.65,
    proj: 1,
    projSpd: 500,
    pierce: 0,
    regen: 1.5,
    magnet: 80,
    skill: { name:'冰墙屏障', cd:12, dur:6, key:'e' },
    passive: { shieldCD:8, shieldPct:.2 },
  },

  // ---- 双人角色：烈焰射手 ----
  fire: {
    name: '烈焰射手',
    color: '#e74c3c',
    r: 14,
    spMult: 1.2,
    hpMult: .7,
    armorMult: .5,
    dmg: 22,
    atkInt: 0.45,
    proj: 1,
    projSpd: 700,
    pierce: 1,
    regen: .5,
    magnet: 80,
    skill: { name:'烈焰爆发', cd:10, dur:.6, key:'enter' },
    passive: { killSpdBonus:.05, maxStacks:5, dur:3 },
  },

  // ---- 单人/生存模式升级选项 ----
  upgrades: [
    { id:'damage',  name:'攻击力', desc:'伤害+8',     icon:'⚔', perLv:8 },
    { id:'attSpd',  name:'攻速',   desc:'间隔-0.06s', icon:'⚡', perLv:.06 },
    { id:'mSpd',    name:'移速',   desc:'速度+25',    icon:'👟', perLv:25 },
    { id:'multi',   name:'多重',   desc:'子弹+1',     icon:'🔫', perLv:1 },
    { id:'pierce',  name:'穿透',   desc:'穿透+1',     icon:'💎', perLv:1 },
    { id:'pSpd',    name:'弹速',   desc:'弹速+50',    icon:'💨', perLv:50 },
    { id:'hpUp',    name:'生命',   desc:'生命+20',    icon:'❤', perLv:20 },
    { id:'regen',   name:'回复',   desc:'回复+1/s',   icon:'🩹', perLv:1 },
    { id:'magnet',  name:'磁铁',   desc:'范围+25',    icon:'🧲', perLv:25 },
  ],

  // ---- 合作模式共享升级 ----
  coopUpgrades: [
    { id:'coopDmg',   name:'协力攻击', desc:'双方伤害+6',     icon:'⚔', perLv:6 },
    { id:'coopHp',    name:'协力生命', desc:'双方生命+12',   icon:'❤', perLv:12 },
    { id:'coopSpd',   name:'协力速度', desc:'双方移速+18',   icon:'👟', perLv:18 },
    { id:'coopRegen', name:'协力回复', desc:'双方回复+0.4/s', icon:'🩹', perLv:.4 },
  ],
};
