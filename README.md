# 影狼 · 弹剑道场（tt-sekiro · 抖音小游戏版）

只狼式弹反横版动作的**抖音小游戏**：砍血只是辅助，弹反崩架势才是正道——架势满 → 忍杀扣命，七阵踏破即通关。纯 Canvas、零素材零依赖（音效用 WebAudio 合成）。

> 同源项目：网页版 `E:\1workspace\sekiro-mini`，内核共用。本目录是抖音移植版，**不改动原版**。

## 七阵闯关（共 10 管命）

| 阵 | 敌人 | 风格 / 场景 | 命数 | 要点 |
|----|------|------------|------|------|
| 一 | 落武者 | 太刀 · 月夜城山 | 1 | 弹反入门 |
| 二 | 苇名流剑士 | 太刀 · 月夜城山 | 1 | 二连斩，刀刀要弹 |
| 三 | 武士大将 · 赤甲 | 太刀 · 月夜城山 | 2 | 危·突刺 / 扫腿登场 |
| 四 | 铁炮组 · 火枪手 | 火铳 · 飘雪城前 | 1 | 子弹能弹、能跳、能垫 |
| 五 | 宝觉 · 枪僧 | 长柄 · 雨桥 | 1 | 枪长扫多，跳着近身 |
| 六 | 孤影众 · 忍 | 忍手 · 余烬屋顶 | 1 | 后撤虚招接快突，三连斩 |
| 终 | 剑圣 · 苇名一心 | 剑圣 · 樱月鸟居 | 3 | 觉醒「奋起」（擒拿）→「雷霆」（危·雷） |

通关按表现评定：**免许皆伝 S / 皆伝 A / 奥伝 B / 中伝 C**（阵亡、葫芦、剩余血量、用时、弹反数综合）。

## 触屏操作

左下：**◀ ▶**（按住移动）、**跳**；右下：**葫**（伤药葫芦 ×3）、**垫**（垫步，按住方向可后撤）、**弹**（格挡/完美弹反）、**斩**（二连斩）；右上 **‖** 暂停。

- **完美弹反**：敌人刀光将亮的一瞬（命中前 0.22s）按「弹」——无伤、敌人 +30 架势、世界顿帧；按早只是普通格挡，自己涨架势。
- **危招（不可格挡）**：突刺→垫步穿；扫腿→跳；擒拿→后撤逃离（120px）；雷→跳起空中接住、落地前空中「斩」**返雷**（带雷落地 34 血）。
- **火铳子弹**（13 血）：可弹飞（计弹铳数）、可跳过、可垫步穿。
- 忍杀无敌演出回 10 血；死亡原地重开本阵；敌人有 armor 与霸体，不能屈死。

## 抖音适配点（相对网页版）

| 项 | 网页版 | 抖音小游戏版 |
|---|---|---|
| 入口 | index.html `<script>` 链 | `game.js` require 链（CommonJS） |
| 画布 | DOM canvas + style 缩放 | `tt.createCanvas()` 首画布上屏，DPR + 960×540 逻辑世界 letterbox |
| 输入 | 键盘/鼠标 + DOM 触屏垫 | 全局 `tt.onTouch*` 多点触控 + **Canvas 自绘虚拟键**（render-touch.js） |
| 坐标 | clientX | clientX 优先、**screenX/screenY 兜底**（抖音文档只保证 screen 系）；首触打印 `[probe] touch` 探针日志，若真机按物理像素上报（坐标越出逻辑**屏幕** screenWidth/Height，特征是越界数百 px）自动按 1/DPR 归一；归一后仍越窗再 warn（轴对调诊断） |
| 音频 | `new AudioContext()` + Compressor + BiquadFilter | **`tt.getAudioContext()`（基础库 ≥1.34.0）**；无 Compressor → 主增益 0.32 限幅；无 BiquadFilter → 带通噪声按 (freq,Q) 烘焙 PCM（RBJ bandpass，0.5s 缓冲缓存复用） |
| 生命周期 | blur 松键暂停 | `tt.onHide` 松全部按住键 + 自动暂停；`tt.onShow` 丢弃累积时间 + `audio.ensure()` 恢复挂起的音频 |
| 模块 | 裸 IIFE 挂全局 | render 五件套 + audio 全部 UMD（CJS require 链，浏览器全局模式仍保留） |
| 其他 | — | 死亡 0.8s 内忽略重开点按（对齐源项目 RESTART_GUARD 语义，平台层监测 mode 翻变）；`tt.setKeepScreenOn` 常亮；暂停层点按即继续 |

core.js / enemy.js / bestiary.js / tests **零改动**（原本就是 UMD 纯逻辑）。

## 运行

1. 打开**抖音开发者工具**（本仓用 4.5.6 验证）→ 导入项目 → 选择本目录 → 类型「小游戏」（横屏）。
2. AppID 选**测试号**（可编译/预览调试，不可上传）；`project.config.json` 里 appid 留空，导入时手动选测试号。
3. 基础库 ≥ 1.34.0（音频需要）。
4. **首次编译/真机必查**：console 首条 `[probe] touch` 日志——确认 `norm:1`（若触点按物理像素上报，点到右侧按键时会自动按 1/DPR 归一），逐个验证虚拟键点按位置准确（横屏注意 screenX/Y 轴对调）。

浏览器联调（core/render/audio 均无强平台依赖）：

```powershell
# 直接双击 start.bat，或 Git Bash：
"/c/Users/4v/AppData/Local/Programs/Python/Python312/python.exe" -m http.server 8822
# 打开 http://127.0.0.1:8822/harness/index.html
```

harness 内置 `tt` shim，查询参数：
- 默认：静音、Touch 同时带 clientX/screenX；
- `?sound=1`：真实浏览器 AudioContext，跑通 W3C 音频路径（需一次点按解锁）；
- `?strict=1`：严格抖音契约，Touch 只给 identifier/screenX/screenY，验证兜底坐标；
- `tt._life.hide()/show()`：手动触发后台/回前台（松键+自动暂停）。

## 测试

```powershell
node --test tests/core.test.mjs tests/balance.test.mjs
```

- **31 个测试全绿**：28 机制测试 + 3 组 bot 平衡测试（弹反流 5 种子全通关 10 忍杀含弹铳/躲擒拿/返雷；乱砍流 5 种子必死于第 2–3 阵）。
- harness 实测：确定性 bot 七阵满血通关 S 评价（13 次完美弹反、10 忍杀、1:04），截图见 `docs/`（title/fight/victory）；strict 真实点按入阵、暂停键/点按继续、onHide 自动暂停、死亡 0.8s 防连点、探针日志均验证，0 console error。

## 发布备注（暂未做）

- 测试号不能上传；正式发布需在抖音开放平台注册小游戏 AppID（游戏类目通常需企业主体 + 版号等资质）。
- 上传有审核预检：**必接「侧边栏复访」`tt.navigateToScene`**，否则上传被拦截。本地编译与预览不受影响。

## 代码结构

```
game.js              入口：require("./js/main.js")
game.json            横屏配置（deviceOrientation: landscape）
project.config.json  抖音工程配置（appid 留空=导入时选测试号）
js/
  core.js            战斗内核（纯逻辑 UMD，仅 Math，mulberry32 可复现）
  enemy.js           敌人 AI（原型注入 Game.prototype）
  bestiary.js        七阵数据 + 通关评价
  render.js          渲染命名空间 + 主入口/子弹/FX/后处理（UMD）
  render-bg.js       五主题程序化场景（UMD）
  render-figure.js   狼 + 五类敌人姿态（UMD）
  render-hud.js      血条/架势/葫芦/七阵进度/教学/Banner（UMD）
  render-screens.js  标题/死亡/通关/暂停（UMD）
  render-touch.js    【新】Canvas 触屏虚拟键：几何/命中/按住态绘制（UMD）
  audio.js           WebAudio 合成（tt.getAudioContext / wx / 浏览器 三分支，UMD）
  main.js            【重写】平台层：画布、触摸、固定 60Hz、音频转发、生命周期
harness/index.html   浏览器 tt shim + 同步 CommonJS 加载器（sound/strict 开关）
tests/               node:test 机制（28）+ 平衡 bot（3）
docs/                harness 实测截图
```
