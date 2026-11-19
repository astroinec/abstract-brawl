/* 抽象格斗 M0 · 核心常量与工具
 * 战斗数值全部为定点整数（1px = 100 子单位），同输入同结果，便于后续回滚联机。
 */
(function () {
  'use strict';
  var FG = (window.FG = window.FG || {});

  FG.SUB = 100;              // 1px = 100 子单位
  FG.FPS = 60;
  FG.W = 960;
  FG.H = 540;
  FG.GROUND_Y = 440;         // 画面中地面的 y（px）
  FG.WALL = 400;             // 角色原点可达的 x 边界（±px）
  FG.PUSH_MIN = 70;          // 两人原点最小间距（px）
  FG.GRAVITY = 0.8;          // px/帧²
  FG.POWER_MAX = 300;
  FG.SUPER_COST = 100;
  FG.ROUND_FRAMES = 99 * 60;
  FG.BUFFER = 6;             // 攻击输入缓冲（帧）
  FG.MOTION_WINDOW = 16;     // 搓招回看窗口（帧）
  FG.DOWN_FRAMES = 40;       // 倒地时长（帧）
  FG.INTRO_FRAMES = 90;
  FG.VS_FRAMES = 90;          // 第一回合前的 VS 开场（帧）
  FG.KO_FRAMES = 150;
  FG.SUPER_FREEZE = 40;      // 超杀发动定格（帧）
  // 阶段二系统
  FG.DASH_WINDOW = 12;       // 66 / 44 两次轻点的最大间隔（帧）
  FG.DASH_FRAMES = 18;       // 前冲时长
  FG.DASH_SPEED = 6.5;       // 前冲速度（px/帧）
  FG.BDASH_FRAMES = 22;      // 后撤时长
  FG.BDASH_INVUL = 9;        // 后撤前若干帧无敌
  FG.BDASH_SPEED = 5.5;
  FG.TECH_WINDOW = 12;       // 倒地后多少帧内按键可受身
  FG.TECH_RISE = 12;         // 受身起身帧数（普通倒地为 DOWN_FRAMES）
  FG.TECH_ROLL = 4;          // 受身向后翻滚速度（px/帧）
  FG.GC_COST = 50;           // 防御反击消耗
  FG.PAIR_WINDOW = 3;        // 两键"同时按"的容差（帧）
  FG.THROW_BREAK = 8;        // 被抓前多少帧内同按 B+D 可拆投

  FG.BIT = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, C: 64, D: 128 };
  FG.BTN_MASK = 16 | 32 | 64 | 128;
  FG.BTNS = ['A', 'B', 'C', 'D'];

  FG.px = function (v) { return Math.round(v * FG.SUB); };
  FG.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  // 数字键盘记法（相对朝向）：7 8 9 / 4 5 6 / 1 2 3，5 为中立
  FG.numpad = function (up, down, fwd, back) {
    var v = (up ? 1 : 0) - (down ? 1 : 0);
    var h = (fwd ? 1 : 0) - (back ? 1 : 0);
    var row = v === 1 ? 7 : (v === -1 ? 1 : 4);
    return row + h + 1;
  };

  // 确定性随机数（LCG）；种子存放在对局对象的 seed 字段里
  FG.nextRand = function (obj) {
    obj.seed = (Math.imul(obj.seed, 1664525) + 1013904223) >>> 0;
    return obj.seed / 4294967296;
  };
})();
