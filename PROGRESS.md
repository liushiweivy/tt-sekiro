# 影狼 · 弹剑道场（Sekiro Mini）— 进度断点

> 更新于 2026-10-15（晚）。**抖音小游戏移植完成（WF2，含二轮 code review 修复）**：横屏 Canvas、自绘虚拟键、tt.* 平台层、31 测试全绿；harness bot 满血 S 通关 + strict/sound/lifecycle/防连点冒烟全过。待 DevTools 真机编译截图（**首触必查 [probe] touch 探针日志与点按位置**）。

## 当前状态：抖音小游戏版可玩，待开发者工具编译验证

### 2026-10-15（晚）抖音移植（tt-sekiro，源 sekiro-mini）

- 架构：game.js require 链；render 五件套 + audio 裸 IIFE → UMD（CJS 与浏览器全局双态）；core/enemy/bestiary/tests 零改动
- audio：tt.getAudioContext()（≥1.34.0）优先、wx/浏览器兜底；去 DynamicsCompressor→主增益 0.32；带通噪声改 RBJ bandpass 烘焙 PCM（按 freq|Q 缓存 0.5s 缓冲）；主循环音频调用 try/catch 包裹，真机音频异常只静音不冻结
- main.js 重写：tt.createCanvas + DPR + 960×540 letterbox（含黑边填充）；tt.onTouch* 多触点 identifier 跟踪（held 键多指幂等）；screenX 兜底；onHide 松键+暂停、onShow 重置时间戳；setKeepScreenOn；固定 60Hz（guard 5 + acc 钳制，帧间事件预排空）
- 触屏：render-touch.js 新模块（8 键：◀▶ 跳 / 葫 垫 弹 斩 / ‖暂停，热区 ≥44px 思路，葫芦显示余量、空葫芦变灰，fightOnly/paused 隐藏）；HUD 键盘小抄与「伤药葫芦 F」在 R.touchMode 下隐藏/去键位字；标题操作卡改触屏文案；暂停层点按即继续
- harness：960×540 浏览器 tt shim；?sound=1 真实 AudioContext（含点按解锁）、?strict=1 只给 screenX/Y、tt._life.hide/show；同步 XHR CommonJS 加载器
- 验证：`node --test tests/core.test.mjs tests/balance.test.mjs` 31/31；CJS 全链 require 冒烟；harness 确定性 bot（globalThis.__sekiro + 屏蔽 rAF update）满血 S 通关（seed 由时间，10 忍杀/13 弹反/1:04）；docs/ 三截图；0 console error；真实点按入阵 + onHide 暂停实测通过
- 删除：旧 index.html（DOM 触屏垫，已被 harness 取代）、tests/cdp-smoke.mjs（网页版 Edge CDP 测试）；start.bat 改指 harness:8822
- 二轮 code review 修复：① 音频恢复——onShow 与暂停层点按继续均补 audio.ensure()（后台 suspended→resume）；② 死亡防连点——帧循环监测 mode→death 翻变记 deathAt，tapFlow 在 0.8s（RESTART_GUARD）内忽略重开（平台层补齐源 core 快照缺失的语义，不回同步漂移源）；③ 六阵教学 tip 全改触屏键名（点「弹」/「垫」/「跳」/「斩」）；④ 热区加大（hitR：◀▶34/跳32/葫26/垫32/弹36/斩40/暂停24，7 键命中圆两两不重叠已脚本验证）；⑤ 触摸坐标探针 rawPoint()：首触 console.log("[probe] touch", …)（client/screen/vw/vh/dpr/screenW/screenH），无 clientX 且坐标越出逻辑【屏幕】时按 1/dpr 自校正；⑥ project.config.json 忽略 README/PROGRESS/.gitignore
- 三轮 code review（终审 APPROVE）修复：① 自校正阈值 windowWidth → **screenWidth/screenHeight**——Android 窗口常窄于屏幕（状态栏），边缘点按 screenX 可略大于 vw 但恒 ≤ screenWidth，用窗口阈值会误触发一次性不可逆 1/dpr 校正导致整机触控永久失灵；② 归一后仍越窗追加 console.warn（横屏轴对调诊断）；③ 暂停键解除方向补 audio.ensure()。同款修复已同步 tt-jianpu-piano
- 冒烟（strict harness，真实鼠标→screenX-only 事件）：点按入阵、暂停键暂停/点按继续、onHide 自动暂停/onShow 不自动解除、死亡 0.8s 内点按被拦/之后正常重开、探针 norm:1 且 0 warn/error；node 31/31 回归绿
- 待办：抖音开发者工具 4.5.6 测试号导入编译 + 模拟器/真机预览截图（音频需基础库 ≥1.34.0；**真机首触核对探针：screenX 若为物理像素（>windowWidth）自校正是否生效、横屏轴对调**）；正式上架需企业+版号，上传预检必接 tt.navigateToScene 侧边栏复访

---

## 以下为网页版历史记录

## 当前状态：七阵版完成

### 内核（js/core.js，UMD 纯逻辑，Node 可测）

- 固定 60Hz；架势/弹反三档（完美 0.22s、格挡 0.46s、裸吃）；架势满崩 → 忍杀扣命；忍杀回 10 血
- 危招四类：突刺（垫步）/ 扫腿（跳）/ 擒拿（撤出 120px，扑击 190px/s）/ 雷（空中接、空中 J 返雷，带雷落地 34 血）
- 新玩家机制：伤药葫芦 F（3 口 / +42 / 0.34s 生效时点扣数，被打断不耗）、二连斩（收招末段 0.14s 预输入，14 血 22 架势）、垫步方向跟走位键（后撤）、顿帧 hitStop、屏闪、雷缠身 charged
- 火铳子弹：620px/s，弹反/格挡/跳跃掠过/垫步无敌帧/裸吃 13 血
- 多命敌人：nodes 数组，处决后换管命；带 badge 的节点走 1.35s「phase」觉醒过场
- 霸体 armorT 防屈死；确定性 RNG mulberry32

### 数据 / AI

- `js/bestiary.js`：七阵 10 命，style（melee/ranger/spear/ninja/boss）驱动走位 AI，theme（castle/snow/rain/ember/sakura）驱动场景；`grade(stats,7)` → S/A/B/C
- `js/enemy.js`：原型注入。approach/backstep（火枪风筝）/feint（忍者虚招接突刺）/aim/风步/危/aim 举枪/strike/recover 连段/hurt/rise/phase；simBullets 处理敌弹与玩家雷球

### 表现层（SekiroRender 命名空间，5 个 render-*.js）

- render-bg：五主题（城山月夜 / 飘雪 / 雨桥水洼 / 余烬火星+地平线火光 / 樱月鸟居飞瓣）
- render-figure：狼（heal/二连斩宽刀光/后撤残影/雷缠电火）+ 五种敌人外形（头盔太刀、阵笠火铳、光头长枪、蒙面忍手、白发红披野太刀）
- **鼠标操作 + 左右劈砍**：左键/J 第一刀左袈裟（前上→后下白弧），二连斩第二刀右反袈裟（过顶→前下红弧），core 里 slashSide -1/1；右键/K 反手横刀（swordAngle 158°，刀身架颈后），perfect 窗口刀身发白
- render-hud：双面板血条架势、葫芦、七阵进度点、本阵教学提示（每阵首次 5.2s）、忍殺/觉醒/阵名 Banner
- render-screens：标题七阵名录+操作卡、死亡、S/A/B/C 评价战报、暂停
- audio.js：WebAudio 合成 ~38 种音效（新增铳击/雷/葫芦/觉醒太鼓等）
- main.js：键盘（J/K/L/Space/F/P/Esc/R）+ 鼠标（左键斩/右键格挡弹反，canvas contextmenu 已屏蔽）、粗指针设备自动显示触屏按键、Enter/点击入阵、60Hz 固定步长

### 验证

- `node --test tests/core.test.mjs tests/balance.test.mjs` → **31/31 绿**
  - 平衡：弹反 bot 五种子（1/7/42/99/2024）全通关 10 杀；乱砍 bot 五种子全死在第 2–3 阵（waveIndex ≤ 3）
  - code-reviewer 终审（0 CRITICAL）后修复 2 HIGH + 3 MEDIUM + 2 LOW，含 3 个回归测试：
    雷缠身统一落地结算（`resolveChargedLand`，attack 态落地不可存雷）、暂停期 press 全屏蔽（不可暂停缓冲必弹）、
    phase 觉醒不可被平砍、K 文案改点按、失焦自动暂停、HUD 测宽字体顺序、drawHead 死参
- `node tests/cdp-smoke.mjs`（静态服务 8777 + 独立无头 Edge CDP 9333）：
  seed 42 真机 rAF 通关（10 忍杀 / 14 弹反 / 1 弹铳 / 66.1s / S 评价），P 暂停生效，无 JS 异常/console 错误，截图在 `.cdp-shots/`（已 gitignore）
- 双击 `index.html` 或 `start.bat` 即玩，零依赖零服务

## 后续可选（YAGNI，未做）

- 更多敌人/关卡（数据驱动，往 bestiary STAGES 加节点即可；grade 的 stageCount 已参数化）
- 简单 BGM（目前只有音效）
- 触屏按钮位置/大小按真机手感微调

## 注意事项

- Node 24 跑测试必须显式传文件：`node --test tests/core.test.mjs tests/balance.test.mjs`（不能传目录）
- 共享浏览器勿关勿杀；无头验证只用独立 `--user-data-dir` 的 Edge（`.cdp-profile/`）
- 禁按镜像名 taskkill（本机多 python/edge 并发），用 PID 或 TaskStop
- 系统 python/py 已坏，起静态服务用 node
- 调数值后必跑 balance 双 bot，确认「弹反可赢、乱砍必死」分层不破坏
