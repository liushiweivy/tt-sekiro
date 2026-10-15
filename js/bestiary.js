/*
 * Sekiro Mini · 敌人册（七阵闯关数据）
 *
 * 关卡描述符：
 *   style  近战风格，驱动 enemy.js 的走位 AI
 *   theme  场景主题，驱动 render-bg.js
 *   nodes  每管命一条：hp / windup(举刀秒) / speed / combo(最大连段) / range / attacks 权重表
 *   badge  换管命过场字（Boss 觉醒阶段）
 *   tip    本阵首次教学提示
 *
 * attack 类型：normal 普通刀 / thrust 危·突刺 / sweep 危·扫腿 /
 *             grab 危·擒拿 / thunder 危·雷 / shoot 火铳 / feint 后撤虚招
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./core.js"));
  } else {
    root.Sekiro.Bestiary = factory(root.Sekiro);
  }
})(typeof self !== "undefined" ? self : this, function (Sekiro) {
  "use strict";

  var STAGES = [
    {
      sub: "第一阵", name: "落武者", style: "melee", theme: "castle", armor: 0.95,
      tip: "敌人刀身白光亮起的一瞬点「弹」—— 完美弹反！",
      nodes: [
        { hp: 60, windup: 0.8, speed: 118, combo: 1, range: 96,
          attacks: [{ t: "normal", w: 1 }] },
      ],
    },
    {
      sub: "第二阵", name: "苇名流剑士", style: "melee", theme: "castle", armor: 0.8,
      tip: "小心二连斩：第二刀也要点「弹」！",
      nodes: [
        { hp: 74, windup: 0.64, speed: 142, combo: 2, range: 98,
          attacks: [{ t: "normal", w: 1 }] },
      ],
    },
    {
      sub: "第三阵 · 主将", name: "武士大将 · 赤甲", style: "melee", theme: "castle", armor: 0.62,
      tip: "红色危招：突刺点「垫」穿过去，扫腿点「跳」跃起",
      nodes: [
        { hp: 92, windup: 0.56, speed: 150, combo: 2, range: 100,
          attacks: [
            { t: "normal", w: 10 }, { t: "thrust", w: 2.4 }, { t: "sweep", w: 2.4 },
          ] },
        { hp: 80, windup: 0.5, speed: 158, combo: 3, range: 102,
          attacks: [
            { t: "normal", w: 9 }, { t: "thrust", w: 3 }, { t: "sweep", w: 3 },
          ] },
      ],
    },
    {
      sub: "第四阵", name: "铁炮组 · 火枪手", style: "ranger", theme: "snow", armor: 0.9,
      tip: "火枪子弹也能弹！子弹飞到身前瞬间点「弹」，也可跳起或点「垫」",
      nodes: [
        { hp: 70, windup: 0.66, speed: 128, combo: 1, range: 96,
          attacks: [{ t: "shoot", w: 8 }, { t: "normal", w: 1.2 }] },
      ],
    },
    {
      sub: "第五阵", name: "宝觉 · 枪僧", style: "spear", theme: "rain", armor: 0.75,
      tip: "长枪攻击距离远，扫腿居多 —— 多点「跳」，贴近了打",
      nodes: [
        { hp: 98, windup: 0.7, speed: 132, combo: 2, range: 150,
          attacks: [
            { t: "normal", w: 8 }, { t: "sweep", w: 4 }, { t: "thrust", w: 1.6 },
          ] },
      ],
    },
    {
      sub: "第六阵", name: "孤影众 · 忍", style: "ninja", theme: "ember", armor: 0.55,
      tip: "忍者会后撤虚招接快速突刺，三连斩很快 —— 盯紧刀光",
      nodes: [
        { hp: 86, windup: 0.5, speed: 168, combo: 3, range: 98,
          attacks: [
            { t: "normal", w: 7 }, { t: "thrust", w: 3.4 }, { t: "feint", w: 2.2 },
          ] },
      ],
    },
    {
      sub: "最终阵", name: "剑圣 · 苇名一心", style: "boss", theme: "sakura", armor: 0.5,
      tip: "危·雷：跳起空中点「斩」把雷电劈回去！",
      nodes: [
        { hp: 108, windup: 0.56, speed: 158, combo: 3, range: 104, badge: null,
          attacks: [
            { t: "normal", w: 8 }, { t: "thrust", w: 2.6 }, { t: "sweep", w: 2.6 },
          ] },
        { hp: 96, windup: 0.48, speed: 174, combo: 3, range: 106, badge: "奋起",
          attacks: [
            { t: "normal", w: 8 }, { t: "thrust", w: 2.4 },
            { t: "sweep", w: 2.2 }, { t: "grab", w: 2.2 },
          ] },
        { hp: 90, windup: 0.42, speed: 188, combo: 3, range: 108, badge: "雷霆",
          attacks: [
            { t: "normal", w: 7 }, { t: "thrust", w: 2.2 }, { t: "sweep", w: 1.8 },
            { t: "grab", w: 2 }, { t: "thunder", w: 2.8 },
          ] },
      ],
    },
  ];

  // 通关评价：免许皆伝(S) / 皆伝(A) / 奥伝(B) / 中伝(C)
  function grade(s, stageCount) {
    var hpRatio = s.hpRatio == null ? 1 : s.hpRatio;
    var par = 30 + stageCount * 16; // 参考用时（秒）
    var score = 0;
    if (s.deaths === 0) score += 3;
    else if (s.deaths === 1) score += 1;
    if (s.gourdsUsed <= 1) score += 2;
    else if (s.gourdsUsed <= 3) score += 1;
    if (hpRatio >= 0.55) score += 2;
    else if (hpRatio >= 0.28) score += 1;
    if (s.clearT <= par) score += 2;
    else if (s.clearT <= par + 60) score += 1;
    score += Math.min(2, Math.floor((s.deflects || 0) / 8));

    if (score >= 10) return { rank: "免许皆伝", mark: "S", color: "#ffd96b" };
    if (score >= 7) return { rank: "皆伝", mark: "A", color: "#e8e2cf" };
    if (score >= 4) return { rank: "奥伝", mark: "B", color: "#cfae8a" };
    return { rank: "中伝", mark: "C", color: "#9aa3b5" };
  }

  Sekiro.Bestiary = { STAGES: STAGES, grade: grade };
  return Sekiro.Bestiary;
});
