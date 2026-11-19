/* 电脑陪练与训练假人：只输出按键掩码，与玩家走同一套规则（不作弊）。
 * 难度 1 简单 / 2 普通 / 3 困难：防御率、反应速度、受身、对空、确认连段、上下段择、投技、防御反击逐级开放。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var BIT = FG.BIT;

  var DUMMY_MODES = ['stand', 'crouch', 'auto', 'random'];
  var DUMMY_NAMES = { stand: '站立不动', crouch: '蹲下不动', auto: '自动防御', random: '随机防御' };
  var LEVEL_NAMES = { 1: '简单', 2: '普通', 3: '困难' };

  // 各难度参数：block 防御率、react 反应帧、think 思考间隔、tech 受身率、anti 对空率、
  // confirm 确认连段率、mix 针对防御姿势择上下段、gc 防御反击率、throwP 近身投率、dash 冲刺率、special 必杀倾向
  var LEVELS = {
    1: { block: 0.3, react: 8, think: [14, 20], tech: 0, anti: 0, confirm: 0, mix: 0, gc: 0, throwP: 0.04, dash: 0, special: 0.6 },
    2: { block: 0.6, react: 5, think: [8, 14], tech: 0.5, anti: 0.3, confirm: 0.35, mix: 0.3, gc: 0.1, throwP: 0.12, dash: 0.25, special: 1 },
    3: { block: 0.85, react: 3, think: [4, 9], tech: 0.9, anti: 0.7, confirm: 0.9, mix: 0.75, gc: 0.3, throwP: 0.3, dash: 0.45, special: 1.2 }
  };

  function fwdOf(p) { return p.facing === 1 ? BIT.RIGHT : BIT.LEFT; }
  function backOf(p) { return p.facing === 1 ? BIT.LEFT : BIT.RIGHT; }

  function isLowAttack(o) {
    if (o.state !== 'atk' || !o.mv) return false;
    var hits = o.moves[o.mv].hits;
    for (var i = 0; i < hits.length; i++) if (hits[i].level === 'low') return true;
    return false;
  }
  function isHighAttack(o) {
    if (o.state !== 'atk' || !o.mv) return false;
    var hits = o.moves[o.mv].hits;
    for (var i = 0; i < hits.length; i++) if (hits[i].level === 'high') return true;
    return o.y > 0;   // 跳入攻击必须站防
  }

  // 搓招宏：每个元素是一帧的按键掩码
  function motionMasks(fwd, which, btn, back) {
    if (which === '236') return [BIT.DOWN, BIT.DOWN, BIT.DOWN | fwd, BIT.DOWN | fwd, fwd, fwd | btn];
    if (which === '214') return [BIT.DOWN, BIT.DOWN, BIT.DOWN | back, BIT.DOWN | back, back, back | btn];
    if (which === '66') return [fwd, fwd, 0, 0, fwd, fwd];
    if (which === '44') return [back, back, 0, 0, back, back];
    return [fwd, fwd, BIT.DOWN, BIT.DOWN, BIT.DOWN | fwd, BIT.DOWN | fwd | btn];
  }

  // 每次对方开始新动作只掷一次骰子，同一动作内答复不变；动作开始 react 帧后才生效，模拟反应时间
  function attackAnswer(m, opp, st, chance, react) {
    if (opp.state !== 'atk') return false;
    if (st.serial !== opp.serial) {
      st.serial = opp.serial;
      st.act = FG.nextRand(m) < chance;
    }
    return st.act && opp.mf >= (react === undefined ? 3 : react);
  }

  function newAI(level) {
    var lv = level || 2;
    var L = LEVELS[lv] || LEVELS[2];
    return {
      level: lv, L: L, queue: [], think: 0, hold: 0, serial: -1, act: false, blockChance: L.block,
      confirmSerial: -1, gcSerial: -1, techDone: false, antiSerial: -1
    };
  }

  // 命中确认后接的必杀：优先超杀（能量够时），否则选该角色的取消目标
  function confirmCombo(m, me, ai, fwd, back) {
    var cancels = me.moves[me.mv].cancels;
    if (cancels.indexOf('236C') >= 0 && me.power >= FG.SUPER_COST && FG.nextRand(m) < 0.5) return motionMasks(fwd, '236', BIT.C);
    var pool = [];
    if (cancels.indexOf('214D') >= 0) pool.push(motionMasks(fwd, '214', BIT.D, back));
    if (cancels.indexOf('236A') >= 0) pool.push(motionMasks(fwd, '236', BIT.A));
    if (cancels.indexOf('623B') >= 0) pool.push(motionMasks(fwd, '623', BIT.B));
    if (!pool.length) return null;
    return pool[Math.floor(FG.nextRand(m) * pool.length)];
  }

  function cpuDecide(m, me, opp, ai) {
    var L = ai.L || LEVELS[2];
    var fwd = fwdOf(me), back = backOf(me);
    var dist = Math.abs(opp.x - me.x) / FG.SUB;

    // 倒地：按难度决定是否受身（每次倒地掷一次）
    if (me.state === 'down') {
      ai.queue = [];
      if (!ai.techDone) { ai.techDone = true; ai.techGo = FG.nextRand(m) < L.tech; }
      return ai.techGo && FG.DOWN_FRAMES - me.downLeft >= 2 ? BIT.A : 0;
    }
    ai.techDone = false;

    // 防御中：可能发动防御反击（每次被压制掷一次）
    if (me.state === 'stun' && me.blocked) {
      if (ai.gcSerial !== opp.serial) {
        ai.gcSerial = opp.serial;
        ai.gcGo = me.power >= FG.GC_COST && FG.nextRand(m) < L.gc;
      }
      if (ai.gcGo) { ai.gcGo = false; ai.queue = []; return BIT.C | BIT.D; }
      return back | (isLowAttack(opp) ? BIT.DOWN : 0);
    }

    // 确认连段：自己的普通技打中且对手在硬直中，立刻搓必杀取消
    if (L.confirm && me.state === 'atk' && me.connected && opp.state === 'stun' && !opp.blocked &&
        ai.confirmSerial !== me.serial && !ai.queue.length) {
      ai.confirmSerial = me.serial;
      if (me.mv.length === 2 && me.mv !== 'TH' && me.mv !== 'GC' && FG.nextRand(m) < L.confirm) {
        var q = confirmCombo(m, me, ai, fwd, back);
        if (q) { ai.queue = q; return ai.queue.shift(); }
      }
    }

    // 对空：对手跳过来时升龙
    if (L.anti && opp.state === 'air' && dist < 170 && me.state !== 'atk' && ai.antiSerial !== opp.serial + ':' + m.round &&
        (opp.vx * me.facing < 0 || dist < 100)) {
      ai.antiSerial = opp.serial + ':' + m.round;
      if (FG.nextRand(m) < L.anti) { ai.queue = motionMasks(fwd, '623', BIT.B); return ai.queue.shift(); }
    }

    // 反应式防守：对方每出一招判定一次，判定通过则打断自己的动作后退防御（低段则蹲防，高段 / 跳入则站防）
    if (dist < 170 && attackAnswer(m, opp, ai, ai.blockChance, L.react)) {
      ai.queue = [];
      return back | (isLowAttack(opp) && !isHighAttack(opp) ? BIT.DOWN : 0);
    }
    if (ai.queue.length) return ai.queue.shift();
    if (ai.think > 0) { ai.think--; return ai.hold; }
    ai.think = L.think[0] + Math.floor(FG.nextRand(m) * (L.think[1] - L.think[0]));

    // 远距离：靠近（会冲刺）
    if (dist > 150) {
      if (dist > 220 && FG.nextRand(m) < L.dash) { ai.queue = motionMasks(fwd, '66'); ai.hold = fwd; return ai.queue.shift(); }
      ai.hold = fwd;
      return fwd;
    }

    var r = FG.nextRand(m);
    // 投技：对手在地面没动作或在防御时，走到身边再投
    if (opp.y === 0 && (opp.state === 'stand' || opp.state === 'crouch') && r < L.throwP * (opp.holdBack ? 1.6 : 1)) {
      var walk = Math.max(0, Math.ceil((dist - 74) / (me.walkF / FG.SUB)));
      ai.queue = [];
      for (var w = 0; w < Math.min(walk, 40); w++) ai.queue.push(fwd);
      ai.queue.push(BIT.B | BIT.D);
      ai.hold = 0;
      return ai.queue.shift();
    }
    // 择上下段：对手蹲防则打中段 / 高段，对手站防则打下段
    if (L.mix && opp.holdBack && FG.nextRand(m) < L.mix) {
      if (opp.stance === 'crouch') {
        if (me.fid === 'frog') ai.queue = motionMasks(fwd, '214', BIT.B, back);
        else ai.queue = [BIT.UP | fwd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, BIT.C];
      } else {
        ai.queue = FG.nextRand(m) < 0.5 ? [BIT.DOWN | BIT.C] : (me.fid === 'roo' ? motionMasks(fwd, '214', BIT.B, back) : [BIT.DOWN | BIT.D]);
      }
      return ai.queue.shift();
    }
    // 后撤拉开
    if (L.dash && dist < 90 && r < 0.08 * L.dash * 4) { ai.queue = motionMasks(fwd, '44'); ai.hold = 0; return ai.queue.shift(); }

    // 其余行为按权重抽取（总和归一，难度只改变必杀的相对权重）
    var sp = L.special;
    var opts = [
      ['idle', 0.18], ['crouch', 0.12], ['back', 0.1], ['jump', 0.08],
      ['236C', me.power >= FG.SUPER_COST ? 0.06 * sp : 0], ['236A', 0.08 * sp], ['623B', 0.04 * sp],
      ['214B', 0.04 * sp], ['214D', 0.04 * sp], ['normal', 0.32]
    ];
    var sum = 0, i;
    for (i = 0; i < opts.length; i++) sum += opts[i][1];
    r = FG.nextRand(m) * sum;
    var pick = 'normal';
    for (i = 0; i < opts.length; i++) { r -= opts[i][1]; if (r < 0) { pick = opts[i][0]; break; } }
    if (pick === 'idle') ai.hold = 0;
    else if (pick === 'crouch') ai.hold = BIT.DOWN;
    else if (pick === 'back') ai.hold = back;
    else if (pick === 'jump') { ai.queue = [BIT.UP | fwd]; return ai.queue.shift(); }
    else if (pick === '236C') { ai.queue = motionMasks(fwd, '236', BIT.C); return ai.queue.shift(); }
    else if (pick === '236A') { ai.queue = motionMasks(fwd, '236', BIT.A); return ai.queue.shift(); }
    else if (pick === '623B') { ai.queue = motionMasks(fwd, '623', BIT.B); return ai.queue.shift(); }
    else if (pick === '214B') { ai.queue = motionMasks(fwd, '214', BIT.B, back); return ai.queue.shift(); }
    else if (pick === '214D') { ai.queue = motionMasks(fwd, '214', BIT.D, back); return ai.queue.shift(); }
    else {
      // 普通技：困难会先走近再出手，保证能打中从而确认连段
      var btns = [BIT.A, BIT.B, BIT.C, BIT.D];
      var b = btns[Math.floor(FG.nextRand(m) * 4)] | (FG.nextRand(m) < 0.35 ? BIT.DOWN : 0);
      ai.queue = [];
      if (ai.level >= 3 && dist > 110) for (var k = 0; k < Math.min(30, Math.ceil((dist - 100) / (me.walkF / FG.SUB))); k++) ai.queue.push(fwd);
      ai.queue.push(b);
      return ai.queue.shift();
    }
    return ai.hold;
  }

  function dummyDecide(m, me, opp, mode, st) {
    var blockBits = backOf(me) | (isLowAttack(opp) ? BIT.DOWN : 0);
    if (mode === 'auto') return opp.state === 'atk' ? blockBits : 0;
    if (mode === 'random') return attackAnswer(m, opp, st, 0.5) ? blockBits : 0;
    if (mode === 'crouch') return BIT.DOWN;
    return 0;
  }

  FG.ai = {
    newAI: newAI,
    cpuDecide: cpuDecide,
    dummyDecide: dummyDecide,
    motionMasks: motionMasks,
    DUMMY_MODES: DUMMY_MODES,
    DUMMY_NAMES: DUMMY_NAMES,
    LEVELS: LEVELS,
    LEVEL_NAMES: LEVEL_NAMES
  };
})();
