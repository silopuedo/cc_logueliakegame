// ================================================================
//  utils.js — 通用工具函数
// ================================================================
// 这个文件放"纯函数"：给定输入永远返回相同输出，不修改全局状态。
// 数学函数、DOM 快捷引用都放在这里。
// ================================================================

// ---- DOM 快捷方式 ----
// 比 document.getElementById 短很多，提高可读性
const $ = id => document.getElementById(id);

// ---- Canvas 上下文 ----
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');

// ---- 数学工具 ----
// 两点距离
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 从 a 到 b 的角度 (弧度)
function ang(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// 范围随机数
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// 范围随机整数 (包含两端)
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// 数值钳制
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 线性插值
function lerp(a, b, t) {
  return a + (b - a) * t;
}
