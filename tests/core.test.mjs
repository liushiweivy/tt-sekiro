// Sekiro Mini · 战斗内核测试：node --test tests/core.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Sekiro = require("../js/core.js");
require("../js/enemy.js"); // 原型注入敌人 AI
const Bestiary = require("../js/bestiary.js");
const { Game, CFG, mulberry32 } = Sekiro;
const { STAGES, grade } = Bestiary;

const DT = 1 / 60;
function newGame(seed = 7) {
  const g = new Game(mulberry32(seed), { stages: STAGES });
  g.start();
  return g;
}
function step(g, frames = 1) {
  for (let i = 0; i < frames; i++) g.update(DT);
}
/** 推进到条件成立（含顿帧等不确定帧数） */
function waitFor(g, fn, maxFrames = 600) {
  for (let i = 0; i < maxFrames; i++) {
    g.update(DT);
    if (fn()) return i;
  }
  return -1;
}
/** 把敌人摆成「举刀中，还剩 delay 秒出手」 */
function armEnemy(g, { type = "normal", delay = 0.1 } = {}) {
  const e = g.enemy;
  e.state = type === "normal" ? "windup" : "peril";
  e.strikeType = type;
  e.windupDur = delay;
  e.stateT = 0;
  e.hitDone = false;
}
/** 敌人立刻进入出刀判定首帧 */
function strikeNow(g, type = "normal") {
  const e = g.enemy;
  e.state = "strike";
  e.strikeType = type;
  e.stateT = 0;
  e.hitDone = false;
  e.lingerT = type === "grab" ? 0.28 : 0;
}

test("开局：第一波敌人生成，玩家满血", () => {
  const g = new Game(mulberry32(1), { stages: STAGES });
  assert.equal(g.mode, "title");
  g.start();
  assert.equal(g.mode, "fight");
  assert.equal(g.waveIndex, 0);
  assert.equal(g.enemy.hp, 60);
  assert.equal(g.player.hp, 100);
});

test("玩家斩击：范围内命中掉血加架势，范围外挥空", () => {
  const g = newGame();
  const { player: p, enemy: e } = g;
  e.x = p.x + 60; e.state = "idle";
  g.press("attack");
  step(g, 6);
  assert.equal(e.hp, 60 - CFG.ATT_HP);
  assert.equal(e.posture, CFG.ATT_POST);
  assert.equal(p.hitDone, true);

  const g2 = newGame();
  g2.enemy.x = 920;
  g2.press("attack");
  step(g2, 8);
  assert.equal(g2.enemy.hp, 60);
});

test("完美弹反：自己不掉血、敌人架势 +30 大硬直、顿帧", () => {
  const g = newGame();
  const { player: p, enemy: e } = g;
  e.x = p.x + 70;
  armEnemy(g, { delay: 0.1 });
  g.press("guard");
  step(g, 7);
  assert.ok(g.events.includes("deflect"), JSON.stringify(g.events));
  assert.equal(p.hp, 100);
  assert.equal(e.posture, 30);
  assert.equal(e.state, "hurt");
  assert.equal(g.stats.deflects, 1);
  assert.ok(g.hitStop > 0);
  const frozen = p.stateT;
  step(g, 1); // 顿帧期间世界不推进
  assert.equal(p.stateT, frozen);
});

test("普通格挡：按早了不掉血但自己涨架势", () => {
  const g = newGame();
  const { player: p, enemy: e } = g;
  e.x = p.x + 70;
  armEnemy(g, { delay: 0.3 });
  g.press("guard");
  step(g, 18);
  assert.ok(g.events.includes("block"));
  assert.equal(p.hp, 100);
  assert.equal(p.posture, CFG.BLOCK_POST);
  assert.equal(g.stats.blocks, 1);
});

test("裸吃：不弹反直接掉血", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 70;
  strikeNow(g);
  step(g, 1);
  assert.ok(g.events.includes("hurt"));
  assert.equal(g.player.hp, 100 - CFG.E_HP);
  assert.equal(g.player.state, "hurt");
});

test("距离外敌人挥空，玩家无伤", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 500;
  strikeNow(g);
  step(g, 1);
  assert.ok(g.events.includes("whiff"));
  assert.equal(g.player.hp, 100);
});

test("危·突刺：格挡受伤，垫步无敌帧躲开", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 85;
  strikeNow(g, "thrust");
  g.press("guard");
  step(g, 2);
  assert.equal(g.player.hp, 100 - CFG.E_PERIL_HP);

  const g2 = newGame();
  g2.enemy.x = g2.player.x + 85;
  strikeNow(g2, "thrust");
  g2.press("dodge");
  step(g2, 1);
  assert.ok(g2.events.includes("perilDodge"), JSON.stringify(g2.events));
  assert.equal(g2.player.hp, 100);
  step(g2, 2);
  assert.equal(g2.player.hp, 100);
});

test("危·扫腿：地面受伤，跳起躲开", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 70;
  strikeNow(g, "sweep");
  step(g, 1);
  assert.equal(g.player.hp, 100 - CFG.E_PERIL_HP);

  const g2 = newGame();
  g2.enemy.x = g2.player.x + 70;
  g2.player.y = 55; g2.player.vy = 600;
  strikeNow(g2, "sweep");
  step(g2, 1);
  assert.ok(g2.events.includes("perilJump"));
  assert.equal(g2.player.hp, 100);
});

test("危·擒拿：贴脸被抓受 30 伤，跑出抓取距离安全", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 70;
  strikeNow(g, "grab");
  step(g, 1);
  assert.ok(g.events.includes("grabHit"));
  assert.equal(g.player.hp, 100 - CFG.GRAB_HP);

  const g2 = newGame();
  g2.enemy.x = g2.player.x + 240;
  strikeNow(g2, "grab");
  step(g2, 20); // 抓取扑空
  assert.equal(g2.player.hp, 100);
  assert.equal(g2.enemy.state, "recover");
});

test("危·雷：地面被劈；空中接住后不返雷，落地受伤", () => {
  const g = newGame();
  g.enemy.x = g.player.x + 80;
  strikeNow(g, "thunder");
  step(g, 1);
  assert.equal(g.player.hp, 100 - CFG.THUNDER_HP);

  const g2 = newGame();
  const p2 = g2.player;
  g2.enemy.x = p2.x + 80;
  strikeNow(g2, "thunder");
  p2.y = 90; p2.vy = 600; // 雷击瞬间在空中
  step(g2, 1);
  assert.equal(p2.charged, true);
  assert.equal(p2.hp, 100);
  p2.state = "jump"; p2.y = 30; p2.vy = -500;
  step(g2, 5); // 落地
  assert.equal(p2.charged, false);
  assert.equal(p2.hp, 100 - CFG.THUNDER_HP);
});

test("危·雷：空中出刀可返雷，雷球砸中 Boss 扣血加架势大硬直", () => {
  const g = newGame();
  const { player: p, enemy: e } = g;
  e.x = p.x + 80;
  strikeNow(g, "thunder");
  p.y = 90; p.vy = 600;
  step(g, 1);
  assert.equal(p.charged, true);
  g.press("attack"); // 空中返雷
  assert.equal(p.charged, false);
  assert.equal(g.bullets.length, 1);
  assert.equal(g.bullets[0].kind, "bolt");
  step(g, 8); // 顿帧后雷球飞到
  assert.equal(e.hp, 60 - CFG.THUNDER_REFLECT_HP);
  assert.equal(e.posture, CFG.THUNDER_REFLECT_POST);
  assert.equal(e.state, "hurt");
  assert.ok((e.hurtUntil || 0) >= CFG.THUNDER_STUN - 0.01);
  assert.ok(e.elec > 0.5, "雷属性残留应保留一阵");
});

test("危·雷：attack 态带雷落地必须结算，雷不能银行化", () => {
  const g = newGame();
  const p = g.player, e = g.enemy;
  e.x = p.x + 80;
  strikeNow(g, "thunder");
  p.y = 90; p.vy = 600;
  step(g, 1);
  assert.equal(p.charged, true);

  // 下落中高度不足时按 J：不返雷，进入空中 attack；收招中落地
  p.y = 20; p.vy = -500;
  p.state = "attack"; p.stateT = 0; p.hitDone = true;
  step(g, 6);
  assert.equal(p.charged, false, "attack 态落地不可残留 charged");
  assert.equal(p.hp, 100 - CFG.THUNDER_HP);

  // 落地结算后再跳起出刀，不得凭旧雷生成雷球
  p.state = "idle"; p.stateT = 0; p.y = 0; p.vy = 0;
  g.press("jump");
  p.y = 90; p.vy = 600; p.state = "jump"; p.stateT = 0;
  g.press("attack");
  assert.equal(g.bullets.length, 0, "旧雷不可留待以后返");
});

test("暂停期间 press 全部无效，setHeld 仍记录；恢复后正常", () => {
  const g = newGame();
  step(g, 1); // 清空开局事件
  g.paused = true;
  g.press("guard");
  g.press("attack");
  g.press("dodge");
  g.press("jump");
  g.press("heal");
  assert.equal(g.player.state, "idle");
  assert.equal(g.events.length, 0, "暂停不产生任何事件（无音效缓冲）");
  g.setHeld("left", true);
  assert.equal(g.held.left, true, "setHeld 不受暂停限制");

  g.paused = false;
  g.press("guard");
  assert.equal(g.player.state, "guard");
});

test("觉醒 phase 过场不可被平砍（与 rise / 雷球判定一致）", () => {
  const g = newGame();
  const p = g.player, e = g.enemy;
  e.x = p.x + 40;
  e.state = "phase";
  e.stateT = 0;
  g.press("attack");
  step(g, Math.ceil((CFG.ATT_WINDUP + CFG.ATT_ACTIVE) / DT) + 1);
  assert.equal(e.hp, 60, "phase 演出期间不掉血");
  assert.equal(e.state, "phase", "phase 演出不被打断");
});

test("架势满崩架势，之后清零恢复", () => {
  const g = newGame();
  g.player.posture = 100;
  step(g, 1);
  assert.equal(g.player.state, "break");
  assert.ok(g.events.includes("break"));
  step(g, Math.ceil(CFG.BREAK_TIME / DT) + 1);
  assert.equal(g.player.state, "idle");
  assert.equal(g.player.posture, 0);
});

test("架势延迟过后自动回复", () => {
  const g = newGame();
  g.player.posture = 50;
  g.player.postDelay = 0;
  step(g, 60);
  assert.ok(g.player.posture < 25, String(g.player.posture));
});

test("忍杀扣命后进入下一阵；忍杀回 10 血", () => {
  const g = newGame();
  g.player.hp = 50;
  g.enemy.posture = 100;
  step(g, 1);
  assert.equal(g.player.state, "execute");
  assert.ok(waitFor(g, () => g.enemy.nodes === 0, 120) >= 0);
  assert.equal(g.player.hp, 60);
  assert.ok(waitFor(g, () => g.waveIndex === 1, 120) >= 0);
  assert.equal(g.enemy.name, STAGES[1].name);
  assert.equal(g.stats.kills, 1);
});

test("HP 砍空也触发忍杀", () => {
  const g = newGame();
  const e = g.enemy;
  e.hp = 5; e.state = "idle";
  e.x = g.player.x + 60;
  g.press("attack");
  step(g, 8);
  assert.equal(e.hp, 0);
  assert.equal(e.state, "executable");
  assert.equal(g.player.state, "execute");
});

test("赤甲两命：处决一管后复活（觉醒阶段数据），再杀进入第四阵", () => {
  const g = newGame();
  g.spawnWave(2);
  assert.equal(g.enemy.nodes, 2);
  g.enemy.posture = 100;
  step(g, 70);
  assert.equal(g.enemy.nodes, 1);
  assert.equal(g.enemy.hp, STAGES[2].nodes[1].hp);
  assert.equal(g.enemy.state, "rise");
  step(g, 90);
  g.enemy.posture = 100;
  step(g, 130);
  assert.equal(g.waveIndex, 3);
  assert.equal(g.enemy.name, STAGES[3].name);
});

test("剑圣三管命：进二、三管都有觉醒过场（badge），终管处决即通关", () => {
  const g = newGame();
  g.spawnWave(6);
  g.enemy.posture = 100;
  assert.ok(waitFor(g, () => g.enemy.nodes === 2, 120) >= 0);
  assert.equal(g.enemy.state, "phase");
  assert.equal(g.enemy.cur.badge, "奋起");
  assert.ok(waitFor(g, () => g.enemy.state === "idle", 150) >= 0);

  g.enemy.posture = 100;
  assert.ok(waitFor(g, () => g.enemy.nodes === 1, 120) >= 0);
  assert.equal(g.enemy.state, "phase");
  assert.equal(g.enemy.cur.badge, "雷霆");
  assert.ok(waitFor(g, () => g.enemy.state === "idle", 150) >= 0);

  g.enemy.posture = 100;
  assert.ok(waitFor(g, () => g.mode === "victory", 240) >= 0);
  assert.equal(g.stats.kills, 3); // 本阵三次忍杀
});

test("伤药葫芦：回 42 血并消耗；最多 3 个；满血不用；被打断不消耗", () => {
  const g = newGame();
  g.player.hp = 20;
  g.press("heal");
  assert.equal(g.player.state, "heal");
  step(g, Math.ceil(CFG.GOURD_APPLY / DT) + 1);
  assert.equal(g.player.hp, 62);
  assert.equal(g.player.gourds, 2);
  assert.equal(g.stats.gourdsUsed, 1);

  const g2 = newGame();
  g2.press("heal");
  assert.notEqual(g2.player.state, "heal"); // 满血不用
  assert.equal(g2.player.gourds, 3);

  const g3 = newGame();
  g3.player.hp = 30;
  g3.press("heal");
  step(g, 0);
  step(g3, 18); // 0.3s，还没到生效点
  g3.enemy.x = g3.player.x + 70;
  strikeNow(g3);
  step(g3, 1); // 被打断
  assert.equal(g3.player.state, "hurt");
  assert.equal(g3.player.gourds, 3); // 没喝成，不消耗
});

test("二连斩：收招末段预输入 J，第二段伤害与架势更高", () => {
  const g = newGame();
  const { player: p, enemy: e } = g;
  e.x = p.x + 60; e.state = "idle";
  g.press("attack");
  assert.equal(p.slashSide, -1, "第一刀向左劈");
  step(g, 19); // 0.317s，进入收招末段预输入窗
  g.press("attack");
  assert.equal(p.queueAttack, true);
  step(g, 8); // 收招结束 → 第二段启动
  assert.equal(p.state, "attack");
  assert.equal(p.comboStep, 2);
  assert.equal(p.slashSide, 1, "第二刀向右劈");
  step(g, 8); // 第二段判定
  assert.equal(e.hp, 60 - CFG.ATT_HP - CFG.ATT2_HP);
  assert.equal(e.posture, CFG.ATT_POST + CFG.ATT2_POST);
});

test("劈砍方向：错过预输入窗的新一刀重置为左劈；空中出刀也是左劈", () => {
  const g = newGame();
  const p = g.player;
  g.press("attack");
  assert.equal(p.slashSide, -1);
  step(g, 40); // 整套挥完回 idle
  assert.equal(p.state, "idle");
  g.press("attack");
  assert.equal(p.comboStep, 1);
  assert.equal(p.slashSide, -1, "新起手永远是左劈");

  const g2 = newGame();
  g2.player.state = "jump"; g2.player.y = 60;
  g2.press("attack");
  assert.equal(g2.player.comboStep, 1);
  assert.equal(g2.player.slashSide, -1);
});

test("垫步方向：按住后退时垫步是向后撤（躲擒拿用）", () => {
  const g = newGame();
  const x0 = g.player.x;
  g.setHeld("left", true);
  g.press("dodge");
  assert.equal(g.player.dodgeDir, -1);
  step(g, 3);
  assert.ok(g.player.x < x0);
});

test("火铳子弹：裸吃受伤，完美弹反弹飞，跳起从头顶掠过", () => {
  const g = newGame();
  g.spawnWave(3);
  const p = g.player;
  g.enemy.state = "idle"; g.enemy.idleUntil = 99;
  g.bullets.push({ kind: "bullet", from: "e", x: p.x - 80, y: CFG.GROUND - 106, vx: CFG.BULLET_SPEED, t: 0 });
  step(g, 12);
  assert.equal(p.hp, 100 - CFG.BULLET_HP);
  assert.equal(g.bullets.length, 0);

  const g2 = newGame();
  g2.spawnWave(3);
  const p2 = g2.player;
  g2.enemy.state = "idle"; g2.enemy.idleUntil = 99;
  g2.bullets.push({ kind: "bullet", from: "e", x: p2.x - 120, y: CFG.GROUND - 106, vx: CFG.BULLET_SPEED, t: 0 });
  g2.press("guard");
  step(g2, 13);
  assert.equal(p2.hp, 100);
  assert.equal(g2.stats.bulletDeflects, 1);
  assert.equal(g2.bullets.length, 0);

  const g3 = newGame();
  g3.spawnWave(3);
  const p3 = g3.player;
  g3.enemy.state = "idle"; g3.enemy.idleUntil = 99;
  p3.state = "jump"; p3.y = 80; p3.vy = 500;
  g3.bullets.push({ kind: "bullet", from: "e", x: p3.x - 80, y: CFG.GROUND - 106, vx: CFG.BULLET_SPEED, t: 0 });
  step(g3, 20);
  assert.equal(p3.hp, 100); // 跳过去了
});

test("死亡计数 + 重开本阵回满", () => {
  const g = newGame();
  g.player.hp = 10;
  g.enemy.x = g.player.x + 70;
  strikeNow(g);
  step(g, 1);
  assert.equal(g.mode, "death");
  assert.equal(g.stats.deaths, 1);
  const waveBefore = g.waveIndex;
  g.restart();
  assert.equal(g.mode, "fight");
  assert.equal(g.waveIndex, waveBefore);
  assert.equal(g.player.hp, 100);
  assert.equal(g.player.gourds, CFG.GOURD_MAX);
});

test("敌人册结构：七阵共十管命，类型/场景合法", () => {
  assert.equal(STAGES.length, 7);
  let nodes = 0;
  const styles = new Set(["melee", "ranger", "spear", "ninja", "boss"]);
  const themes = new Set(["castle", "snow", "rain", "ember", "sakura"]);
  const types = new Set(["normal", "thrust", "sweep", "grab", "thunder", "shoot", "feint"]);
  for (const s of STAGES) {
    assert.ok(styles.has(s.style), s.name);
    assert.ok(themes.has(s.theme), s.name);
    assert.ok(s.nodes.length >= 1);
    assert.ok(s.tip.length > 0);
    for (const n of s.nodes) {
      nodes++;
      assert.ok(n.hp > 0 && n.windup > 0 && n.speed > 0);
      for (const a of n.attacks) {
        assert.ok(types.has(a.t), a.t);
        assert.ok(a.w > 0);
      }
    }
  }
  assert.equal(nodes, 10);
});

test("通关评价函数：无死亡高血量给 S，勉强通关给 C", () => {
  const s = grade({ deaths: 0, gourdsUsed: 0, hpRatio: 0.9, clearT: 60, deflects: 20 }, 7);
  assert.equal(s.mark, "S");
  const c = grade({ deaths: 6, gourdsUsed: 8, hpRatio: 0.05, clearT: 600, deflects: 0 }, 7);
  assert.equal(c.mark, "C");
});
