/* 输入：键盘（双人）+ 手柄（Gamepad API）。
 * sample() 返回本帧 [P1, P2] 的方向/按键掩码；actions() 返回菜单动作（边沿触发）。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var BIT = FG.BIT;
  var down = {};
  var queue = [];

  var P1 = { KeyW: BIT.UP, KeyS: BIT.DOWN, KeyA: BIT.LEFT, KeyD: BIT.RIGHT,
    KeyJ: BIT.A, KeyK: BIT.B, KeyL: BIT.C, Semicolon: BIT.D };
  var P2 = { ArrowUp: BIT.UP, ArrowDown: BIT.DOWN, ArrowLeft: BIT.LEFT, ArrowRight: BIT.RIGHT,
    KeyN: BIT.A, KeyM: BIT.B, Comma: BIT.C, Period: BIT.D };

  var ACTIONS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'ok', NumpadEnter: 'ok', Space: 'ok',
    Escape: 'escape', Backspace: 'back', KeyQ: 'back',
    KeyH: 'hitbox', KeyR: 'reset', KeyT: 'dummy', KeyI: 'infinite', KeyO: 'record', KeyP: 'play'
  };
  var PREVENT = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };
  var PAD_BTN = [BIT.A, BIT.B, BIT.C, BIT.D];   // A B X Y → A B C D
  var PAD_START = 256;
  var prevPad = [0, 0];

  var tap = [0, 0];   // 按下边沿：短于一帧的轻点也不会丢，采样后清零
  window.addEventListener('keydown', function (e) {
    if (PREVENT[e.code]) e.preventDefault();
    if (e.repeat) return;
    down[e.code] = true;
    if (FG.sfx && FG.sfx.unlock) FG.sfx.unlock();
    if (P1[e.code]) tap[0] |= P1[e.code];
    if (P2[e.code]) tap[1] |= P2[e.code];
    if (ACTIONS[e.code]) queue.push(ACTIONS[e.code]);
  });
  window.addEventListener('keyup', function (e) { down[e.code] = false; });
  window.addEventListener('blur', function () { for (var c in down) down[c] = false; });

  function kbMask(map) {
    var m = 0;
    for (var c in map) if (down[c]) m |= map[c];
    return m;
  }

  function padBits(idx) {
    var pads = navigator.getGamepads ? navigator.getGamepads() : null;
    var pad = pads ? pads[idx] : null;
    if (!pad) return 0;
    var b = pad.buttons || [], ax = pad.axes || [];
    function on(i) { return !!(b[i] && (b[i].pressed || b[i].value > 0.5)); }
    var bits = 0;
    if (on(12) || (ax[1] || 0) < -0.5) bits |= BIT.UP;
    if (on(13) || (ax[1] || 0) > 0.5) bits |= BIT.DOWN;
    if (on(14) || (ax[0] || 0) < -0.5) bits |= BIT.LEFT;
    if (on(15) || (ax[0] || 0) > 0.5) bits |= BIT.RIGHT;
    for (var i = 0; i < 4; i++) if (on(i)) bits |= PAD_BTN[i];
    if (on(9)) bits |= PAD_START;
    return bits;
  }

  function padActions() {
    var out = [];
    for (var i = 0; i < 2; i++) {
      var cur = padBits(i);
      var edge = cur & ~prevPad[i];
      prevPad[i] = cur;
      if (edge & BIT.UP) out.push('up');
      if (edge & BIT.DOWN) out.push('down');
      if (edge & BIT.LEFT) out.push('left');
      if (edge & BIT.RIGHT) out.push('right');
      if (edge & BIT.A) out.push('ok');
      if (edge & BIT.B) out.push('back');
      if (edge & PAD_START) out.push('escape');
    }
    return out;
  }

  var MASK = FG.BTN_MASK | 15;

  FG.input = {
    sample: function () {
      var out = [kbMask(P1) | tap[0] | (padBits(0) & MASK), kbMask(P2) | tap[1] | (padBits(1) & MASK)];
      tap[0] = 0;
      tap[1] = 0;
      return out;
    },
    clearTaps: function () { tap[0] = 0; tap[1] = 0; },
    actions: function () {
      var out = queue.splice(0, queue.length);
      return out.concat(padActions());
    }
  };
})();
