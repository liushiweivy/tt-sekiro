/* render-figure.js — 火柴人武士：狼 + 五种敌人外形与全部战斗姿态 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./render.js"), require("./core.js"));
  } else {
    factory(root.SekiroRender, root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (R, Sekiro) {
  "use strict";
  var CFG = Sekiro.CFG, DEG = R.DEG, GY = R.GY;
  var roundRect = R.roundRect;

  function shadow(ctx, x, y) {
    var s = 1 - Math.min(0.6, y / 200);
    ctx.fillStyle = "rgba(0,0,0," + (0.35 * s) + ")";
    ctx.beginPath();
    ctx.ellipse(x, GY + 4, 30 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function figure(ctx, x, y, dir, pose, opt) {
    ctx.save();
    ctx.translate(x, GY - y);
    ctx.scale(dir, 1);
    if (pose.afterimages) {
      for (var a = 1; a <= 2; a++) {
        ctx.save();
        ctx.translate(-a * 13, 0);
        ctx.globalAlpha = 0.13;
        body(ctx, pose, opt, true);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    body(ctx, pose, opt, false);
    ctx.restore();
  }

  function leg(ctx, x0, y0, x1, y1, crouch) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (crouch > 20) ctx.lineTo((x0 + x1) / 2, y0 + 6);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawHead(ctx, hx, hy, opt) {
    if (opt.head === "hat") {
      // 阵笠
      ctx.fillStyle = opt.hat || "#3c4452";
      ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 15, hy - 1);
      ctx.quadraticCurveTo(hx, hy - 16, hx + 15, hy - 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0a0c12";
      ctx.fillRect(hx - 9, hy + 2, 18, 3);
    } else if (opt.head === "bald") {
      ctx.fillStyle = opt.skin;
      ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(120,80,50,0.5)";
      ctx.beginPath(); ctx.arc(hx, hy - 2, 5, Math.PI, 0); ctx.fill();
    } else if (opt.head === "hood") {
      ctx.fillStyle = opt.hood || "#211c30";
      ctx.beginPath(); ctx.arc(hx, hy, 10, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0c0a14"; // 蒙面
      ctx.fillRect(hx - 7, hy + 1, 14, 4);
      ctx.fillStyle = opt.skin;
      ctx.fillRect(hx - 5, hy - 1, 10, 3);
    } else if (opt.head === "white") {
      ctx.fillStyle = opt.skin;
      ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e6e2d8"; // 白发
      ctx.beginPath(); ctx.arc(hx - 1, hy - 2, 8, Math.PI * 0.95, Math.PI * 1.95); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 3, hy - 11, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b93027";
      ctx.fillRect(hx - 8, hy - 3, 16, 2.6);
    } else if (opt.helmet) {
      ctx.fillStyle = opt.helmet;
      ctx.beginPath(); ctx.arc(hx, hy, 10.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(hx - 10, hy - 2, 20, 7);
      if (opt.general) {
        ctx.strokeStyle = "#c9a14a";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx - 6, hy - 8); ctx.lineTo(hx - 16, hy - 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + 6, hy - 8); ctx.lineTo(hx + 16, hy - 24); ctx.stroke();
      }
      ctx.fillStyle = "#05060a";
      ctx.fillRect(hx - 8, hy + 2, 16, 3);
    } else {
      ctx.fillStyle = opt.skin;
      ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = opt.hair || "#0e1016";
      ctx.beginPath(); ctx.arc(hx - 1, hy - 2, 8, Math.PI * 0.95, Math.PI * 1.95); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 2, hy - 11, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b93027";
      ctx.fillRect(hx - 8, hy - 4, 16, 2.6);
    }
  }

  function body(ctx, p, opt) {
    var crouch = p.crouch || 0;
    var lean = p.lean || 0;
    var legSwing = p.legSwing || 0;
    var hipY = -40 + crouch, shoulderY = -66 + crouch;

    ctx.lineCap = "round";
    ctx.strokeStyle = opt.leg;
    ctx.lineWidth = 6.5;
    leg(ctx, -3, hipY, -7 - legSwing * 11, 0, crouch);
    leg(ctx, 3, hipY, 7 + legSwing * 11, 0, crouch);
    if (p.kneel) {
      ctx.beginPath(); ctx.moveTo(3, hipY); ctx.lineTo(14, -6); ctx.stroke();
    }
    if (opt.cloak) {
      ctx.fillStyle = opt.cloak;
      ctx.beginPath();
      ctx.moveTo(-2 * Math.sign(lean || 1), shoulderY + 6);
      ctx.lineTo(-13, hipY + 14);
      ctx.lineTo(7, hipY + 12);
      ctx.lineTo(6, shoulderY + 8);
      ctx.closePath(); ctx.fill();
    }
    ctx.save();
    ctx.translate(0, shoulderY + 12);
    ctx.rotate(lean);
    ctx.fillStyle = opt.torso;
    roundRect(ctx, -9, -26, 18, 30, 5);
    ctx.fill();
    if (opt.armor) {
      ctx.strokeStyle = opt.armorLine;
      ctx.lineWidth = 1.5;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(-8, -20 + i * 8); ctx.lineTo(8, -20 + i * 8); ctx.stroke();
      }
    }
    if (opt.sash) {
      ctx.strokeStyle = opt.sash;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(9, -11); ctx.stroke();
    }
    if (opt.scarf) {
      var wt = opt.time || 0;
      ctx.fillStyle = opt.scarf;
      ctx.beginPath();
      ctx.moveTo(-4, -24);
      ctx.quadraticCurveTo(-22, -26 + Math.sin(wt * 6) * 3, -34, -18 + Math.sin(wt * 6 + 1) * 5);
      ctx.lineTo(-30, -12);
      ctx.quadraticCurveTo(-18, -18, -4, -17);
      ctx.closePath(); ctx.fill();
    }
    drawHead(ctx, 4, -36, opt);
    ctx.restore();

    // 武器
    var ang = (p.swordAngle == null ? -10 : p.swordAngle) * DEG;
    var hx0 = 5, hy0 = shoulderY + 2;
    var len = opt.bladeLen || 56;
    var glow = p.bladeGlow || opt.elec;
    if (opt.weapon === "rifle") {
      var rx = hx0 + Math.cos(ang) * 62, ry = hy0 - Math.sin(ang) * 62;
      ctx.strokeStyle = "#241a14"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(hx0 - 8, hy0 + 3); ctx.lineTo(hx0, hy0); ctx.stroke();
      ctx.strokeStyle = p.aimGlow ? "#8a8f98" : "#5b6068";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(rx, ry); ctx.stroke();
      if (p.aimGlow) {
        ctx.fillStyle = "rgba(255,220,130," + (0.6 + 0.4 * Math.sin((opt.time || 0) * 30)) + ")";
        ctx.beginPath(); ctx.arc(rx, ry, 3.4, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    if (opt.weapon === "spear") {
      var sx = hx0 + Math.cos(ang) * 84, sy = hy0 - Math.sin(ang) * 84;
      ctx.strokeStyle = "#5a3d26"; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(hx0 - Math.cos(ang) * 14, hy0 + Math.sin(ang) * 14); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = glow ? "#fffbe0" : "#d3dae6";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - Math.cos(ang - 0.5) * 13, sy + Math.sin(ang - 0.5) * 13);
      ctx.lineTo(sx - Math.cos(ang) * 7, sy + Math.sin(ang) * 7);
      ctx.lineTo(sx - Math.cos(ang + 0.5) * 13, sy + Math.sin(ang + 0.5) * 13);
      ctx.closePath(); ctx.fill();
    } else {
      var tx = hx0 + Math.cos(ang) * len, ty = hy0 - Math.sin(ang) * len;
      if (p.slashAlpha > 0) {
        var wide = p.slashWide ? 0.75 : 0.55;
        ctx.strokeStyle = (p.slashColor ? "rgba(255,180,150," : "rgba(255,255,240,") + p.slashAlpha + ")";
        ctx.lineWidth = p.slashWide ? 9 : 7;
        ctx.beginPath();
        ctx.arc(hx0, hy0, len, -ang - wide, -ang + wide + 0.1);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255," + p.slashAlpha + ")";
        ctx.stroke();
      }
      ctx.strokeStyle = opt.grip || "#3a2418";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx0 - Math.cos(ang) * 7, hy0 + Math.sin(ang) * 7);
      ctx.lineTo(hx0, hy0);
      ctx.stroke();
      var bladeColor = glow ? (opt.glowColor || "#fffbe0") : (opt.blade || "#cfd6e2");
      ctx.strokeStyle = bladeColor;
      ctx.shadowColor = opt.elec ? "#7fc4ff" : "transparent";
      ctx.shadowBlur = opt.elec ? 12 : 0;
      ctx.lineWidth = glow ? 3.6 : 2.6;
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.shadowBlur = 0;
      if (glow) {
        var gx2 = hx0 + Math.cos(ang) * len * 0.6;
        var gy2 = hy0 - Math.sin(ang) * len * 0.6;
        ctx.fillStyle = opt.glowColor || "rgba(255,240,160,0.9)";
        ctx.beginPath();
        ctx.arc(gx2, gy2, 3.5 + Math.sin((opt.time || 0) * 30) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ---------------- 狼的姿态 ---------------- */

  function wolfPose(p, t, g) {
    var moving = g.held.left || g.held.right;
    var pose = { crouch: 0, lean: 0.02 * Math.sin(t * 2), swordAngle: -12, legSwing: 0 };
    switch (p.state) {
      case "idle": case "guard":
        if (p.state === "guard") {
          // 反手构：刀身横架颈后、刃朝前上，临敌一瞬刀身发白
          pose.crouch = 6; pose.swordAngle = 158; pose.lean = 0.06;
          pose.bladeGlow = p.guardAge <= CFG.GUARD_PERFECT;
        } else if (moving) {
          pose.lean = 0.16; pose.legSwing = Math.sin(t * 13); pose.swordAngle = -18;
        }
        break;
      case "attack": {
        // 左劈（袈裟，前上→后下）与右劈（反袈裟，过顶→前下）弧线相反
        var tt = p.stateT, phase, step2 = p.comboStep === 2;
        if (tt < CFG.ATT_WINDUP) {
          phase = tt / CFG.ATT_WINDUP;
          pose.swordAngle = step2 ? 20 + phase * 130 : 10 + phase * 45;
          pose.lean = -0.05;
        } else if (tt < CFG.ATT_WINDUP + CFG.ATT_ACTIVE) {
          phase = (tt - CFG.ATT_WINDUP) / CFG.ATT_ACTIVE;
          pose.swordAngle = step2 ? 150 - phase * 185 : 55 - phase * 175;
          pose.slashAlpha = (step2 ? 1 : 0.85) * (1 - phase * 0.3);
          pose.slashWide = step2;
          pose.slashColor = step2;
          pose.lean = step2 ? 0.24 : 0.18;
        } else {
          pose.swordAngle = step2 ? -30 : -110;
          pose.lean = 0.1;
        }
        break;
      }
      case "dodge":
        pose.crouch = 20; pose.lean = 0.45; pose.swordAngle = -45;
        pose.legSwing = 0.8; pose.afterimages = true;
        break;
      case "jump":
        pose.crouch = 4; pose.legSwing = -0.5; pose.swordAngle = -30;
        if (p.charged) { pose.bladeGlow = true; pose.glowColor = "#bfe3ff"; }
        break;
      case "hurt": pose.lean = -0.28; pose.swordAngle = -55; break;
      case "break":
        pose.crouch = 32; pose.kneel = true; pose.lean = -0.1; pose.swordAngle = 60; break;
      case "heal":
        pose.crouch = 12; pose.lean = 0.12; pose.swordAngle = -42; break;
      case "execute":
        if (p.stateT < CFG.EXEC_TIME * 0.42) { pose.swordAngle = -150; pose.lean = -0.15; }
        else if (p.stateT < CFG.EXEC_TIME * 0.55) {
          phase = (p.stateT - CFG.EXEC_TIME * 0.42) / (CFG.EXEC_TIME * 0.13);
          pose.swordAngle = -150 + phase * 160;
          pose.slashAlpha = 0.95; pose.lean = 0.3;
        } else { pose.swordAngle = 12; pose.lean = 0.24; }
        break;
    }
    return pose;
  }

  function enemyPose(e, t, g) {
    var pose = { crouch: 0, lean: 0, swordAngle: -14, legSwing: 0 };
    var prog, dur;
    switch (e.state) {
      case "approach":
        pose.lean = 0.12;
        pose.legSwing = Math.sin(t * 9 * (e.cur.speed / 140));
        break;
      case "backstep":
        pose.lean = -0.3; pose.crouch = 12; pose.swordAngle = -40; pose.afterimages = true;
        break;
      case "feint":
        pose.lean = -0.4; pose.crouch = 16; pose.swordAngle = -60; pose.afterimages = true;
        break;
      case "windup":
        dur = e.windupDur;
        prog = Math.min(1, e.stateT / dur);
        pose.swordAngle = -20 + prog * 125;
        pose.crouch = 4; pose.lean = -0.06;
        if (dur - e.stateT <= CFG.GUARD_PERFECT) pose.bladeGlow = true;
        break;
      case "peril":
        dur = e.windupDur;
        prog = Math.min(1, e.stateT / dur);
        pose.crouch = 10;
        if (e.strikeType === "thrust") { pose.swordAngle = -70 + prog * 20; pose.lean = -0.12; }
        else if (e.strikeType === "sweep") { pose.swordAngle = -55 - prog * 10; pose.lean = 0.2; }
        else if (e.strikeType === "grab") { pose.swordAngle = -95; pose.lean = -0.18; pose.crouch = 12; }
        else { pose.swordAngle = -118; pose.lean = -0.16; } // 雷：举刀向天
        if (dur - e.stateT <= CFG.GUARD_PERFECT) pose.bladeGlow = true;
        break;
      case "aim":
        pose.swordAngle = -2; pose.crouch = 9; pose.lean = 0.08;
        if (e.stateT > 0.34) pose.aimGlow = true;
        break;
      case "strike":
        if (e.strikeType === "thrust") pose.swordAngle = 2;
        else if (e.strikeType === "sweep") pose.swordAngle = -30;
        else if (e.strikeType === "grab") pose.swordAngle = -70;
        else if (e.strikeType === "thunder") pose.swordAngle = -95;
        else pose.swordAngle = 40;
        pose.lean = 0.2;
        break;
      case "recover": pose.swordAngle = 24; pose.lean = 0.05; break;
      case "hurt":
        prog = e.hurtUntil ? Math.min(1, e.stateT / e.hurtUntil) : 1;
        pose.lean = -(0.22 + (1 - prog) * 0.18);
        pose.swordAngle = -70; pose.crouch = 6;
        break;
      case "executable":
        pose.crouch = 34; pose.kneel = true; pose.swordAngle = 65; pose.lean = -0.12; break;
      case "rise": pose.crouch = 22; pose.kneel = true; pose.swordAngle = 30; break;
      case "phase":
        pose.crouch = 26 - Math.min(26, e.stateT * 22);
        pose.kneel = e.stateT < 1.0;
        pose.swordAngle = 40 - e.stateT * 40;
        pose.bladeGlow = e.stateT > 0.7;
        break;
      case "dead": pose.dead = true; break;
    }
    return pose;
  }

  function enemyOpt(e, t) {
    var s = e.wave.style, base;
    if (s === "ranger") {
      base = {
        torso: "#33404e", leg: "#242d38", cloak: "#2c3744", armor: true,
        armorLine: "rgba(0,0,0,0.3)", head: "hat", hat: "#4a5566",
        skin: "#cfa27f", weapon: "rifle", bladeLen: 56,
      };
    } else if (s === "spear") {
      base = {
        torso: "#6e4a2c", leg: "#4a3120", cloak: "#7d5635", sash: "#c8b478",
        armor: false, head: "bald", skin: "#d6a685",
        weapon: "spear", bladeLen: 60,
      };
    } else if (s === "ninja") {
      base = {
        torso: "#2a2438", leg: "#1b1728", cloak: "#221c30",
        armor: false, head: "hood", hood: "#201a30", skin: "#d0a384",
        scarf: "#6d5aa8", blade: "#dfe6ff", grip: "#2a2030", bladeLen: 52,
      };
    } else if (s === "boss") {
      var aura = e.nodeIndex >= 2;
      base = {
        torso: "#2c2a36", leg: "#1d1c26", cloak: "#6e2230", armor: true,
        armorLine: "rgba(201,161,74,0.45)", head: "white", skin: "#d6a685",
        blade: aura ? "#eaf2ff" : "#d7dde8", grip: "#4a2018", bladeLen: 70,
        elec: aura || e.elec > 0, glowColor: aura ? "#bfe3ff" : null,
        scarf: "#c23b2e",
      };
    } else {
      var general = e.wave.nodes.length > 1;
      base = general ? {
        torso: "#3a2030", leg: "#24141c", cloak: "#5a1f2c", armor: true,
        armorLine: "rgba(0,0,0,0.35)", helmet: "#2b2f3a", general: true, head: "helmet",
        blade: "#d7dde8", grip: "#4a2018", bladeLen: 64,
      } : {
        torso: "#333c4e", leg: "#232a38", cloak: "#2a3346", armor: true,
        armorLine: "rgba(0,0,0,0.3)", helmet: "#333a47", head: "helmet",
        blade: "#cfd6e2", grip: "#3a2418", bladeLen: 62,
      };
    }
    base.time = t;
    return base;
  }

  R.figure.wolf = function (ctx, g) {
    var p = g.player;
    shadow(ctx, p.x, p.y);
    var opt = {
      torso: "#161a22", leg: "#10131a", blade: "#d7dde8", grip: "#5a2320",
      skin: "#d6a685", hair: "#0d0f14", scarf: "#c23b2e", bladeLen: 58, time: g.time,
    };
    if (p.charged) { opt.glowColor = "#bfe3ff"; }
    figure(ctx, p.x, p.y, p.dir, wolfPose(p, g.time, g), opt);
    // 喝药时手上的小葫芦
    if (p.state === "heal") {
      ctx.save();
      ctx.translate(p.x, GY - 52);
      ctx.scale(p.dir, 1);
      ctx.fillStyle = "#7ecf8f";
      ctx.beginPath(); ctx.arc(8, 0, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a4a30";
      ctx.fillRect(6, -7, 3, 4);
      ctx.restore();
    }
  };

  R.figure.enemy = function (ctx, g) {
    var e = g.enemy;
    if (!e) return;
    shadow(ctx, e.x, 0);
    var opt = enemyOpt(e, g.time);
    var pose = enemyPose(e, g.time, g);
    if (pose.dead) {
      ctx.save();
      ctx.translate(e.x, GY);
      ctx.scale(e.dir, 1);
      ctx.rotate(-88 * DEG);
      ctx.translate(0, 6);
      body(ctx, { crouch: 0, swordAngle: 20 }, opt);
      ctx.restore();
    } else {
      figure(ctx, e.x, 0, e.dir, pose, opt);
    }

    // 危字 + 前两次出现时的小字注解
    if (e.state === "peril") {
      var pulse = 1 + 0.12 * Math.sin(g.time * 14);
      ctx.save();
      ctx.translate(e.x, GY - 150);
      ctx.scale(pulse, pulse);
      ctx.font = R.font(40, 900);
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#30060a";
      ctx.strokeText("危", 0, 0);
      ctx.fillStyle = "#ff3b30";
      ctx.shadowColor = "#ff2a1e";
      ctx.shadowBlur = 18;
      ctx.fillText("危", 0, 0);
      ctx.restore();
      if (g.tipCount[e.strikeType] <= 2) {
        var sub = { thrust: "突", sweep: "扫", grab: "投", thunder: "雷" }[e.strikeType];
        if (sub) {
          ctx.font = R.font(15, 800);
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,230,200,0.9)";
          ctx.fillText("· " + sub + " ·", e.x, GY - 108);
        }
      }
    }
    // 忍杀红点
    if (e.state === "executable") {
      var rp = 1 + 0.18 * Math.sin(g.time * 16);
      ctx.save();
      ctx.translate(e.x, GY - 128);
      ctx.rotate(Math.PI / 4);
      ctx.scale(rp, rp);
      ctx.fillStyle = "#e32326";
      ctx.shadowColor = "#ff3030";
      ctx.shadowBlur = 14;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
  };

  return R;
});
