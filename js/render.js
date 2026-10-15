/* render.js — 渲染命名空间与主入口：场景/角色/HUD/过场由各 render-*.js 扩展 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./core.js"));
  } else {
    root.SekiroRender = factory(root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (Sekiro) {
  "use strict";

  var CFG = Sekiro.CFG;
  var FONT = '"KaiTi","STKaiti","Noto Serif SC","SimSun",serif';

  var R = {
    W: 960, H: 540, GY: CFG.GROUND,
    FONT: FONT, DEG: Math.PI / 180,
    bg: {}, figure: {}, hud: {}, screens: {},
    font: function (size, weight) { return (weight || 700) + " " + size + "px " + FONT; },
    hash: function (i) {
      var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    },
    roundRect: function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
  };

  /* ---------------- 飞行物（子弹 / 返雷雷球） ---------------- */

  function drawBullets(ctx, g) {
    for (var i = 0; i < g.bullets.length; i++) {
      var b = g.bullets[i];
      if (b.kind === "bolt") {
        // 返雷：锯齿闪电
        ctx.save();
        ctx.strokeStyle = "#dcefff";
        ctx.shadowColor = "#7fc4ff";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.beginPath();
        var x0 = b.x - b.vx * 0.05, y0 = b.y;
        ctx.moveTo(x0, y0);
        for (var s = 1; s <= 4; s++) {
          var t = s / 4;
          ctx.lineTo(x0 + (b.x - x0) * t,
            b.y + (R.hash(i * 7 + s) - 0.5) * 22);
        }
        ctx.stroke();
        ctx.fillStyle = "#eaf6ff";
        ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // 火枪弹：黄色曳光
        ctx.save();
        ctx.strokeStyle = "rgba(255,214,120,0.85)";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#ffb44d";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.035, b.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = "#fff0c0";
        ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  /* ---------------- 特效 ---------------- */

  function drawFx(ctx, g) {
    for (var i = 0; i < g.fx.length; i++) {
      var f = g.fx[i];
      var k = f.kind === "text" ? 0 : f.t / f.life;
      if (f.kind === "spark") {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = f.size;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - f.vx * 0.03, f.y + f.vy * 0.03);
        ctx.stroke();
      } else if (f.kind === "ring") {
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 12 + k * 52, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === "text") {
        var life = f.t / f.life;
        ctx.globalAlpha = life < 0.15 ? life / 0.15 : 1 - (life - 0.15) * 0.6;
        ctx.font = R.font(f.size, 900);
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPost(ctx, g) {
    var p = g.player;
    // 受击红闪
    if (g.flash) {
      ctx.fillStyle = g.flash.color + g.flash.a + ")";
      ctx.fillRect(0, 0, R.W, R.H);
    }
    // 低血量暗角 + 心跳
    if (g.mode === "fight" && p.hp > 0 && p.hp < 30) {
      var pulse = 0.55 + 0.3 * Math.sin(g.time * (p.hp < 15 ? 9 : 6));
      var vg = ctx.createRadialGradient(R.W / 2, R.H / 2, 200, R.W / 2, R.H / 2, 560);
      vg.addColorStop(0, "rgba(120,0,0,0)");
      vg.addColorStop(1, "rgba(90,0,0," + (0.4 * pulse) + ")");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, R.W, R.H);
    }
  }

  /* ---------------- 入口 ---------------- */

  R.draw = function (ctx, g) {
    ctx.save();
    if (g.shake > 0 && g.mode === "fight") {
      var m = g.shake * 11;
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    R.bg.background(ctx, g);
    if (g.mode !== "title") {
      if (g.enemy && g.enemy.x < g.player.x) { R.figure.enemy(ctx, g); R.figure.wolf(ctx, g); }
      else { R.figure.wolf(ctx, g); if (g.enemy) R.figure.enemy(ctx, g); }
      drawBullets(ctx, g);
      drawFx(ctx, g);
      R.hud.draw(ctx, g);
      R.hud.banner(ctx, g);
    }
    ctx.restore();

    if (g.mode !== "title") drawPost(ctx, g);
    if (g.mode === "title") R.screens.title(ctx, g);
    if (g.mode === "death") R.screens.death(ctx, g);
    if (g.mode === "victory") R.screens.victory(ctx, g);
    if (g.paused && g.mode === "fight") R.screens.pause(ctx);
  };

  return R;
});
