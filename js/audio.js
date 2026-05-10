// ================================================================
//  audio.js — 音效系统
// ================================================================
// Web Audio API 实现。原理：创建振荡器 → 连接增益 → 输出。
// 每次调用 sfx() 都是"即时合成"声音，不需要外部音频文件。
// ================================================================

// AudioContext (浏览器音频环境)
let actx = null;

// 懒初始化：第一次播放时才创建 AudioContext
// 原因是浏览器要求用户交互后才能创建音频上下文
function initA() {
  if (!actx) actx = new (AudioContext || webkitAudioContext)();
}

// ---- 音效合成核心 ----
// freqs: 频率数组 (多个频率产生旋律感)
// type:  波形类型 (sine=正弦, square=方波, sawtooth=锯齿)
// dur:   每个音符时长
// vol:   音量
function sfx(freqs, type, dur, vol) {
  try {
    initA();
    const now = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx.createOscillator();  // 振荡器 = 音源
      const g = actx.createGain();        // 增益 = 音量控制器
      o.connect(g);
      g.connect(actx.destination);
      o.type = type;
      o.frequency.setValueAtTime(f, now + i * 0.07);
      g.gain.setValueAtTime(vol, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + dur);
      o.start(now + i * 0.07);
      o.stop(now + i * 0.07 + dur);
    });
  } catch (e) {
    // 静默失败：audio 不是必需的
  }
}

// ---- 游戏音效集 ----
// 每个音效用不同频率组合和波形来区分
const SND = {
  shoot:  () => sfx([600, 200],     'square', .05, .04),
  hit:    () => sfx([200],           'sine',   .06, .06),
  xp:     () => sfx([500, 800],      'sine',   .08, .03),
  lvlUp:  () => sfx([523, 659, 784], 'sine',   .12, .05),
  over:   () => sfx([400, 350, 300, 200], 'sawtooth', .15, .04),
  ice:    () => sfx([300, 200, 150], 'sine',   .1,  .05),
  fire:   () => sfx([600, 800, 400], 'sawtooth', .08, .05),
  steam:  () => sfx([200, 400, 600, 800], 'sine', .12, .04),
};
