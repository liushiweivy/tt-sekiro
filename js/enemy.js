/*
 * Sekiro Mini · 敌人 AI（原型注入到 Sekiro.Game.prototype）
 * 依赖 core.js：CFG / PERIL_WINDUP / Game
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./core.js"));
  } else {
    factory(root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (Sekiro) {
  "use strict";

  var CFG = Sekiro.CFG;
  var PERIL_WINDUP = Sekiro.PERIL_WINDUP;
  var proto = Sekiro.Game.prototype;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  var STYLE_GAP = { melee: 92, ninja: 90, boss: 96, spear: 128, ranger: 320 };

  /* ---------- 主状态机 ---------- */

  proto.enemyTick = function (dt) {
    var p = this.player, e = this.enemy;
    e.stateT += dt;
    if (e.armorT > 0) e.armorT -= dt;
    if (e.elec > 0) e.elec -= dt;

    // 架势满立即忍杀（优先于回复）
    if (e.posture >= CFG.MAX_POSTURE &&
        e.state !== "executable" && e.state !== "dead" &&
        e.state !== "rise" && e.state !== "phase") {
      this.beginExecutable();
    }

    if (e.postDelay > 0) e.postDelay -= dt;
    else if (e.posture > 0 && e.state !== "executable") {
      var rate = CFG.E_POST_REGEN * (0.25 + 0.75 * (e.hp / e.maxHp));
      e.posture = Math.max(0, e.posture - rate * dt);
    }
    this.faceEnemy(e, dt, false);

    var dist = Math.abs(e.x - p.x);
    var gap = STYLE_GAP[e.wave.style] || 92;

    switch (e.state) {
      case "approach":
        if (e.wave.style === "ranger") {
          if (dist < 250) { e.state = "backstep"; e.stateT = 0; e.fleeUntil = 0.45; }
          else if (dist > 380) e.x += (p.x < e.x ? -1 : 1) * e.cur.speed * dt;
          else { e.state = "idle"; e.stateT = 0; e.idleUntil = 0.2 + this.rng() * 0.4; }
        } else if (dist > gap) {
          e.x += (p.x < e.x ? -1 : 1) * e.cur.speed * dt;
        } else {
          e.state = "idle"; e.stateT = 0; e.idleUntil = 0.28 + this.rng() * 0.8;
        }
        break;
      case "idle":
        if (e.stateT >= e.idleUntil) this.chooseAttack();
        break;
      case "backstep": // 火枪手拉开距离
        e.x -= (e.dir) * e.cur.speed * 1.8 * dt;
        if (e.stateT >= e.fleeUntil || dist > 350) {
          e.state = "idle"; e.stateT = 0; e.idleUntil = 0.15 + this.rng() * 0.3;
        }
        break;
      case "feint": // 忍者后撤虚招，接快速突刺
        e.x -= e.dir * 380 * dt;
        if (e.stateT >= 0.18) {
          e.state = "peril";
          e.strikeType = "thrust";
          e.windupDur = 0.62;
          e.stateT = 0;
          this.events.push("peril");
        }
        break;
      case "windup":
      case "peril":
        if (e.stateT >= e.windupDur) {
          e.state = "strike";
          e.stateT = 0;
          e.hitDone = false;
          e.lingerT = e.strikeType === "grab" ? 0.28 : 0;
          if (e.strikeType !== "grab" && e.strikeType !== "thrust") this.events.push("enemySwing");
          this.strikeEnter(dt);
        }
        break;
      case "aim":
        if (e.stateT >= 0.55) {
          var sign = p.x >= e.x ? 1 : -1;
          var jitter = (this.rng() - 0.5) * 0.08;
          this.bullets.push({
            kind: "bullet", from: "e",
            x: e.x + sign * 26, y: CFG.GROUND - 106,
            vx: sign * CFG.BULLET_SPEED * Math.cos(jitter), t: 0,
          });
          this.events.push("shoot");
          this.shake = 0.12;
          e.state = "recover"; e.stateT = 0;
          e.recoverDur = 0.5 + this.rng() * 0.25;
        }
        break;
      case "strike":
        this.strikeTick(dt);
        if (!e.hitDone && (e.strikeType === "normal" || e.strikeType === "sweep")) {
          this.resolveStrike(); // 普通刀/扫腿在 strike 首帧结算（兼容直接进入 strike 的情形）
        }
        if (!e.hitDone && e.strikeType === "thunder") this.resolveThunder();
        if (e.strikeType === "grab") {
          if (e.stateT >= e.lingerT) this.endStrike();
        } else if (e.stateT >= 0.12) {
          this.endStrike();
        }
        break;
      case "recover":
        if (e.stateT >= e.recoverDur) {
          if (e.comboLeft > 0) {
            e.comboLeft--;
            e.state = "windup"; e.stateT = 0;
            e.windupDur = e.cur.windup * 0.72;
            e.strikeType = "normal";
            e.atkRange = e.cur.range;
            this.events.push("combo");
          } else {
            e.state = "idle"; e.stateT = 0;
            e.idleUntil = 0.25 + this.rng() * 0.9;
          }
        }
        break;
      case "hurt":
        if (e.stateT >= (e.hurtUntil || CFG.HURT_ENEMY)) {
          e.hurtUntil = 0;
          e.state = "idle"; e.stateT = 0;
          e.idleUntil = 0.12 + this.rng() * 0.25;
        }
        break;
      case "rise":
        if (e.stateT >= CFG.RISE_TIME) {
          e.state = "idle"; e.stateT = 0; e.idleUntil = 0.4;
        }
        break;
      case "phase":
        if (e.stateT >= 1.35) {
          e.state = "idle"; e.stateT = 0; e.idleUntil = 0.3;
        }
        break;
      case "executable":
        this.tickExecutable(dt);
        break;
      case "dead":
        if (e.stateT >= CFG.DEAD_HOLD) this.advanceWave();
        break;
    }

    e.x = clamp(e.x, 40, CFG.WORLD_W - 20);
  };

  proto.endStrike = function () {
    var e = this.enemy;
    if (e.strikeType === "grab" && !e.hitDone) this.events.push("whiff");
    e.state = "recover";
    e.stateT = 0;
    e.recoverDur = 0.45 + this.rng() * 0.3;
  };

  /* ---------- 攻击选择（权重表） ---------- */

  proto.chooseAttack = function () {
    var e = this.enemy, p = this.player;
    var dist = Math.abs(e.x - p.x);

    // 火枪手：贴脸时被迫拔刀切近，否则举枪
    if (e.wave.style === "ranger") {
      e.stateT = 0;
      if (dist < 104) {
        e.state = "windup"; e.strikeType = "normal";
        e.windupDur = e.cur.windup; e.atkRange = e.cur.range;
        this.events.push("telegraph");
      } else {
        e.state = "aim";
        this.events.push("aim");
      }
      return;
    }

    var table = e.cur.attacks, total = 0, pick, a;
    for (var i = 0; i < table.length; i++) total += table[i].w;
    var roll = this.rng() * total;
    for (i = 0; i < table.length; i++) {
      roll -= table[i].w;
      if (roll <= 0) { pick = table[i]; break; }
    }
    pick = pick || table[0];
    e.stateT = 0;

    if (pick.t === "feint") {
      e.state = "feint";
      this.events.push("feint");
      return;
    }
    if (pick.t === "thrust" || pick.t === "sweep" || pick.t === "grab" || pick.t === "thunder") {
      e.state = "peril";
      e.strikeType = pick.t;
      e.windupDur = pick.windup || PERIL_WINDUP[pick.t];
      this.tipCount[pick.t]++;
      this.events.push("peril");
      return;
    }
    // 普通刀，可能连段
    e.state = "windup";
    e.strikeType = "normal";
    e.windupDur = pick.windup || e.cur.windup;
    e.atkRange = pick.range || e.cur.range;
    var maxChain = e.cur.combo || 1;
    if (maxChain > 1 && this.rng() < 0.6) {
      e.comboLeft = 1 + Math.floor(this.rng() * (maxChain - 1));
    } else e.comboLeft = 0;
    this.events.push("telegraph");
  };

  /* ---------- 出刀 ---------- */

  proto.strikeEnter = function (dt) {
    var e = this.enemy;
    if (e.strikeType === "thrust") this.strikeTick(dt); // 转换当帧即开始判定
    else if (e.strikeType === "thunder") this.resolveThunder();
    else this.resolveStrike();
  };

  proto.strikeTick = function (dt) {
    var p = this.player, e = this.enemy;
    if (e.strikeType === "thrust") {
      if (e.hitDone) return;
      e.x += e.dir * CFG.THRUST_SPEED * dt;
      if (Math.abs(e.x - p.x) <= CFG.THRUST_RANGE) this.resolveStrike();
    } else if (e.strikeType === "grab") {
      if (e.hitDone) return;
      e.x += e.dir * CFG.GRAB_LUNGE * dt;
      var dist = Math.abs(e.x - p.x);
      if (dist <= CFG.GRAB_RANGE && p.invuln <= 0 && p.y < 90 && p.state !== "execute") {
        e.hitDone = true;
        this.damagePlayer(CFG.GRAB_HP, true, "grabHit");
      }
    }
  };

  proto.resolveStrike = function () {
    var p = this.player, e = this.enemy;
    if (e.hitDone) return;
    e.hitDone = true;

    var dist = Math.abs(e.x - p.x);
    var range = e.strikeType === "thrust" ? CFG.THRUST_RANGE + 8
      : e.strikeType === "sweep" ? e.atkRange + 26 : e.atkRange;
    var cx = (p.x + e.x) / 2, cy = CFG.GROUND - 118 - p.y;

    if (dist > range) { this.events.push("whiff"); return; }
    if (p.state === "execute") return;

    if (e.strikeType === "thrust") {
      if (p.invuln > 0) {
        this.spawnSparks(cx, cy, 6, "#bcd8ff", 0.6);
        this.spawnText(p.x, CFG.GROUND - 160, "避", "#9fc8ff", 18);
        this.events.push("perilDodge");
        this.hitStop = CFG.HITSTOP_PERIL;
        return;
      }
      this.damagePlayer(CFG.E_PERIL_HP, true);
      return;
    }
    if (e.strikeType === "sweep") {
      if (p.y > CFG.SWEEP_SAFE_Y) {
        this.spawnSparks(cx, CFG.GROUND - 10, 6, "#bcd8ff", 0.5);
        this.spawnText(p.x, CFG.GROUND - 160, "避", "#9fc8ff", 18);
        this.events.push("perilJump");
        this.hitStop = CFG.HITSTOP_PERIL;
        return;
      }
      this.damagePlayer(CFG.E_PERIL_HP, true);
      return;
    }
    // 普通刀：完美弹反 / 普通格挡 / 裸吃
    if (p.guardAge <= CFG.GUARD_PERFECT) {
      e.posture += CFG.PERFECT_ENEMY_POST;
      e.postDelay = 2.0;
      e.state = "hurt";
      e.stateT = 0;
      e.hurtUntil = CFG.DEFLECT_STUN;
      e.comboLeft = 0;
      p.posture += CFG.PERFECT_POST;
      p.postDelay = 1.0;
      this.spawnRing(cx, cy, "#fff3b0");
      this.spawnSparks(cx, cy, 16, "#ffe985", 1.2);
      this.spawnText(p.x, CFG.GROUND - 172, "弾", "#ffe985", 22);
      this.shake = 0.32;
      this.hitStop = CFG.HITSTOP_DEFLECT;
      this.stats.deflects++;
      this.events.push("deflect");
    } else if (p.guardAge <= CFG.GUARD_TOTAL) {
      p.posture += CFG.BLOCK_POST;
      p.postDelay = 1.2;
      this.spawnSparks(cx, cy, 7, "#cfd6e4", 0.6);
      this.shake = 0.14;
      this.stats.blocks++;
      this.events.push("block");
    } else {
      this.damagePlayer(CFG.E_HP, false);
    }
  };

  proto.resolveThunder = function () {
    var p = this.player, e = this.enemy;
    e.hitDone = true;
    var cx = p.x, cy = CFG.GROUND - 120;
    if (p.y > CFG.SWEEP_SAFE_Y) {
      // 空中接住雷，获得短暂返雷窗口
      p.charged = true;
      this.spawnRing(cx, cy, "#9fd8ff");
      this.spawnSparks(cx, cy, 14, "#bfe3ff", 1.1);
      this.events.push("thunderCatch");
    } else {
      this.spawnSparks(cx, cy, 18, "#c9d6ff", 1.3);
      this.shake = 0.55;
      this.damagePlayer(CFG.THUNDER_HP, true, "thunderHit");
    }
  };

  /* ---------- 子弹 / 雷球 ---------- */

  proto.simBullets = function (dt) {
    var p = this.player, e = this.enemy, next = [];
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      b.t += dt;
      b.x += b.vx * dt;
      var dead = false;

      if (b.from === "p") {
        // 玩家返雷的雷球砸向敌人
        if (e && Math.abs(b.x - e.x) < 28 &&
            e.state !== "executable" && e.state !== "dead" && e.state !== "rise" && e.state !== "phase") {
          var cx = e.x, cy = CFG.GROUND - 120;
          e.hp -= CFG.THUNDER_REFLECT_HP;
          e.posture += CFG.THUNDER_REFLECT_POST;
          e.postDelay = 2.2;
          e.elec = 0.9;
          this.spawnRing(cx, cy, "#bfe3ff");
          this.spawnSparks(cx, cy, 24, "#bfe3ff", 1.4);
          this.spawnText(e.x, CFG.GROUND - 170, "雷", "#bfe3ff", 24);
          this.shake = 0.5;
          this.hitStop = CFG.HITSTOP_PERIL;
          this.events.push("thunderHitBoss");
          if (e.hp <= 0) { e.hp = 0; this.beginExecutable(); }
          else {
            e.state = "hurt";
            e.stateT = 0;
            e.hurtUntil = CFG.THUNDER_STUN;
            e.comboLeft = 0;
          }
          dead = true;
        }
      } else if (p.state === "execute") {
        dead = true; // 忍杀演出中子弹消散
      } else if (p.invuln > 0 && Math.abs(b.x - p.x) < 30) {
        this.spawnSparks(b.x, b.y, 5, "#bcd8ff", 0.5);
        this.events.push("bulletDodge");
        dead = true;
      } else if (Math.abs(b.x - p.x) < 22) {
        if (p.y > 46) {
          // 从头顶飞过，不消亡
        } else if (p.guardAge <= CFG.GUARD_PERFECT) {
          this.spawnRing(b.x, b.y, "#fff3b0");
          this.spawnSparks(b.x, b.y, 10, "#ffe985", 0.9);
          this.spawnText(p.x, CFG.GROUND - 168, "弾", "#ffe985", 18);
          p.posture += 2;
          this.hitStop = 0.04;
          this.stats.bulletDeflects++;
          this.events.push("bulletDeflect");
          dead = true;
        } else if (p.guardAge <= CFG.GUARD_TOTAL) {
          p.posture += 6;
          this.spawnSparks(b.x, b.y, 6, "#cfd6e4", 0.5);
          this.events.push("bulletBlock");
          dead = true;
        } else {
          this.spawnSparks(p.x, CFG.GROUND - 108, 9, "#ff8a7a", 0.9);
          this.damagePlayer(CFG.BULLET_HP, false, "bulletHit");
          dead = true;
        }
      }

      if (!dead && b.x > -40 && b.x < CFG.WORLD_W + 40 && b.t < 3) next.push(b);
    }
    this.bullets = next;
  };

  return Sekiro;
});
