/*
 * Sekiro Mini · 战斗模拟内核（无 DOM 依赖，可在 Node 中直接测试）
 *
 * 核心机制（只狼三件套 + 扩展）：
 *   1. 架势 posture：弹反给敌人架势，架势满 → 忍杀扣命
 *   2. 弹反时机：敌人命中前 0.22s 按 K = 完美弹反，按早 = 普通格挡
 *   3. 危字攻击：突刺（垫步）/ 扫腿（跳）/ 擒拿（后撤逃离）/ 雷（空中返雷）
 *   4. 伤药葫芦（F，限次）、二连斩（J-J）、垫步方向跟随走位键
 * 敌人 AI 见 enemy.js（原型注入），关卡数据见 bestiary.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Sekiro = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CFG = {
    WORLD_W: 960,
    GROUND: 432,
    PLAYER_X0: 300,
    ENEMY_X0: 690,
    SPEED: 245,
    MAX_HP: 100,
    MAX_POSTURE: 100,
    // 玩家斩击：起手 / 判定 / 收招（秒）
    ATT_WINDUP: 0.07,
    ATT_ACTIVE: 0.1,
    ATT_RECOVER: 0.26,
    ATT_RANGE: 88,
    ATT_HP: 11,        // 平砍削血偏低：主攻方向是弹反崩架势
    ATT_POST: 12,
    ATT2_HP: 14,       // 二连斩第二段：略重，收招略慢
    ATT2_POST: 22,
    COMBO_QUEUE: 0.14, // 收招末段可预输入第二段
    // 格挡窗口
    GUARD_PERFECT: 0.22,
    GUARD_TOTAL: 0.46,
    BLOCK_POST: 16,
    PERFECT_POST: 4,
    PERFECT_ENEMY_POST: 30,
    // 垫步 / 跳跃
    DODGE_TIME: 0.32,
    DODGE_INVULN: 0.22,
    DODGE_SPEED: 430,
    JUMP_V0: 640,
    GRAVITY: 2100,
    SWEEP_SAFE_Y: 34,
    // 敌人普攻 / 危招伤害
    E_HP: 18,
    E_PERIL_HP: 26,
    GRAB_HP: 30,
    THUNDER_HP: 34,
    BULLET_HP: 13,
    E_POST: 10,
    THRUST_RANGE: 72,
    THRUST_SPEED: 720,
    GRAB_RANGE: 120,
    GRAB_LUNGE: 190,
    // 火铳
    BULLET_SPEED: 620,
    // 雷返
    THUNDER_REFLECT_HP: 20,
    THUNDER_REFLECT_POST: 46,
    THUNDER_BOLT_SPEED: 950,
    // 架势回复
    P_POST_DELAY: 1.5,
    P_POST_REGEN: 30,
    E_POST_DELAY: 1.6,
    E_POST_REGEN: 15,
    // 伤药葫芦
    GOURD_MAX: 3,
    GOURD_HEAL: 42,
    GOURD_TIME: 0.72,
    GOURD_APPLY: 0.34,
    EXEC_HEAL: 10,     // 忍杀回血
    // 硬直 / 演出
    HURT_PLAYER: 0.34,
    HURT_ENEMY: 0.3,
    DEFLECT_STUN: 0.62,
    THUNDER_STUN: 1.1,
    BREAK_TIME: 1.15,
    HITSTOP_DEFLECT: 0.05,
    HITSTOP_PERIL: 0.06,
    HITSTOP_EXEC: 0.12,
    EXEC_REACH: 180,
    EXEC_GAP: 72,
    EXEC_SLIDE: 0.12,
    EXEC_TIME: 0.95,
    DEAD_HOLD: 1.0,
    RISE_TIME: 1.25,
  };

  // 各类危招的举刀时长
  var PERIL_WINDUP = { thrust: 0.95, sweep: 1.0, grab: 0.82, thunder: 1.08 };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function makePlayer() {
    return {
      x: CFG.PLAYER_X0, y: 0, vy: 0, dir: 1,
      hp: CFG.MAX_HP, posture: 0,
      state: "idle", // idle|guard|attack|dodge|jump|hurt|break|execute|heal
      stateT: 0,
      guardAge: 99,
      invuln: 0,
      hitDone: false,
      postDelay: 0,
      comboStep: 0,    // 当前斩击段数 0/1/2
      slashSide: -1,   // 劈砍方向：-1 左劈（袈裟）/ 1 右劈（反袈裟）
      queueAttack: false,
      dodgeDir: 1,
      gourds: CFG.GOURD_MAX,
      healDone: false,
      charged: false,  // 雷缠身
    };
  }

  function Game(rng, opts) {
    opts = opts || {};
    this.rng = rng || Math.random;
    this.stages = opts.stages || [];
    this.mode = "title"; // title|fight|death|victory
    this.paused = false;
    this.time = 0;
    this.waveIndex = -1;
    this.player = makePlayer();
    this.enemy = null;
    this.bullets = [];
    this.held = { left: false, right: false };
    this.events = [];
    this.fx = [];
    this.shake = 0;
    this.hitStop = 0;
    this.flash = null; // {a, color}
    this.banner = null;
    this.tipCount = { thrust: 0, sweep: 0, grab: 0, thunder: 0 };
    this.stats = {
      deflects: 0, bulletDeflects: 0, blocks: 0, kills: 0,
      deaths: 0, gourdsUsed: 0, startT: 0, clearT: 0, hpRatio: 1,
    };
  }

  Game.prototype.start = function () {
    this.mode = "fight";
    this.waveIndex = -1;
    this.player = makePlayer();
    this.bullets = [];
    this.fx = [];
    this.stats = {
      deflects: 0, bulletDeflects: 0, blocks: 0, kills: 0,
      deaths: 0, gourdsUsed: 0, startT: this.time, clearT: 0, hpRatio: 1,
    };
    this.spawnWave(0);
  };

  // 死亡后重开本阵（友好规则，不回起点）
  Game.prototype.restart = function () {
    if (this.mode !== "death") return;
    this.player = makePlayer();
    this.bullets = [];
    this.spawnWave(this.waveIndex);
    this.mode = "fight";
  };

  Game.prototype.spawnWave = function (i) {
    this.waveIndex = i;
    var w = this.stages[i];
    var node = w.nodes[0];
    this.enemy = {
      wave: w,
      name: w.name,
      nodes: w.nodes.length,
      nodeIndex: 0,
      cur: node,
      maxHp: node.hp,
      hp: node.hp,
      posture: 0,
      x: CFG.ENEMY_X0, dir: -1,
      state: "approach", // approach|idle|backstep|feint|windup|peril|aim|strike|recover|hurt|rise|phase|executable|dead
      stateT: 0,
      windupDur: node.windup,
      strikeType: "normal",
      atkRange: node.range,
      recoverDur: 0.6,
      idleUntil: 0,
      comboLeft: 0,
      hitDone: false,
      lingerT: 0,
      postDelay: 0,
      armorT: 0,
      elec: 0,
    };
    this.banner = { main: w.sub, sub: w.name, t: 2.0, tmax: 2.0 };
    this.events.push("wave");
  };

  /* ---------- 输入 ---------- */

  Game.prototype.setHeld = function (dir, on) {
    if (dir === "left" || dir === "right") this.held[dir] = !!on;
  };

  Game.prototype.startAttack = function (step) {
    var p = this.player;
    p.state = "attack";
    p.stateT = 0;
    p.hitDone = false;
    p.comboStep = step;
    p.slashSide = step === 2 ? 1 : -1; // 左劈 → 右劈交替
    p.queueAttack = false;
    this.events.push(step === 2 ? "swing2" : "swing");
  };

  Game.prototype.press = function (action) {
    if (this.mode !== "fight" || this.paused) return;
    var p = this.player;

    if (action === "guard") {
      if (p.state === "idle" || p.state === "guard" || p.state === "dodge") {
        p.guardAge = 0;
        if (p.state !== "dodge") p.state = "guard";
      }
      return;
    }
    if (action === "attack") {
      if (p.state === "idle" || p.state === "jump") {
        // 空中出刀：若雷缠身则返雷
        if (p.charged && p.y > CFG.SWEEP_SAFE_Y) this.reflectThunder();
        this.startAttack(1);
      } else if (p.state === "attack" &&
          p.stateT >= CFG.ATT_WINDUP + CFG.ATT_ACTIVE + CFG.ATT_RECOVER - CFG.COMBO_QUEUE &&
          p.comboStep === 1) {
        p.queueAttack = true; // 收招末段预输入二连斩
      }
      return;
    }
    if (action === "dodge") {
      if (p.state === "idle" || p.state === "guard") {
        p.dodgeDir = this.held.right ? 1 : this.held.left ? -1 : p.dir;
        p.state = "dodge";
        p.stateT = 0;
        p.invuln = CFG.DODGE_INVULN;
        this.events.push(p.dodgeDir === p.dir ? "dodge" : "backstep");
      }
      return;
    }
    if (action === "jump") {
      if (p.state === "idle") {
        p.state = "jump";
        p.stateT = 0;
        p.vy = CFG.JUMP_V0;
        p.y = 0.01;
        this.events.push("jump");
      }
      return;
    }
    if (action === "heal") {
      if ((p.state === "idle" || p.state === "guard") &&
          p.gourds > 0 && p.hp < CFG.MAX_HP) {
        p.state = "heal";
        p.stateT = 0;
        p.healDone = false;
        this.events.push("healStart");
      } else if (p.gourds <= 0) {
        this.events.push("gourdEmpty");
      }
    }
  };

  /* ---------- 特效 ---------- */

  Game.prototype.spawnSparks = function (x, y, n, color, power) {
    for (var i = 0; i < n; i++) {
      var a = this.rng() * Math.PI * 2;
      var sp = (60 + this.rng() * 260) * (power || 1);
      this.fx.push({
        kind: "spark", x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        t: 0, life: 0.25 + this.rng() * 0.3,
        color: color, size: 1.5 + this.rng() * 2.5, g: 500,
      });
    }
  };

  Game.prototype.spawnRing = function (x, y, color) {
    this.fx.push({ kind: "ring", x: x, y: y, t: 0, life: 0.34, color: color });
  };

  Game.prototype.spawnText = function (x, y, text, color, size) {
    this.fx.push({
      kind: "text", x: x, y: y, vy: 46, t: 0, life: 0.8,
      text: text, color: color, size: size || 20,
    });
  };

  Game.prototype.setFlash = function (color, a) {
    this.flash = { color: color, a: a };
  };

  /* ---------- 主推进 ---------- */

  Game.prototype.update = function (dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.events = [];
    if (this.hitStop > 0) { this.hitStop -= dt; return; } // 顿帧：世界冻结
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.flash) { this.flash.a -= dt * 2.6; if (this.flash.a <= 0) this.flash = null; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.updateFx(dt);
    if (this.mode !== "fight" || this.paused) return;

    this.playerTick(dt);
    if (this.enemy) this.enemyTick(dt);
    if (this.simBullets) this.simBullets(dt);
    this.separate();

    var p = this.player;
    if (p.hp <= 0 && p.state !== "execute" && this.mode === "fight") {
      p.hp = 0;
      this.mode = "death";
      this.stats.deaths++;
      this.events.push("death");
    }
  };

  Game.prototype.updateFx = function (dt) {
    var next = [];
    for (var i = 0; i < this.fx.length; i++) {
      var f = this.fx[i];
      f.t += dt;
      if (f.kind === "spark") {
        f.vy -= f.g * dt;
        f.x += f.vx * dt;
        f.y -= f.vy * dt;
      } else if (f.kind === "text") {
        f.y -= f.vy * dt;
      }
      if (f.t < f.life) next.push(f);
    }
    this.fx = next;
  };

  /* ---------- 玩家 ---------- */

  Game.prototype.playerTick = function (dt) {
    var p = this.player;
    p.stateT += dt;
    p.guardAge += dt;
    if (p.invuln > 0) p.invuln -= dt;

    // 架势满立即崩（优先于本帧回复）
    if (p.posture >= CFG.MAX_POSTURE && p.state !== "break" && p.state !== "execute") {
      p.state = "break";
      p.stateT = 0;
      p.posture = CFG.MAX_POSTURE;
      this.events.push("break");
    }

    if (p.postDelay > 0) p.postDelay -= dt;
    else if (p.posture > 0 && p.state !== "break") {
      p.posture = Math.max(0, p.posture - CFG.P_POST_REGEN * dt);
    }

    // 雷缠身的视觉电火花
    if (p.charged) {
      if (Math.floor(this.time * 30) !== Math.floor((this.time - dt) * 30)) {
        this.spawnSparks(p.x + (this.rng() - 0.5) * 22, CFG.GROUND - 80 - this.rng() * 70,
          1, "#9fd8ff", 0.5);
      }
    }

    switch (p.state) {
      case "idle":
      case "guard":
        if (p.guardAge > CFG.GUARD_TOTAL) p.state = "idle";
        this.movePlayer(dt);
        break;
      case "attack":
        if (p.stateT >= CFG.ATT_WINDUP && p.stateT < CFG.ATT_WINDUP + CFG.ATT_ACTIVE) {
          this.tryPlayerHit();
        }
        if (p.stateT >= CFG.ATT_WINDUP + CFG.ATT_ACTIVE + CFG.ATT_RECOVER) {
          if (p.queueAttack && p.y <= 0) this.startAttack(2);
          else { p.state = p.y > 0 ? "jump" : "idle"; p.comboStep = 0; }
        }
        this.fall(p, dt);
        break;
      case "dodge":
        p.x += p.dodgeDir * CFG.DODGE_SPEED * dt;
        if (p.stateT >= CFG.DODGE_TIME) p.state = "idle";
        break;
      case "jump":
        this.movePlayer(dt, 0.75);
        this.fall(p, dt);
        if (p.y <= 0) {
          p.y = 0;
          p.state = "idle";
        }
        break;
      case "hurt":
        this.fall(p, dt);
        if (p.stateT >= CFG.HURT_PLAYER) p.state = p.y > 0 ? "jump" : "idle";
        break;
      case "heal":
        if (!p.healDone && p.stateT >= CFG.GOURD_APPLY) {
          p.healDone = true;
          p.gourds--;
          this.stats.gourdsUsed++;
          p.hp = Math.min(CFG.MAX_HP, p.hp + CFG.GOURD_HEAL);
          this.spawnText(p.x, CFG.GROUND - 150, "+" + CFG.GOURD_HEAL, "#7ee49a", 18);
          this.events.push("heal");
        }
        if (p.stateT >= CFG.GOURD_TIME) p.state = "idle";
        break;
      case "break":
        p.posture = CFG.MAX_POSTURE;
        if (p.stateT >= CFG.BREAK_TIME) { p.posture = 0; p.state = "idle"; }
        break;
      case "execute":
        if (this.enemy && p.stateT < CFG.EXEC_SLIDE) {
          var target = this.enemy.x - p.dir * CFG.EXEC_GAP;
          p.x += (target - p.x) * Math.min(1, dt / (CFG.EXEC_SLIDE - p.stateT + 0.001));
        }
        if (p.stateT >= CFG.EXEC_TIME) p.state = "idle";
        break;
    }

    // 带雷落地统一结算（attack/hurt 等任何空中态落地均不可残留 charged）
    this.resolveChargedLand();

    p.x = clamp(p.x, 40, CFG.WORLD_W - 40);
    this.faceEnemy(p, dt, true);
  };

  Game.prototype.movePlayer = function (dt, factor) {
    var p = this.player;
    var v = CFG.SPEED * (factor || 1);
    if (this.held.left) p.x -= v * dt;
    if (this.held.right) p.x += v * dt;
  };

  Game.prototype.fall = function (p, dt) {
    if (p.y > 0 || p.vy > 0) {
      var wasAir = p.y > 0;
      p.vy -= CFG.GRAVITY * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      return wasAir && p.y <= 0; // 本帧落地
    }
    return false;
  };

  // 带雷落地的统一结算（任何空中状态都不可残留 charged）
  Game.prototype.resolveChargedLand = function () {
    var p = this.player;
    if (p.y <= 0 && p.charged) {
      p.charged = false;
      this.damagePlayer(CFG.THUNDER_HP, true, "thunderHit");
    }
  };

  Game.prototype.faceEnemy = function (actor, dt, isPlayer) {
    var other = isPlayer ? this.enemy : this.player;
    if (!other) return;
    var lock = isPlayer
      ? actor.state === "attack" || actor.state === "dodge" || actor.state === "execute"
      : actor.state === "strike" || actor.state === "executable" ||
        actor.state === "dead" || actor.state === "aim";
    if (lock) return;
    actor.dir = other.x >= actor.x ? 1 : -1;
  };

  Game.prototype.tryPlayerHit = function () {
    var p = this.player, e = this.enemy;
    if (p.hitDone || !e || e.state === "executable" || e.state === "dead" ||
        e.state === "rise" || e.state === "phase") return;
    var dx = e.x - p.x;
    if (dx * p.dir < -14) return;
    if (Math.abs(dx) > CFG.ATT_RANGE + 16) return;
    p.hitDone = true;

    var dmg = p.comboStep === 2 ? CFG.ATT2_HP : CFG.ATT_HP;
    var post = p.comboStep === 2 ? CFG.ATT2_POST : CFG.ATT_POST;
    var cx = (p.x + e.x) / 2, cy = CFG.GROUND - 120 - (p.y + (e.y || 0)) / 2;
    e.hp -= dmg;
    e.posture += post;
    e.postDelay = CFG.E_POST_DELAY;
    this.spawnSparks(cx, cy, p.comboStep === 2 ? 14 : 10, "#ffd98a", p.comboStep === 2 ? 1.1 : 0.8);
    this.events.push("hit");

    if (e.hp <= 0) {
      e.hp = 0;
      this.beginExecutable();
      return;
    }
    // 举刀/危动作不会被打断；霸体期间连砍不硬直，防屈死
    if (e.armorT <= 0 &&
        (e.state === "approach" || e.state === "idle" || e.state === "recover" ||
         e.state === "hurt" || e.state === "backstep")) {
      e.state = "hurt";
      e.stateT = 0;
      e.hurtUntil = CFG.HURT_ENEMY;
      e.armorT = e.wave.armor;
      e.comboLeft = 0;
    }
  };

  Game.prototype.damagePlayer = function (dmg, isPeril, eventName) {
    var p = this.player;
    p.hp -= dmg;
    p.posture += CFG.E_POST;
    p.postDelay = 1.0;
    p.charged = false;
    if (p.state === "heal") p.healDone = true; // 被打断，葫芦不消耗（gourds 在 apply 时才扣）
    if (p.state !== "execute") {
      p.state = "hurt";
      p.stateT = 0;
      p.y = 0;
      p.vy = 0;
    }
    this.spawnSparks(p.x, CFG.GROUND - 110, isPeril ? 14 : 9,
      isPeril ? "#ff7a6b" : "#e8b8a0", isPeril ? 1.2 : 0.8);
    this.shake = isPeril ? 0.5 : 0.35;
    this.setFlash(isPeril ? "rgba(255,40,30," : "rgba(180,30,20,", isPeril ? 0.32 : 0.2);
    this.events.push(eventName || (isPeril ? "perilHit" : "hurt"));
  };

  /* ---------- 雷返（由 enemy.js 的雷击流程配合） ---------- */

  Game.prototype.reflectThunder = function () {
    var p = this.player, e = this.enemy;
    if (!p.charged || !e) return;
    p.charged = false;
    this.bullets.push({
      kind: "bolt", from: "p",
      x: p.x + p.dir * 30, y: CFG.GROUND - 130,
      vx: p.dir * CFG.THUNDER_BOLT_SPEED, t: 0,
    });
    this.spawnText(p.x, CFG.GROUND - 168, "返雷", "#bfe3ff", 22);
    this.hitStop = CFG.HITSTOP_PERIL;
    this.events.push("thunderReturn");
  };

  /* ---------- 忍杀 / 波次 ---------- */

  Game.prototype.beginExecutable = function () {
    var p = this.player, e = this.enemy;
    if (e.state === "executable" || e.state === "dead") return;
    e.state = "executable";
    e.stateT = 0;
    e.posture = CFG.MAX_POSTURE;
    p.state = "execute";
    p.stateT = 0;
    p.invuln = Math.max(p.invuln, CFG.EXEC_TIME);
    this.hitStop = CFG.HITSTOP_EXEC;
    this.events.push("executeStart");
  };

  Game.prototype.tickExecutable = function (dt) {
    var p = this.player, e = this.enemy;
    if (p.stateT >= CFG.EXEC_TIME * 0.45 && !e.resolved) {
      e.resolved = true;
      this.spawnSparks(e.x - e.dir * 20, CFG.GROUND - 130, 22, "#d4302f", 1.4);
      this.spawnRing(e.x, CFG.GROUND - 120, "#ff5a4d");
      this.shake = 0.55;
    }
    if (p.stateT >= CFG.EXEC_TIME) {
      e.nodes--;
      this.stats.kills++;
      // 忍杀回少量血
      if (p.hp < CFG.MAX_HP) {
        p.hp = Math.min(CFG.MAX_HP, p.hp + CFG.EXEC_HEAL);
        this.spawnText(p.x, CFG.GROUND - 150, "+" + CFG.EXEC_HEAL, "#e8a7a0", 14);
      }
      this.banner = { main: "忍殺", sub: "", t: 1.0, tmax: 1.0, peril: true };
      this.events.push("deathblow");
      if (e.nodes > 0) {
        e.nodeIndex++;
        var node = e.wave.nodes[e.nodeIndex];
        e.cur = node;
        e.maxHp = node.hp;
        e.hp = node.hp;
        e.posture = 0;
        e.postDelay = 0;
        e.armorT = 0;
        e.resolved = false;
        e.bullets = 0;
        if (node.badge) {
          e.state = "phase";
          e.stateT = 0;
          this.banner = { main: node.badge, sub: e.name, t: 1.5, tmax: 1.5, peril: true };
          this.events.push("phase");
        } else {
          e.state = "rise";
          e.stateT = 0;
        }
      } else {
        e.state = "dead";
        e.stateT = 0;
      }
    }
  };

  Game.prototype.advanceWave = function () {
    if (this.waveIndex + 1 < this.stages.length) {
      this.spawnWave(this.waveIndex + 1);
      this.player.x = CFG.PLAYER_X0;
      if (this.player.state !== "execute") this.player.state = "idle";
    } else {
      this.mode = "victory";
      this.stats.clearT = this.time - this.stats.startT;
      this.stats.hpRatio = this.player.hp / CFG.MAX_HP;
      this.events.push("victory");
    }
  };

  // 防止两人重叠
  Game.prototype.separate = function () {
    var p = this.player, e = this.enemy;
    if (!e) return;
    var minGap = 26;
    var dx = e.x - p.x;
    if (Math.abs(dx) < minGap &&
        (e.state === "approach" || e.state === "idle" || p.state === "idle")) {
      if (dx >= 0) { p.x -= (minGap - dx) / 2; e.x += (minGap - dx) / 2; }
      else { p.x += (-minGap - dx) / 2; e.x -= (-minGap - dx) / 2; }
    }
  };

  return { Game: Game, CFG: CFG, PERIL_WINDUP: PERIL_WINDUP, mulberry32: mulberry32 };
});
