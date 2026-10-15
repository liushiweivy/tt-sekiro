/* render-bg.js — 五套程序化场景：城山月夜 / 雪堡 / 雨桥 / 余烬 / 樱月 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./render.js"));
  } else {
    factory(root.SekiroRender);
  }
})(typeof self !== "undefined" ? self : this, function (R) {
  "use strict";
  var W = R.W, H = R.H, hash = R.hash;

  var THEMES = {
    castle: {
      sky: ["#070a13", "#10162a", "#1b2340"],
      ridge1: "#0c1120", ridge2: "#101628", ridge3: "#141b30",
      moon: "#ece4cd", haze: [190, 205, 235], ground: ["#171920", "#0c0d12"],
      stars: 46, particle: "ember", castle: true,
    },
    snow: {
      sky: ["#0a1122", "#16213a", "#27324c"],
      ridge1: "#101a2e", ridge2: "#17243c", ridge3: "#1e2e48",
      moon: "#f2f4fa", haze: [205, 218, 240], ground: ["#2a3145", "#181d2c"],
      stars: 32, particle: "snow", castle: false,
    },
    rain: {
      sky: ["#060912", "#0d1422", "#18202f"],
      ridge1: "#0a101c", ridge2: "#0e1522", ridge3: "#131c2c",
      moon: "#aebfd4", haze: [150, 170, 195], ground: ["#151a22", "#0b0e14"],
      stars: 10, particle: "rain", castle: false,
    },
    ember: {
      sky: ["#0c0607", "#1b0e12", "#331710"],
      ridge1: "#140a0c", ridge2: "#1c0e10", ridge3: "#241112",
      moon: "#e8b89a", haze: [230, 150, 90], ground: ["#1c1313", "#0e0a0a"],
      stars: 18, particle: "ember", castle: true, emberGlow: true,
    },
    sakura: {
      sky: ["#0b0a18", "#181230", "#2a1d44"],
      ridge1: "#120e24", ridge2: "#181330", ridge3: "#1f1838",
      moon: "#f3e6f5", haze: [225, 180, 225], ground: ["#1b1526", "#0e0a16"],
      stars: 30, particle: "petal", castle: false,
    },
  };

  function ridge(ctx, base, color, xs, ys, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base);
    for (var i = 0; i < xs.length; i++) ctx.lineTo(xs[i] * W, base - ys[i] * amp);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function pagoda(ctx, x, base, w, h, tiers, color) {
    ctx.fillStyle = color || "#080c16";
    for (var i = 0; i < tiers; i++) {
      var ty = base - h * (i + 1) / tiers;
      var tw = w * (1 - i * 0.16);
      ctx.fillRect(x - tw / 2, ty, tw, h / tiers * 0.7);
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.62, ty);
      ctx.lineTo(x, ty - 9);
      ctx.lineTo(x + tw * 0.62, ty);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(x - 1, base - h - 16, 2, 18);
  }

  function reeds(ctx, x, y, n, t, dark) {
    ctx.strokeStyle = dark || "#0a0c12";
    ctx.lineWidth = 2;
    for (var i = 0; i < n; i++) {
      var rx = x + i * 11 + hash(i) * 8;
      var rh = 60 + hash(i + 30) * 50;
      var sway = Math.sin(t * 0.9 + i * 1.7) * 7;
      ctx.beginPath();
      ctx.moveTo(rx, y);
      ctx.quadraticCurveTo(rx + sway * 0.5, y - rh * 0.6, rx + sway, y - rh);
      ctx.stroke();
      ctx.fillStyle = "#2a2018";
      ctx.beginPath(); ctx.ellipse(rx + sway, y - rh, 2.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------------- 粒子层 ---------------- */

  function particles(ctx, th, t) {
    if (th.particle === "snow") {
      ctx.fillStyle = "rgba(235,242,255,0.85)";
      for (var i = 0; i < 80; i++) {
        var sx = (hash(i) * W + t * (18 + hash(i + 3) * 26)) % (W + 30) - 15;
        var sy = (hash(i + 50) * H + t * (50 + hash(i + 7) * 40)) % H;
        var sw = Math.sin(t * 2 + i) * 8;
        ctx.globalAlpha = 0.35 + hash(i + 9) * 0.5;
        ctx.beginPath();
        ctx.ellipse(sx + sw, sy, 1.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (th.particle === "rain") {
      ctx.strokeStyle = "rgba(165,185,215,0.4)";
      ctx.lineWidth = 1;
      var len = 14;
      for (var j = 0; j < 90; j++) {
        var rx = (hash(j) * W - t * 900) % W;
        if (rx < -20) rx += W;
        var ry = (hash(j + 40) * H + t * 1100) % H;
        ctx.globalAlpha = 0.2 + hash(j + 2) * 0.35;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + len);
        ctx.stroke();
      }
    } else if (th.particle === "petal") {
      for (var k = 0; k < 34; k++) {
        var px = (hash(k) * (W + 80) + Math.sin(t * 0.7 + k) * 40 + t * (12 + hash(k + 8) * 18)) % (W + 40) - 20;
        var py = (hash(k + 60) * H + t * (26 + hash(k + 11) * 22)) % H;
        ctx.globalAlpha = 0.5 + hash(k) * 0.4;
        ctx.fillStyle = hash(k + 1) > 0.5 ? "#f2b8d8" : "#e89cc6";
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.sin(t * 2 + k) * 1.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.2, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // 余烬火星
      var n = th.emberGlow ? 22 : 12;
      for (var m = 0; m < n; m++) {
        var ex = (hash(m) * W + t * (10 + hash(m + 9) * 14)) % W;
        var ey = R.GY - 40 - ((t * (14 + hash(m) * 10) + hash(m + 5) * 300) % 320);
        ctx.globalAlpha = 0.3 + 0.35 * Math.sin(t + m);
        ctx.fillStyle = th.emberGlow ? (m % 3 ? "#ff8a4d" : "#ffd0a0")
          : (m % 3 ? "#ffb066" : "#ffe3a3");
        ctx.fillRect(ex, ey, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  R.bg.background = function (ctx, g) {
    var th = THEMES[(g.enemy && g.enemy.wave.theme) || "castle"];
    var t = g.time;

    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(0.55, th.sky[1]);
    sky.addColorStop(1, th.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 星
    ctx.fillStyle = "rgba(220,228,255,0.7)";
    for (var i = 0; i < th.stars; i++) {
      var sx = hash(i) * W, sy = hash(i + 100) * 250;
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.globalAlpha = 0.2 + tw * 0.5;
      ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // 月与光晕（雨景淡、樱景粉晕）
    var mx = 752, my = 108, mr = 46;
    var glowColor = th.particle === "petal" ? "rgba(240,200,235,0.26)"
      : th.emberGlow ? "rgba(255,180,120,0.22)"
      : "rgba(238,232,205," + (th.particle === "rain" ? 0.12 : 0.28) + ")";
    var glow = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, "rgba(238,232,205,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
    ctx.globalAlpha = th.particle === "rain" ? 0.55 : 1;
    ctx.fillStyle = th.moon;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(150,145,125,0.22)";
    ctx.beginPath(); ctx.arc(mx - 12, my - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 14, my + 10, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 远山与建筑剪影
    ridge(ctx, 330, th.ridge1, [0, 0.12, 0.3, 0.48, 0.66, 0.85, 1], [0.5, 0.35, 0.52, 0.3, 0.46, 0.34, 0.5], 90);
    ridge(ctx, 360, th.ridge2, [0, 0.18, 0.4, 0.62, 0.82, 1], [0.6, 0.42, 0.58, 0.4, 0.55, 0.62], 70);
    if (th.castle) {
      pagoda(ctx, 500, 356, 86, 120, 4);
      pagoda(ctx, 500 - 92, 364, 56, 70, 3);
      pagoda(ctx, 500 + 96, 362, 60, 80, 3);
    } else if (th.particle === "petal") {
      // 樱月：鸟居剪影
      ctx.fillStyle = th.ridge3;
      ctx.fillRect(560, 312, 12, 48);
      ctx.fillRect(640, 300, 12, 60);
      ctx.fillRect(548, 306, 116, 9);
      ctx.fillRect(540, 296, 132, 8);
    } else {
      pagoda(ctx, 470, 358, 70, 92, 3, th.ridge3);
    }
    ridge(ctx, 386, th.ridge3, [0, 0.1, 0.28, 0.5, 0.72, 0.9, 1], [0.72, 0.6, 0.74, 0.58, 0.7, 0.62, 0.7], 50);

    // 地平线火光（余烬主题）
    if (th.emberGlow) {
      var fg2 = ctx.createLinearGradient(0, R.GY - 70, 0, R.GY);
      fg2.addColorStop(0, "rgba(255,120,50,0)");
      fg2.addColorStop(1, "rgba(255,110,40,0.16)");
      ctx.fillStyle = fg2;
      ctx.fillRect(0, R.GY - 70, W, 70);
    }

    // 地面
    var gnd = ctx.createLinearGradient(0, R.GY, 0, H);
    gnd.addColorStop(0, th.ground[0]);
    gnd.addColorStop(1, th.ground[1]);
    ctx.fillStyle = gnd;
    ctx.fillRect(0, R.GY, W, H - R.GY);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (var y = R.GY + 18; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // 雪地反光 / 雨地水光
    if (th.particle === "snow") {
      ctx.fillStyle = "rgba(220,232,255,0.07)";
      ctx.fillRect(0, R.GY, W, 5);
    } else if (th.particle === "rain") {
      ctx.fillStyle = "rgba(150,180,220,0.06)";
      for (var q = 0; q < 6; q++) {
        var qx = (hash(q) * W + t * 30) % W;
        ctx.beginPath(); ctx.ellipse(qx, R.GY + 14 + q * 14, 60, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    reeds(ctx, 30, R.GY + 6, 14, t, th.particle === "snow" ? "#0c1018" : "#0a0c12");
    reeds(ctx, W - 150, R.GY + 6, 18, t + 2);

    // 飘雾
    ctx.fillStyle = "rgba(" + th.haze[0] + "," + th.haze[1] + "," + th.haze[2] + ",0.05)";
    for (var k2 = 0; k2 < 3; k2++) {
      var wy = R.GY - 26 + k2 * 16;
      var off = (t * (8 + k2 * 5)) % (W + 400);
      ctx.beginPath();
      ctx.ellipse(off - 200, wy, 320, 12 + k2 * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    particles(ctx, th, t);
  };

  return R;
});
