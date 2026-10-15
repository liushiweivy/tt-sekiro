/* render-hud.js — 战斗 HUD：血条、架势、葫芦、七阵进度、教学提示、过场 Banner */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./render.js"), require("./core.js"));
  } else {
    factory(root.SekiroRender, root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (R, Sekiro) {
  "use strict";
  var CFG = Sekiro.CFG, DEG = R.DEG;
  var W = R.W;

  // 本阵教学提示的本地计时（按 waveIndex 记忆是否已展示）
  var tipSeen = {};
  var lastWave = -1;
  var tipT = 0;
  var TIP_TIME = 5.2;

  function resetTipMemory() {
    tipSeen = {};
    lastWave = -1;
    tipT = 0;
  }

  function bar(ctx, x, y, w, h, ratio, fill, back, edge) {
    ctx.fillStyle = back;
    R.roundRect(ctx, x, y, w, h, 2);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = fill;
      R.roundRect(ctx, x, y, Math.max(2, w * Math.min(1, ratio)), h, 2);
      ctx.fill();
    }
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    R.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.stroke();
  }

  // 葫芦小图标
  function gourd(ctx, x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = filled ? "#9b7a44" : "rgba(120,110,90,0.35)";
    ctx.fillStyle = filled ? "#8fce95" : "rgba(90,110,90,0.18)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 2, 5.2, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = filled ? "#6b5230" : "rgba(120,110,90,0.3)";
    ctx.fillRect(-1.6, -7, 3.2, 3.4);
    ctx.restore();
  }

  function keyHint(ctx, x, y, key, label) {
    ctx.font = R.font(11, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(232,226,207,0.55)";
    ctx.fillText(key + " " + label, x, y);
  }

  R.hud.draw = function (ctx, g) {
    var p = g.player, e = g.enemy;

    // 新阵教学提示计时
    if (g.waveIndex !== lastWave) {
      lastWave = g.waveIndex;
      if (g.waveIndex >= 0 && !tipSeen[g.waveIndex]) {
        tipSeen[g.waveIndex] = true;
        tipT = TIP_TIME;
      }
    }
    if (tipT > 0) tipT = Math.max(0, tipT - 1 / 60);

    /* ---- 玩家面板（左上） ---- */
    var px = 26, py = 24;
    ctx.font = R.font(15, 800);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e8e2cf";
    ctx.fillText("狼", px, py);
    bar(ctx, px + 26, py - 12, 220, 10, p.hp / CFG.MAX_HP,
      "#c23b2e", "rgba(20,10,10,0.72)", "rgba(232,226,207,0.35)");
    // 架势条：越满越偏橙红
    var pPost = p.posture / CFG.MAX_POSTURE;
    var pCol = pPost > 0.75 ? "#ff7a3d" : "#e8c468";
    bar(ctx, px + 26, py + 2, 220, 5, pPost,
      pCol, "rgba(20,16,8,0.72)", "rgba(232,226,207,0.25)");
    // 葫芦
    for (var i = 0; i < CFG.GOURD_MAX; i++) {
      gourd(ctx, px + 30 + i * 18, py + 22, i < p.gourds);
    }
    ctx.font = R.font(11, 700);
    ctx.fillStyle = "rgba(232,226,207,0.6)";
    ctx.fillText(R.touchMode ? "伤药葫芦" : "伤药葫芦  F", px + 30 + CFG.GOURD_MAX * 18 + 8, py + 23);

    /* ---- 敌人面板（右上） ---- */
    if (e) {
      var ew = 240, ex = W - 26 - ew;
      ctx.font = R.font(16, 800);
      ctx.textAlign = "right";
      ctx.fillStyle = "#e8e2cf";
      ctx.fillText(e.name, W - 26, py);
      bar(ctx, ex, py - 12, ew, 10, e.hp / e.maxHp,
        "#a52e2a", "rgba(20,8,8,0.72)", "rgba(232,226,207,0.35)");
      var ePost = e.posture / CFG.MAX_POSTURE;
      var eCol = ePost > 0.75 ? "#ffd24d" : "#e0a24a";
      bar(ctx, ex, py + 2, ew, 5, ePost,
        eCol, "rgba(22,16,8,0.72)", "rgba(232,226,207,0.25)");
      // 管命点
      ctx.textAlign = "right";
      for (var n = 0; n < e.nodes; n++) {
        var pipX = W - 28 - n * 15;
        ctx.beginPath();
        ctx.fillStyle = "#d8483f";
        ctx.shadowColor = "#ff5a4d";
        ctx.shadowBlur = 6;
        ctx.arc(pipX, py + 22, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    /* ---- 七阵进度（顶部中央） ---- */
    var total = g.stages.length;
    var dotY = 20, spacing = 22;
    var startX = W / 2 - ((total - 1) * spacing) / 2;
    for (var d = 0; d < total; d++) {
      var dx = startX + d * spacing;
      var done = d < g.waveIndex, cur = d === g.waveIndex;
      ctx.beginPath();
      if (cur) {
        var rp = 5.4 + Math.sin(g.time * 5) * 0.9;
        ctx.fillStyle = "#ffd96b";
        ctx.shadowColor = "#ffd96b";
        ctx.shadowBlur = 10;
        ctx.arc(dx, dotY, rp, 0, Math.PI * 2);
      } else if (done) {
        ctx.fillStyle = "#c23b2e";
        ctx.arc(dx, dotY, 4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = "rgba(232,226,207,0.28)";
        ctx.arc(dx, dotY, 3.4, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* ---- 本阵教学提示 ---- */
    if (tipT > 0 && g.mode === "fight" && e && e.wave && e.wave.tip) {
      var a = tipT > TIP_TIME - 0.4 ? (TIP_TIME - tipT) / 0.4
        : tipT < 0.8 ? tipT / 0.8 : 1;
      ctx.globalAlpha = a;
      var txt = e.wave.tip;
      ctx.font = R.font(15, 700);
      var tw = ctx.measureText(txt).width + 34;
      ctx.fillStyle = "rgba(10,8,6,0.72)";
      ctx.strokeStyle = "rgba(232,226,207,0.35)";
      ctx.lineWidth = 1;
      R.roundRect(ctx, W / 2 - tw / 2, 44, tw, 34, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f0e8d4";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, W / 2, 61);
      ctx.globalAlpha = 1;
    }

    /* ---- 操作小抄（右下，淡显；触屏版由虚拟键自带文字，不重复绘制） ---- */
    if (g.mode === "fight" && !R.touchMode) {
      ctx.textBaseline = "middle";
      var hints = [["左键/J", "斩"], ["右键/K", "弹/格"], ["L", "垫步"], ["空格", "跳"], ["F", "葫芦"], ["P", "暂停"]];
      var hx = W - 30;
      ctx.font = R.font(11, 700); // 先切字体再测宽，保证右对齐
      for (var h = hints.length - 1; h >= 0; h--) {
        var wd = ctx.measureText(hints[h][0] + " " + hints[h][1]).width;
        keyHint(ctx, hx - wd, R.H - 24 - (hints.length - 1 - h) * 17,
          hints[h][0], hints[h][1]);
      }
    }
    ctx.textBaseline = "alphabetic";
  };

  R.hud.banner = function (ctx, g) {
    var b = g.banner;
    if (!b) return;
    var p = 1 - b.t / b.tmax;            // 0→1
    var ease = p < 0.22 ? p / 0.22 : 1; // 入场
    var out = b.t < 0.45 ? b.t / 0.45 : 1;
    var a = Math.min(ease, out);
    var x = W / 2 + (1 - ease) * 60 * (b.peril ? 0 : 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (b.peril) {
      // 忍殺 / 觉醒称号：红墨竖劈感
      ctx.fillStyle = "#e32326";
      ctx.shadowColor = "#ff3030";
      ctx.shadowBlur = 22;
      ctx.font = R.font(72, 900);
      ctx.fillText(b.main, x, R.H * 0.38);
      if (b.sub) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(232,226,207,0.92)";
        ctx.font = R.font(18, 700);
        ctx.fillText(b.sub, x, R.H * 0.38 + 56);
      }
    } else {
      // 阵名入场：竖线 + 大标题
      var lineH = 86 * ease;
      ctx.strokeStyle = "rgba(194,59,46,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 130, R.H * 0.36 - lineH / 2);
      ctx.lineTo(x - 130, R.H * 0.36 + lineH / 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(232,226,207,0.9)";
      ctx.font = R.font(20, 700);
      ctx.fillText(b.main, x - 90, R.H * 0.36 - 14);
      ctx.fillStyle = "#f2ecdc";
      ctx.font = R.font(42, 900);
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 12;
      ctx.textAlign = "left";
      ctx.fillText(b.sub, x - 90, R.H * 0.36 + 20);
    }
    ctx.restore();
  };

  R.hud.resetTips = resetTipMemory;

  return R;
});
