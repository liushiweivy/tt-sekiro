/*
 * audio.js — WebAudio 合成音效：刀刃、金属弹反、太鼓、危字低鸣（无音频文件）
 * UMD：抖音小游戏 tt.getAudioContext()（≥1.34.0，无 BiquadFilter/Compressor），
 *      微信 wx.createWebAudioContext()，标准浏览器 new AudioContext()。
 * 抖音适配：带通滤波在生成噪声 PCM 时用 RBJ biquad 离线烘焙，按 (freq,q) 缓存；
 *           无 DynamicsCompressor，主增益限幅替代。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SekiroAudio = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BAKED_SECONDS = 0.5; // 烘焙噪声缓冲时长（循环播放，越长内存越大）

  function AudioSys() {
    this.ctx = null;
    this.master = null;
    this._baked = {}; // "freq|q" -> {buf, srcNoise}
  }

  AudioSys.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    var ac = null;
    try {
      if (typeof tt !== "undefined" && tt.getAudioContext) {
        ac = tt.getAudioContext(); // 抖音：系统单例，勿 new
      } else if (typeof wx !== "undefined" && wx.createWebAudioContext) {
        ac = wx.createWebAudioContext();
      } else if (typeof globalThis !== "undefined" && globalThis.AudioContext) {
        ac = new globalThis.AudioContext();
      } else if (root.AudioContext) {
        ac = new root.AudioContext();
      }
    } catch (e) { ac = null; }
    if (!ac) return;
    this.ctx = ac;
    this.master = ac.createGain();
    // 原浏览器版有 Compressor 压峰；抖音无此节点，用较低主增益防削波
    this.master.gain.value = (typeof tt !== "undefined") ? 0.32 : 0.5;
    this.master.connect(ac.destination);
  };

  AudioSys.prototype.tone = function (freq0, freq1, dur, type, vol, when) {
    if (!this.ctx) return;
    var t0 = this.ctx.currentTime + (when || 0);
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq0, t0);
    if (freq1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };

  /** RBJ cookbook bandpass（constant 0 dB peak）离线烘焙白噪声 */
  function bakeBandpass(ac, freq, q) {
    var n = Math.floor(ac.sampleRate * BAKED_SECONDS);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    var w0 = 2 * Math.PI * freq / ac.sampleRate;
    var cosw = Math.cos(w0), sinw = Math.sin(w0);
    var alpha = sinw / (2 * q);
    var a0 = 1 + alpha;
    var b0 = alpha / a0, b2 = -alpha / a0;
    var a1 = -2 * cosw / a0, a2 = (1 - alpha) / a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < n; i++) {
      var x = Math.random() * 2 - 1;
      var y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      d[i] = y;
    }
    return buf;
  }

  AudioSys.prototype._bakedNoise = function (freq, q) {
    var key = freq + "|" + q;
    if (!this._baked[key]) {
      try { this._baked[key] = bakeBandpass(this.ctx, freq, q); }
      catch (e) { this._baked[key] = null; }
    }
    return this._baked[key];
  };

  AudioSys.prototype.noise = function (dur, vol, freq, q, when) {
    if (!this.ctx) return;
    var t0 = this.ctx.currentTime + (when || 0);
    var f = freq || 2000;
    var qq = q || 1;
    var buf = this._bakedNoise(f, qq);
    if (!buf) return;
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  AudioSys.prototype.play = function (name) {
    if (!this.ctx) return;
    switch (name) {
      case "swing":
        this.noise(0.14, 0.25, 3200, 0.7);
        break;
      case "enemySwing":
        this.noise(0.2, 0.18, 900, 0.6);
        break;
      case "deflect": // 完美弹反：高频金属「锵——」
        this.tone(3050, 2400, 0.32, "triangle", 0.32);
        this.tone(4520, 3900, 0.2, "sine", 0.18);
        this.noise(0.1, 0.3, 5200, 2);
        break;
      case "block": // 普通格挡：闷一声
        this.tone(1900, 1500, 0.14, "square", 0.12);
        this.noise(0.08, 0.2, 2600, 1.5);
        break;
      case "hit": // 砍在甲胄上
        this.noise(0.12, 0.3, 700, 0.8);
        this.tone(520, 300, 0.1, "triangle", 0.15);
        break;
      case "hurt":
        this.tone(90, 45, 0.28, "triangle", 0.4);
        this.noise(0.16, 0.22, 500, 0.7);
        break;
      case "perilHit":
        this.tone(70, 35, 0.45, "sawtooth", 0.35);
        this.noise(0.3, 0.3, 400, 0.6);
        break;
      case "peril": // 「危」低鸣
        this.tone(150, 120, 0.42, "sine", 0.4);
        this.tone(158, 126, 0.42, "sine", 0.2, 0.02);
        break;
      case "perilDodge":
      case "perilJump":
        this.noise(0.16, 0.2, 1800, 0.8);
        this.tone(1200, 1800, 0.12, "sine", 0.12);
        break;
      case "break": // 架势崩
        this.noise(0.3, 0.3, 1200, 0.5);
        this.tone(300, 90, 0.3, "sawtooth", 0.2);
        break;
      case "executeStart":
        this.noise(0.22, 0.2, 2400, 0.7);
        break;
      case "deathblow":
        this.tone(95, 48, 0.5, "triangle", 0.5);
        this.noise(0.18, 0.24, 3600, 0.8, 0.02);
        this.tone(2600, 2000, 0.3, "sine", 0.12, 0.04);
        break;
      case "death":
        this.tone(220, 55, 1.0, "sawtooth", 0.3);
        this.tone(110, 40, 1.1, "sine", 0.3, 0.05);
        break;
      case "victory":
        this.tone(110, 90, 0.35, "triangle", 0.5);
        this.tone(110, 90, 0.35, "triangle", 0.5, 0.42);
        this.tone(3200, 2600, 0.5, "sine", 0.14, 0.1);
        break;
      case "dodge":
        this.noise(0.1, 0.12, 1400, 0.6);
        break;
      case "jump":
        this.noise(0.08, 0.08, 2200, 0.8);
        break;
      case "wave":
        this.tone(160, 130, 0.5, "sine", 0.25);
        break;
      case "whiff":
        this.noise(0.12, 0.06, 1100, 0.5);
        break;
      /* ---- 七阵扩展音效 ---- */
      case "swing2": // 二连斩第二段：更沉的破风
        this.noise(0.16, 0.3, 2400, 0.7);
        this.tone(700, 300, 0.1, "sine", 0.08);
        break;
      case "backstep":
        this.noise(0.1, 0.12, 1100, 0.6);
        break;
      case "combo": // 敌人连段：气合
        this.tone(240, 160, 0.1, "sawtooth", 0.07);
        break;
      case "telegraph": // 刀光将亮：极轻金属颤
        this.tone(3900, 4100, 0.08, "sine", 0.04);
        break;
      case "aim": // 火铳举枪：机括轻响
        this.tone(1400, 900, 0.05, "square", 0.05);
        break;
      case "feint": // 虚招后撤：短布风
        this.noise(0.12, 0.12, 1600, 0.7);
        break;
      case "shoot": // 火铳：轰鸣
        this.noise(0.22, 0.4, 420, 0.4);
        this.tone(140, 60, 0.18, "triangle", 0.3);
        break;
      case "healStart": // 拔葫芦塞
        this.tone(500, 760, 0.08, "sine", 0.12);
        this.noise(0.06, 0.08, 2600, 1.2);
        break;
      case "heal": // 饮下：两轻音 + 温润回响
        this.tone(440, 440, 0.07, "sine", 0.1);
        this.tone(560, 560, 0.1, "sine", 0.1, 0.09);
        break;
      case "gourdEmpty":
        this.tone(300, 180, 0.08, "square", 0.07);
        break;
      case "grabHit": // 擒拿：闷重
        this.tone(60, 32, 0.4, "sawtooth", 0.38);
        this.noise(0.26, 0.28, 350, 0.5);
        break;
      case "thunderCatch": // 接雷：电弧攀上刀身
        this.noise(0.2, 0.22, 6200, 1.4);
        this.tone(1200, 2400, 0.18, "sine", 0.14);
        this.tone(800, 1600, 0.2, "triangle", 0.1, 0.02);
        break;
      case "thunderReturn": // 返雷出手
        this.noise(0.16, 0.3, 4800, 1.2);
        this.tone(900, 2600, 0.22, "sawtooth", 0.14);
        break;
      case "thunderHit": // 被雷劈
        this.tone(55, 28, 0.5, "sawtooth", 0.4);
        this.noise(0.32, 0.34, 3000, 0.8);
        this.tone(2200, 400, 0.2, "square", 0.12);
        break;
      case "thunderHitBoss": // 雷球砸中：雷击鼓
        this.noise(0.3, 0.36, 5200, 1);
        this.tone(1800, 300, 0.35, "sawtooth", 0.2);
        this.tone(70, 36, 0.5, "triangle", 0.4);
        break;
      case "bulletDeflect": // 弹铳：清越金音
        this.tone(3600, 2900, 0.18, "triangle", 0.2);
        this.tone(5200, 4400, 0.12, "sine", 0.12);
        this.noise(0.06, 0.16, 6000, 2);
        break;
      case "bulletBlock":
        this.tone(2200, 1800, 0.08, "square", 0.08);
        break;
      case "bulletHit":
        this.tone(120, 70, 0.16, "triangle", 0.22);
        this.noise(0.1, 0.18, 800, 0.7);
        break;
      case "bulletDodge":
        this.noise(0.08, 0.1, 2600, 1);
        break;
      case "phase": // 觉醒：两记太鼓
        this.tone(95, 48, 0.55, "triangle", 0.45);
        this.noise(0.2, 0.2, 300, 0.6);
        this.tone(95, 48, 0.55, "triangle", 0.4, 0.34);
        this.tone(2800, 2400, 0.3, "sine", 0.1, 0.5);
        break;
    }
  };

  return AudioSys;
});
