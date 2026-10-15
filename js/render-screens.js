/* render-screens.js — 标题 / 死亡 / 通关评价 / 暂停 四个全屏画面 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./render.js"), require("./core.js"));
  } else {
    factory(root.SekiroRender, root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (R, Sekiro) {
  "use strict";
  var W = R.W, H = R.H;

  var STYLE_TAG = {
    melee: "太刀",
    ranger: "火铳",
    spear: "长柄",
    ninja: "忍手",
    boss: "剑圣",
  };

  function dim(ctx, a) {
    ctx.fillStyle = "rgba(4,4,8," + a + ")";
    ctx.fillRect(0, 0, W, H);
  }

  function fmtTime(t) {
    t = Math.max(0, Math.floor(t));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------------- 标题 ---------------- */

  R.screens.title = function (ctx, g) {
    dim(ctx, 0.55);
    var STAGES = Sekiro.Bestiary.STAGES;

    // 主标题
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = R.font(64, 900);
    ctx.fillStyle = "#f2ecdc";
    ctx.shadowColor = "rgba(194,59,46,0.55)";
    ctx.shadowBlur = 26;
    ctx.fillText("影 狼", W / 2, 104);
    ctx.shadowBlur = 0;
    ctx.font = R.font(22, 700);
    ctx.fillStyle = "#c23b2e";
    ctx.fillText("弹 剑 道 场 · 七 阵 闯 关", W / 2, 156);

    // 七阵名录
    var listX = 150, listY = 210, rowH = 31;
    ctx.textAlign = "left";
    ctx.font = R.font(15, 700);
    STAGES.forEach(function (s, i) {
      var y = listY + i * rowH;
      var num = i + 1;
      ctx.fillStyle = i === STAGES.length - 1 ? "#ffd96b" : "rgba(232,226,207,0.85)";
      ctx.font = R.font(15, 800);
      ctx.fillText(num < 7 ? "第" + ["一", "二", "三", "四", "五", "六"][i] + "阵" : "最终阵", listX, y);
      ctx.fillStyle = "#f2ecdc";
      ctx.font = R.font(18, 800);
      ctx.fillText(s.name, listX + 76, y);
      var nameW = ctx.measureText(s.name).width;
      // 命数标记（必须在 18px 字体下量完名字宽度再切字体）
      if (s.nodes.length > 1) {
        ctx.font = R.font(12, 700);
        ctx.fillStyle = "#d8483f";
        ctx.fillText("●".repeat(s.nodes.length), listX + 76 + nameW + 12, y);
      }
      ctx.font = R.font(12, 700);
      ctx.fillStyle = "rgba(232,226,207,0.5)";
      ctx.fillText(STYLE_TAG[s.style] || "", listX + 300, y);
    });

    // 操作卡
    var cx = 560, cy = 214;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(232,226,207,0.92)";
    ctx.font = R.font(17, 800);
    ctx.fillText("操作", cx, cy);
    var rows = [
      ["斩", "右下大刀键：左劈 → 右劈 二连斩"],
      ["弹", "刀光临身一瞬按弹 = 完美弹反"],
      ["垫", "垫步（按住方向可后撤），无敌帧"],
      ["跳", "跳跃 · 躲扫腿 · 空中可返雷"],
      ["葫", "伤药葫芦 ×3"],
      ["危招", "突刺→垫步  扫腿→跳  擒拿→逃  雷→空中斩"],
      ["停", "暂停"],
    ];
    ctx.font = R.font(13, 700);
    rows.forEach(function (r, i) {
      var y = cy + 30 + i * 25;
      ctx.fillStyle = "#c23b2e";
      ctx.fillText(r[0], cx, y);
      ctx.fillStyle = "rgba(232,226,207,0.78)";
      ctx.fillText(r[1], cx + 120, y);
    });

    // 开始提示（闪烁）
    var blink = 0.65 + 0.35 * Math.sin(g.time * 3.2);
    ctx.globalAlpha = blink;
    ctx.textAlign = "center";
    ctx.font = R.font(20, 800);
    ctx.fillStyle = "#ffd96b";
    ctx.fillText("点击画面 入阵", W / 2, H - 34);
    ctx.globalAlpha = 1;
  };

  /* ---------------- 死亡 ---------------- */

  R.screens.death = function (ctx, g) {
    dim(ctx, 0.62);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = R.font(110, 900);
    ctx.fillStyle = "#8e1716";
    ctx.shadowColor = "#ff2a1e";
    ctx.shadowBlur = 30;
    ctx.fillText("死", W / 2, H * 0.4);
    ctx.shadowBlur = 0;

    ctx.font = R.font(16, 700);
    ctx.fillStyle = "rgba(232,226,207,0.8)";
    var wave = g.stages[g.waveIndex];
    ctx.fillText("倒于 · " + (wave ? wave.name : "") +
      "（第 " + (g.stats.deaths || 1) + " 次阵亡）", W / 2, H * 0.4 + 70);

    var blink = 0.6 + 0.4 * Math.sin(g.time * 3.5);
    ctx.globalAlpha = blink;
    ctx.font = R.font(19, 800);
    ctx.fillStyle = "#ffd96b";
    ctx.fillText("点击画面 重开本阵", W / 2, H - 60);
    ctx.globalAlpha = 1;
  };

  /* ---------------- 通关评价 ---------------- */

  R.screens.victory = function (ctx, g) {
    dim(ctx, 0.6);
    var B = Sekiro.Bestiary;
    var grade = B.grade(g.stats, B.STAGES.length);
    var s = g.stats;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = R.font(46, 900);
    ctx.fillStyle = "#f2ecdc";
    ctx.shadowColor = "rgba(255,217,107,0.5)";
    ctx.shadowBlur = 22;
    ctx.fillText("七 阵 踏 破", W / 2, 80);
    ctx.shadowBlur = 0;

    // 段位印
    ctx.save();
    ctx.translate(W / 2, 185);
    ctx.strokeStyle = grade.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = grade.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = R.font(58, 900);
    ctx.fillStyle = grade.color;
    ctx.fillText(grade.mark, 0, 4);
    ctx.restore();

    ctx.font = R.font(22, 800);
    ctx.fillStyle = grade.color;
    ctx.fillText(grade.rank, W / 2, 268);

    // 战报
    var lines = [
      ["通关用时", fmtTime(s.clearT)],
      ["阵亡次数", s.deaths],
      ["伤药葫芦", s.gourdsUsed + " 次"],
      ["完美弹反", s.deflects + " 次" + (s.bulletDeflects ? "（含弹铳 " + s.bulletDeflects + "）" : "")],
      ["忍杀", s.kills + " 次"],
      ["剩余体力", Math.round(s.hpRatio * 100) + "%"],
    ];
    ctx.textAlign = "left";
    ctx.font = R.font(16, 700);
    var lw = 240, lx = W / 2 - lw / 2, ly = 310;
    lines.forEach(function (ln, i) {
      var y = ly + i * 27;
      ctx.fillStyle = "rgba(232,226,207,0.6)";
      ctx.fillText(ln[0], lx, y);
      ctx.fillStyle = "#f2ecdc";
      ctx.textAlign = "right";
      ctx.fillText(String(ln[1]), lx + lw, y);
      ctx.textAlign = "left";
    });

    var blink = 0.6 + 0.4 * Math.sin(g.time * 3.5);
    ctx.globalAlpha = blink;
    ctx.textAlign = "center";
    ctx.font = R.font(18, 800);
    ctx.fillStyle = "#ffd96b";
    ctx.fillText("点击画面 再战七阵", W / 2, H - 36);
    ctx.globalAlpha = 1;
  };

  /* ---------------- 暂停 ---------------- */

  R.screens.pause = function (ctx) {
    dim(ctx, 0.5);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = R.font(52, 900);
    ctx.fillStyle = "#f2ecdc";
    ctx.fillText("暂 停", W / 2, H * 0.42);
    ctx.font = R.font(16, 700);
    ctx.fillStyle = "rgba(232,226,207,0.75)";
    ctx.fillText("点击屏幕继续", W / 2, H * 0.42 + 52);
  };

  return R;
});
