/*
 * 弹剑道场 · 抖音小游戏入口适配（横屏 960x540 逻辑世界，等比缩放 letterbox）
 * 负责：画布/DPR 适配、多点触控虚拟键、固定 60Hz 步长、音效事件转发、生命周期。
 * 内核 core/enemy/bestiary 与渲染 render* 均无平台依赖，Node 可直接测试。
 * 平台适配面：getSystemInfoSync/getWindowInfo、createCanvas、onTouch*、onShow/onHide。
 */
var Sekiro = require("./core.js");
require("./enemy.js");   // 原型注入到 Sekiro.Game.prototype
require("./bestiary.js"); // Sekiro.Bestiary 七阵数据
var SekiroAudio = require("./audio.js");
var R = require("./render.js");
require("./render-bg.js");
require("./render-figure.js");
require("./render-hud.js");
require("./render-screens.js");
require("./render-touch.js");
R.touchMode = true; // 触屏版：隐藏 HUD 右下键盘小抄

var Game = Sekiro.Game;

// 平台对象：抖音 tt 优先，兼容微信 wx（浏览器 harness 注入 tt shim）
var api = (typeof tt !== "undefined" && tt) || (typeof wx !== "undefined" && wx) || null;

var sysInfo = api.getWindowInfo ? api.getWindowInfo() : api.getSystemInfoSync();
var dpr = sysInfo.pixelRatio || 1;
var vw = sysInfo.windowWidth;
var vh = sysInfo.windowHeight;

var canvas = api.createCanvas();
canvas.width = Math.round(vw * dpr);
canvas.height = Math.round(vh * dpr);
var ctx = canvas.getContext("2d");

var scale = Math.min(vw / R.W, vh / R.H);
var offX = (vw - R.W * scale) / 2;
var offY = (vh - R.H * scale) / 2;

/* ---------- 游戏实例 / 流程 ---------- */

var audio = new SekiroAudio();
var game = newGame();

function newGame() {
  var seed = ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  return new Game(Sekiro.mulberry32(seed), { stages: Sekiro.Bestiary.STAGES });
}

function startGame() {
  audio.ensure();
  game = newGame();
  if (R.hud.resetTips) R.hud.resetTips();
  game.start();
  if (typeof globalThis !== "undefined") globalThis.__sekiro = game;
}

// 死亡防连点：死亡动画的 0.8s 内忽略重开（对齐源项目 RESTART_GUARD，防死亡瞬间误触秒重开）
var RESTART_GUARD = 0.8;
var deathAt = 0;

function tapFlow() {
  audio.ensure();
  if (game.mode === "title") startGame();
  else if (game.mode === "death") {
    if (Date.now() - deathAt >= RESTART_GUARD * 1000) game.restart();
  }
  else if (game.mode === "victory") startGame();
}

if (typeof globalThis !== "undefined") globalThis.__sekiro = game;
if (api.setKeepScreenOn) {
  try { api.setKeepScreenOn({ keepScreenOn: true }); } catch (e) { /* 旧库无此能力 */ }
}

/* ---------- 触摸 ---------- */

var view = { pressed: {} };
var heldTouches = {}; // identifier -> buttonId（◀ ▶ 支持按住）

// 真机坐标探针：首次触摸打印原始坐标（client/screen/window/pixelRatio），
// 用于 DevTools/真机 vConsole 核对 screen 系坐标系；同时自动识别物理像素上报。
var touchProbed = false;
var touchScaleX = 1, touchScaleY = 1;

function rawPoint(touch) {
  var hasClient = touch.clientX != null;
  var px = hasClient ? touch.clientX : touch.screenX;
  var py = hasClient ? touch.clientY : touch.screenY;
  // 无 clientX 且原始坐标超出逻辑【屏幕】：真机按物理像素上报（越界量达数百~数千 px）→ 按 DPR 自校正。
  // 边界用 screenWidth 而非 windowWidth：Android 窗口常比屏幕窄（状态栏等），点到屏幕边缘
  // screenX 可略大于 vw 但恒 ≤ screenWidth，用窗口边界会把这种「小越界」误判成物理像素，
  // 且校正一次不可逆 → 整机触控永久失灵。
  var sw = sysInfo.screenWidth || vw, sh = sysInfo.screenHeight || vh;
  if (!hasClient && touchScaleX === 1 && dpr > 1 &&
      (px > sw + 2 || py > sh + 2 || px < -2 || py < -2)) {
    touchScaleX = touchScaleY = 1 / dpr;
    px *= touchScaleX; py *= touchScaleY;
    // 归一后仍越出窗口：可能是横屏轴对调等异常语义，探针之外再告警一次
    if (px > vw + 4 || py > vh + 4 || px < -4 || py < -4) {
      try { console.warn("[probe] touch still out of window after DPR normalize", JSON.stringify({ px: px, py: py, vw: vw, vh: vh })); } catch (e) {}
    }
  } else {
    px *= touchScaleX; py *= touchScaleY;
  }
  if (!touchProbed) {
    touchProbed = true;
    try {
      console.log("[probe] touch", JSON.stringify({
        clientX: touch.clientX, clientY: touch.clientY,
        screenX: touch.screenX, screenY: touch.screenY,
        vw: vw, vh: vh, dpr: dpr,
        screenW: sysInfo.screenWidth, screenH: sysInfo.screenHeight,
        norm: touchScaleX
      }));
    } catch (e) {}
  }
  return { px: px, py: py };
}

function toWorld(touch) {
  // 抖音文档只保证 screenX/screenY；浏览器与微信提供 clientX，做兜底
  var p = rawPoint(touch);
  return { x: (p.px - offX) / scale, y: (p.py - offY) / scale };
}

function flash(id) {
  view.pressed[id] = true;
  setTimeout(function () { view.pressed[id] = false; }, 110);
}

function pressAction(id) {
  if (id === "pause") {
    if (game.mode === "fight") {
      game.paused = !game.paused;
      if (!game.paused) audio.ensure(); // 解除暂停：恢复可能挂起的音频（与点按继续/onShow 一致）
    }
    return;
  }
  game.press(id); // left/right 不走这里；attack/guard/dodge/jump/heal
}

api.onTouchStart(function (e) {
  var touches = e.changedTouches || [];
  for (var i = 0; i < touches.length; i++) {
    var t = touches[i];
    var p = toWorld(t);

    if (game.mode !== "fight") { tapFlow(); return; }
    if (game.paused) { game.paused = false; audio.ensure(); return; } // 暂停层：点按即继续，恢复可能挂起的音频

    var pb = R.touch.hitPause(p.x, p.y);
    if (pb) { flash(pb.id); pressAction(pb.id); continue; }
    var b = R.touch.hitTest(p.x, p.y);
    if (!b) continue;
    if (b.kind === "held") {
      heldTouches[t.identifier] = b.id;
      view.pressed[b.id] = true;
      game.setHeld(b.id, true);
    } else {
      flash(b.id);
      pressAction(b.id);
    }
  }
});

function releaseTouches(e) {
  var touches = e.changedTouches || [];
  for (var i = 0; i < touches.length; i++) {
    var key = touches[i].identifier;
    var id = heldTouches[key];
    if (!id) continue;
    delete heldTouches[key];
    var still = false; // 另一根手指可能仍按着同键
    for (var k in heldTouches) if (heldTouches[k] === id) still = true;
    if (!still) {
      view.pressed[id] = false;
      game.setHeld(id, false);
    }
  }
}

function releaseAllHeld() {
  for (var id in view.pressed) view.pressed[id] = false;
  for (var k in heldTouches) game.setHeld(heldTouches[k], false);
  heldTouches = {};
}

api.onTouchEnd(releaseTouches);
api.onTouchCancel(releaseTouches);

// 切后台：松键 + 自动暂停（防被白打）；回来丢弃累积时间避免一帧连跳
var last = Date.now();
api.onShow(function () { last = Date.now(); audio.ensure(); }); // 回前台：AudioContext 可能已 suspended
if (api.onHide) api.onHide(function () {
  releaseAllHeld();
  if (game.mode === "fight" && !game.paused) game.paused = true;
  last = Date.now();
});

/* ---------- 固定步长主循环 ---------- */

var STEP = 1 / 60;
var acc = 0;
var prevMode = game.mode;

// 真机音频节点缺失/语义偏差时只静音，绝不能让异常逃出帧循环冻结游戏
function playEvent(ev) {
  try { audio.play(ev); } catch (e) { /* 静默降级 */ }
}

function frame() {
  var now = Date.now();
  var dt = (now - last) / 1000;
  last = now;
  acc += Math.min(dt, 0.1);

  // 两帧之间的触摸/流程事件（开场鼓等）先排空，否则被 update() 清队列静默丢弃
  if (game.events.length) {
    for (var k = 0; k < game.events.length; k++) playEvent(game.events[k]);
    game.events.length = 0;
  }

  var guard = 0;
  while (acc >= STEP && guard < 5) {
    game.update(STEP);
    for (var i = 0; i < game.events.length; i++) playEvent(game.events[i]);
    acc -= STEP;
    guard++;
  }
  acc = Math.min(acc, STEP * 2);

  // 监测 fight → death 翻变，记录死亡时刻供防连点
  if (prevMode !== "death" && game.mode === "death") deathAt = Date.now();
  prevMode = game.mode;

  // letterbox 黑边
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, vw * dpr, vh * dpr);

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  R.draw(ctx, game);
  R.touch.draw(ctx, game, view.pressed);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
