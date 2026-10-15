/*
 * render-touch.js — 抖音/微信小游戏触屏虚拟键（960x540 世界坐标内绘制）
 * 左下：◀ ▶（按住）跳；右下：葫 垫 弹 斩；右上：暂停。
 * hitR 可大于可视 r，保证最小热区 ≥44px；命中判定只看 hitR。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./render.js"));
  } else {
    factory(root.SekiroRender);
  }
})(typeof self !== "undefined" ? self : this, function (R) {
  "use strict";

  // hitR 与可视 r 解耦：横屏缩放下保证最小命中直径（典型手机 scale≈0.7 时仍 ≥44px）
  var BUTTONS = [
    { id: "left", kind: "held", x: 44, y: 486, r: 28, hitR: 34, label: "◀" },
    { id: "right", kind: "held", x: 118, y: 486, r: 28, hitR: 34, label: "▶" },
    { id: "jump", kind: "tap", x: 196, y: 496, r: 26, hitR: 32, label: "跳" },
    { id: "heal", kind: "tap", x: 700, y: 470, r: 22, hitR: 26, label: "葫" },
    { id: "dodge", kind: "tap", x: 752, y: 502, r: 24, hitR: 32, label: "垫" },
    { id: "guard", kind: "tap", x: 824, y: 488, r: 32, hitR: 36, label: "弹" },
    { id: "attack", kind: "tap", x: 906, y: 472, r: 36, hitR: 40, label: "斩" },
    { id: "pause", kind: "tap", x: R.W - 30, y: 80, r: 15, hitR: 24, label: "‖", fightOnly: true },
  ];

  var ACCENT = {
    left: "rgba(232,226,207,0.75)",
    right: "rgba(232,226,207,0.75)",
    jump: "#8fc7e8",
    heal: "#7ee49a",
    dodge: "#5fd0e0",
    guard: "#ffd96b",
    attack: "#e8e2cf",
    pause: "rgba(232,226,207,0.7)",
  };

  function hitTest(x, y) {
    for (var i = 0; i < BUTTONS.length; i++) {
      var b = BUTTONS[i];
      if (b.fightOnly) continue; // 暂停键由调用方按模式过滤
      var rr = b.hitR || b.r;
      var dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy <= rr * rr) return b;
    }
    return null;
  }

  function hitPause(x, y) {
    var b = BUTTONS[BUTTONS.length - 1];
    var dx = x - b.x, dy = y - b.y;
    return dx * dx + dy * dy <= b.hitR * b.hitR ? b : null;
  }

  function draw(ctx, g, pressed) {
    for (var i = 0; i < BUTTONS.length; i++) {
      var b = BUTTONS[i];
      if (b.fightOnly && g.mode !== "fight") continue;
      if (!b.fightOnly && (g.mode !== "fight" || g.paused)) continue;
      var on = !!pressed[b.id];
      var accent = ACCENT[b.id] || "#e8e2cf";
      var empty = b.id === "heal" && g.player.gourds <= 0;
      if (empty) accent = "rgba(140,140,140,0.5)";

      ctx.save();
      ctx.globalAlpha = on ? 0.9 : 0.5;
      ctx.fillStyle = on ? accent : "rgba(10,13,22,0.66)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = b.id === "guard" ? 3 : 2;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = on ? "#0c0f18" : accent;
      ctx.font = b.label.length > 1
        ? "800 " + Math.round(b.r * 0.62) + "px " + R.FONT
        : "700 " + Math.round(b.r * 0.95) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y + 1);

      // 葫芦余量
      if (b.id === "heal" && !empty) {
        ctx.font = R.font(11, 800);
        ctx.fillStyle = "rgba(232,226,207,0.85)";
        ctx.fillText("×" + g.player.gourds, b.x, b.y + b.r + 9);
      }
    }
    ctx.textBaseline = "alphabetic";
  }

  R.touch = { BUTTONS: BUTTONS, draw: draw, hitTest: hitTest, hitPause: hitPause };
  return R;
});
