// 平衡冒烟：确定性 bot 打通七阵（含火枪/擒拿/雷返），验证数值可通关且乱砍无法通关
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Sekiro = require("../js/core.js");
require("../js/enemy.js");
const { STAGES } = require("../js/bestiary.js");
const { Game, mulberry32 } = Sekiro;

function dir(g, away) {
  // 朝敌 / 背敌 的走位键
  const toRight = g.player.x < g.enemy.x;
  return away ? (toRight ? "left" : "right") : (toRight ? "right" : "left");
}

// 完美弹反 bot：弹刀 → 危招按型解 → 火枪看弹 → 雷空中返 → 收招偷刀
function runBot(seed, maxFrames) {
  const g = new Game(mulberry32(seed), { stages: STAGES });
  g.start();
  let guardPrimed = false, dodgePrimed = false, jumpPrimed = false;
  let grabRun = false, attackCd = 0;

  for (let i = 0; i < maxFrames && g.mode === "fight"; i++) {
    const p = g.player, e = g.enemy;
    const dt = 1 / 60;
    attackCd = Math.max(0, attackCd - dt);
    g.setHeld("left", false);
    g.setHeld("right", false);

    // 来袭火枪弹：临近时弹反
    const bullet = g.bullets.find(b => b.from === "e" &&
      Math.sign(b.vx) === Math.sign(p.x - b.x) && Math.abs(b.x - p.x) < 42);
    if (bullet && !guardPrimed && (p.state === "idle" || p.state === "guard")) {
      g.press("guard"); guardPrimed = true;
    }

    if (e.state === "windup") {
      const remain = e.windupDur - e.stateT;
      if (!guardPrimed && remain <= 0.16) { g.press("guard"); guardPrimed = true; }
    } else if (e.state === "peril") {
      const remain = e.windupDur - e.stateT;
      if (e.strikeType === "thrust" && !dodgePrimed && remain <= 0.12) {
        g.press("dodge"); dodgePrimed = true;
      } else if (e.strikeType === "sweep" && !jumpPrimed && remain <= 0.22) {
        g.press("jump"); jumpPrimed = true;
      } else if (e.strikeType === "grab") {
        g.setHeld(dir(g, true), true); // 背敌撤
        grabRun = true;
        if (!dodgePrimed && remain <= 0.1) { g.press("dodge"); dodgePrimed = true; }
      } else if (e.strikeType === "thunder" && !jumpPrimed && remain <= 0.3) {
        g.press("jump"); jumpPrimed = true;
      }
    } else if (e.state === "strike" && e.strikeType === "grab") {
      g.setHeld(dir(g, true), true);
    } else {
      guardPrimed = false; dodgePrimed = false; jumpPrimed = false;
      if (e.state === "recover" || e.state === "idle") grabRun = false;
    }

    // 雷返
    if (p.charged && p.state === "jump") g.press("attack");

    const dist = Math.abs(e.x - p.x);
    const canAct = p.state === "idle" || p.state === "guard";
    if (!grabRun && canAct && e.state !== "windup" && e.state !== "peril" && e.state !== "aim") {
      const want = e.wave.style === "ranger" ? 60 : e.wave.style === "spear" ? 86 : 88;
      if (dist > want + 6) g.setHeld(dir(g, false), true);
    }
    if (p.state === "idle" && attackCd === 0 && dist < 96 &&
        ["idle", "recover", "hurt", "approach", "backstep"].includes(e.state)) {
      g.press("attack");
      attackCd = 0.5;
    }
    // 拉开距离时紧急喝葫芦
    if (p.hp < 34 && p.gourds > 0 && p.state === "idle" && dist > 200) g.press("heal");

    g.update(dt);
  }
  return g;
}

test("固定种子下 bot 可通关七阵（十次忍杀，含弹火枪/躲擒拿/返雷）", () => {
  const g = runBot(42, 60 * 150);
  assert.equal(g.mode, "victory", "未通关，hp=" + g.player.hp + " wave=" + g.waveIndex);
  assert.equal(g.stats.kills, 10);
  assert.ok(g.stats.deflects >= 8, "完美弹反应不少，实际 " + g.stats.deflects);
  assert.ok(g.player.hp > 0);
  assert.ok(g.stats.clearT > 0);
});

test("多种子都能赢（数值不至于无解）", () => {
  for (const seed of [1, 7, 99, 2024]) {
    const g = runBot(seed, 60 * 150);
    assert.equal(g.mode, "victory",
      "seed " + seed + " 未通关，hp=" + g.player.hp + " wave=" + g.waveIndex);
    assert.equal(g.stats.kills, 10, "seed " + seed);
  }
});

// 乱砍 bot：只追着砍，从不弹反/躲危/喝药 —— 应当无法通关
function runMasher(seed, maxFrames) {
  const g = new Game(mulberry32(seed), { stages: STAGES });
  g.start();
  let cd = 0;
  for (let i = 0; i < maxFrames && g.mode === "fight"; i++) {
    const p = g.player, e = g.enemy;
    const dt = 1 / 60;
    cd = Math.max(0, cd - dt);
    g.setHeld("left", false); g.setHeld("right", false);
    const dist = Math.abs(e.x - p.x);
    if (p.state === "idle") {
      if (dist < 90 && cd === 0) { g.press("attack"); cd = 0.42; }
      else if (dist >= 90 && e.state !== "windup" && e.state !== "peril") g.setHeld(dir(g, false), true);
    }
    g.update(dt);
  }
  return g;
}

test("乱砍流无法通关（弹反是主路径，数值分层成立）", () => {
  for (const seed of [1, 7, 42, 99, 2024]) {
    const g = runMasher(seed, 60 * 60);
    assert.equal(g.mode, "death", "seed " + seed + " 乱砍竟存活/通关");
    assert.equal(g.stats.deaths, 1, "seed " + seed);
    // 最强也倒在第四阵火枪手之前（到不了最终 Boss）
    assert.ok(g.waveIndex <= 3, "seed " + seed + " 乱砍冲到 wave=" + g.waveIndex);
  }
});
