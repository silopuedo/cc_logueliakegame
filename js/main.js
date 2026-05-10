// ================================================================
//  main.js — 游戏入口
// ================================================================
// 这是游戏启动的地方。只做三件事：
// 1. resize(): 设置 Canvas 尺寸
// 2. loop():   启动 requestAnimationFrame 游戏循环
// 3. 初始化:   进入主菜单
// ================================================================

// ---- Canvas 尺寸适配 ----
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

// ---- 游戏主循环 ----
// requestAnimationFrame 让循环和显示器刷新同步 (60fps)
// dt = 两帧之间的时间差，用 dt 驱动所有移动/冷却，保证不同帧率下游戏速度一致
function loop(ts) {
  if (!lastT) lastT = ts;          // 第一帧初始化
  const dt = Math.min((ts - lastT) / 1000, .05);  // 限制最大 dt 防止卡顿瞬移
  lastT = ts;

  if (gameState === 'playing') update(dt);

  render();

  requestAnimationFrame(loop);     // 请求下一帧
}

// ---- 启动！ ----
resize();
enterMenu();
lastT = 0;
requestAnimationFrame(loop);
