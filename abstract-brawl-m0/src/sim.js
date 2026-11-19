/* 战斗模拟：纯逻辑，不依赖 DOM。step(match, [mask1, mask2]) 推进一帧。
 * 约定：位置/速度用整数子单位（1px = 100）；招式帧从 1 开始；
 * 指令在 mf=0 的帧按下，下一帧 mf=1。输入缓冲与搓招识别都基于按键历史。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var BIT = FG.BIT;
  var px = FG.px;
  var WALL = px(FG.WALL);
  var MIN_DIST = px(FG.PUSH_MIN);
  var GRAV = px(FG.GRAVITY);
  var M236 = FG.MOTIONS['236'];
  var M623 = FG.MOTIONS['623'];
  var M214 = FG.MOTIONS['214'];

  function makePlayer(idx, fid) {
    var f = FG.FIGHTERS[fid];
    return {
      idx: idx, fid: fid, name: f.name,
      moves: FG.MOVESETS[fid], hurt: f.hurtS,
      walkF: px(f.walkF), walkB: px(f.walkB),
      jumpV: px(f.jumpV), jumpFwd: px(f.jumpFwd), jumpBack: px(f.jumpBack),
      dmgMul: f.dmgMul, maxHealth: f.health,
      health: f.health, power: 0,
      x: 0, y: 0, vx: 0, vy: 0, pushV: 0,
      facing: idx === 0 ? 1 : -1,
      state: 'stand', stance: 'stand',
      mv: null, mf: 0, connected: false, hitDone: [],
      stunLeft: 0, blocked: false, kdPending: false, downLeft: 0,
      input: 0, prevBtn: 0, holdFwd: false, holdBack: false, holdDown: false,
      hist: [], pend: null, serial: 0,
      hitCount: 0, comboBy: -1,
      lastMove: null, lastResult: null,
      // 阶段二：按键时间（A B C D 最近一次按下的帧）、方向轻点、前冲/后撤、受身
      pressF: [-99, -99, -99, -99], prevD: 5, lastTap: [-99, -99], dashReq: 0, dashReqF: -99,
      dashT: 0, teched: false
    };
  }

  function resetPlayer(p, startX, facing) {
    p.health = p.maxHealth;
    p.power = 0;
    p.x = px(startX); p.y = 0; p.vx = 0; p.vy = 0; p.pushV = 0;
    p.facing = facing;
    p.state = 'stand'; p.stance = 'stand';
    p.mv = null; p.mf = 0; p.connected = false; p.hitDone = [];
    p.stunLeft = 0; p.blocked = false; p.kdPending = false; p.downLeft = 0;
    p.input = 0; p.holdFwd = false; p.holdBack = false; p.holdDown = false;
    p.hist = []; p.pend = null;
    p.hitCount = 0; p.comboBy = -1;
    p.lastMove = null; p.lastResult = null;
    p.pressF = [-99, -99, -99, -99]; p.prevD = 5; p.lastTap = [-99, -99]; p.dashReq = 0; p.dashReqF = -99;
    p.dashT = 0; p.teched = false;
  }

  function resetRound(m) {
    resetPlayer(m.p[0], -180, 1);
    resetPlayer(m.p[1], 180, -1);
    m.proj = [];
    m.timer = FG.ROUND_FRAMES;
    m.hitstop = 0;
    m.freeze = 0;
    m.freezeBy = -1;
    m.winner = -1;
    if (m.mode === 'training') { m.phase = 'fight'; m.phaseT = 0; }
    else { m.phase = 'intro'; m.phaseT = FG.INTRO_FRAMES + (m.round === 1 ? FG.VS_FRAMES : 0); }
  }

  function createMatch(opts) {
    opts = opts || {};
    var m = {
      mode: opts.mode || 'cpu',
      seed: (opts.seed === undefined ? 20261020 : opts.seed) >>> 0,
      frame: 0,
      phase: 'intro', phaseT: FG.INTRO_FRAMES,
      round: 1, wins: [0, 0], maxWins: opts.maxWins || 2,
      timer: FG.ROUND_FRAMES, hitstop: 0, freeze: 0, freezeBy: -1,
      winner: -1, matchWinner: -1,
      infinite: false,
      proj: [], events: [],
      p: [makePlayer(0, opts.fid0 || 'frog'), makePlayer(1, opts.fid1 || 'roo')]
    };
    if (opts.name0) m.p[0].name = opts.name0;
    if (opts.name1) m.p[1].name = opts.name1;
    resetRound(m);
    return m;
  }

  function isActionable(p) {
    return p.state === 'stand' || p.state === 'crouch' || p.state === 'air';
  }

  function faceOpponent(p, o) {
    if (p.x < o.x) p.facing = 1;
    else if (p.x > o.x) p.facing = -1;
  }

  function recordInput(m, p, mask) {
    p.input = mask;
    var fwdBit = p.facing === 1 ? BIT.RIGHT : BIT.LEFT;
    var backBit = p.facing === 1 ? BIT.LEFT : BIT.RIGHT;
    p.holdFwd = (mask & fwdBit) !== 0;
    p.holdBack = (mask & backBit) !== 0;
    p.holdDown = (mask & BIT.DOWN) !== 0;
    var d = FG.numpad((mask & BIT.UP) !== 0, p.holdDown, p.holdFwd, p.holdBack);
    p.hist.push({ d: d, f: m.frame });
    if (p.hist.length > 48) p.hist.shift();
    // 66 / 44：从中立轻点前（后）两次。要求上一方向是 5，避免 236 / 214 的收尾被当成轻点
    if (d !== p.prevD) {
      if ((d === 6 || d === 4) && p.prevD === 5) {
        var k = d === 6 ? 0 : 1;
        if (m.frame - p.lastTap[k] <= FG.DASH_WINDOW) { p.dashReq = d; p.dashReqF = m.frame; p.lastTap[k] = -99; }
        else p.lastTap[k] = m.frame;
      }
      p.prevD = d;
    }
    var btn = mask & FG.BTN_MASK;
    var pressed = btn & ~p.prevBtn;
    p.prevBtn = btn;
    for (var b = 0; b < 4; b++) if (pressed & (BIT.A << b)) p.pressF[b] = m.frame;
    if (pressed) {
      // 尚未被消耗的输入在容差内合并，方便两键同按（投技 B+D、防御反击 C+D）
      if (p.pend && m.frame - p.pend.f <= FG.PAIR_WINDOW) { p.pend.mask |= pressed; p.pend.exp = m.frame + FG.BUFFER; }
      else p.pend = { mask: pressed, f: m.frame, exp: m.frame + FG.BUFFER };
    }
  }

  // 两个按键是否在容差内都按下过（以 pend.f 为参照）
  function pairPressed(p, pend, b1, b2) {
    var i1 = b1 === BIT.A ? 0 : (b1 === BIT.B ? 1 : (b1 === BIT.C ? 2 : 3));
    var i2 = b2 === BIT.A ? 0 : (b2 === BIT.B ? 1 : (b2 === BIT.C ? 2 : 3));
    if (!(pend.mask & (b1 | b2))) return false;
    return Math.abs(p.pressF[i1] - pend.f) <= FG.PAIR_WINDOW && Math.abs(p.pressF[i2] - pend.f) <= FG.PAIR_WINDOW &&
      Math.abs(p.pressF[i1] - p.pressF[i2]) <= FG.PAIR_WINDOW;
  }

  // 搓招识别：pattern 为数字键盘序列（相对朝向），末尾方向必须在按键前 6 帧内出现
  function motionOk(p, pend, pattern) {
    var seq = [];
    var h = p.hist;
    for (var i = 0; i < h.length; i++) {
      var e = h[i];
      if (e.f > pend.f || e.f < pend.f - FG.MOTION_WINDOW || e.d === 5) continue;
      var last = seq[seq.length - 1];
      if (last && last.d === e.d) last.f = e.f;
      else seq.push({ d: e.d, f: e.f });
    }
    var n = pattern.length;
    for (var s = seq.length - 1; s >= 0; s--) {
      if (seq[s].d !== pattern[n - 1]) continue;
      if (pend.f - seq[s].f > 6) return false;
      var j = n - 2;
      for (var k = s - 1; k >= 0 && j >= 0; k--) {
        if (seq[k].d === pattern[j]) j--;
      }
      return j < 0;
    }
    return false;
  }

  function resolveCommand(p, pend, stance, state) {
    var mask = pend.mask;
    if (state !== 'air') {
      if ((mask & BIT.A) && motionOk(p, pend, M236)) return '236A';
      if ((mask & BIT.C) && p.power >= FG.SUPER_COST && motionOk(p, pend, M236)) return '236C';
      if ((mask & BIT.B) && motionOk(p, pend, M623)) return '623B';
      if ((mask & BIT.B) && p.moves['214B'] && motionOk(p, pend, M214)) return '214B';
      if ((mask & BIT.D) && p.moves['214D'] && motionOk(p, pend, M214)) return '214D';
      if (pairPressed(p, pend, BIT.B, BIT.D)) return 'TH';
    }
    var letter = '';
    for (var i = 0; i < 4; i++) {
      if (mask & (BIT.A << i)) { letter = FG.BTNS[i]; break; }
    }
    if (!letter) return null;
    if (state === 'air') return (letter === 'A' || letter === 'B') ? 'jA' : 'jC';
    return (stance === 'crouch' ? '2' : '5') + letter;
  }

  function startMove(m, p, id) {
    var mv = p.moves[id];
    var wasAir = p.state === 'air';
    if (mv.cost) p.power -= mv.cost;
    p.state = 'atk';
    p.serial++;
    p.mv = id; p.mf = 0; p.connected = false;
    p.hitDone = [];
    for (var k = 0; k < mv.hits.length; k++) p.hitDone.push(false);
    p.stance = mv.airOnly ? 'air' : mv.stance;
    p.lastMove = id; p.lastResult = null;
    p.blocked = false; p.stunLeft = 0; p.pushV = 0;
    if (!wasAir) p.vx = 0;
    m.events.push({ type: 'move', p: p.idx, id: id });
    if (mv.superFx) {
      // 超杀发动：全场定格，只有画面演出在动（逻辑仍逐帧确定）
      m.freeze = FG.SUPER_FREEZE;
      m.freezeBy = p.idx;
      m.events.push({ type: 'super', p: p.idx, id: id });
    }
  }

  function endMove(p) {
    p.mv = null; p.mf = 0; p.connected = false; p.hitDone = [];
    if (p.y > 0) { p.state = 'air'; p.stance = 'air'; }
    else { p.state = 'stand'; p.stance = 'stand'; p.vx = 0; }
  }

  function spawnProjectile(m, p, mv) {
    var pr = mv.proj;
    m.proj.push({
      owner: p.idx,
      x: p.x + p.facing * pr.ox,
      y: pr.oy,
      vx: p.facing * pr.speed,
      w: pr.w, h: pr.h,
      life: pr.life,
      dmg: pr.dmg, hitstun: pr.hitstun, blockstun: pr.blockstun, hitstop: pr.hitstop,
      push: pr.push, level: pr.level,
      alive: true
    });
  }

  function tickState(m, p, o) {
    if (p.state === 'stun') {
      p.x += p.pushV;
      if (p.stunLeft <= 0) {
        p.pushV = 0;
        p.blocked = false;
        o.hitCount = 0;
        if (p.kdPending) {
          p.kdPending = false;
          p.state = 'down'; p.stance = 'stand'; p.downLeft = FG.DOWN_FRAMES; p.teched = false; p.vx = 0;
        } else {
          if (p.y > 0) { p.state = 'air'; p.stance = 'air'; } else if (p.stance === 'crouch') { p.state = 'crouch'; } else { p.state = 'stand'; p.stance = 'stand'; }
        }
      } else {
        // 硬直共 stunLeft 帧，之后下一帧恢复行动（与帧数据口径一致）
        p.stunLeft--;
        // 硬直期间姿态跟随输入：蹲住则为蹲姿（判定框与防御高低随之变化）
        p.stance = p.y > 0 ? 'air' : (p.holdDown ? 'crouch' : 'stand');
      }
    } else if (p.state === 'down') {
      if (--p.downLeft <= 0) { p.state = 'stand'; p.vx = 0; p.teched = false; }
    } else if (p.state === 'dash') {
      p.dashT++;
      p.vx = p.facing * px(FG.DASH_SPEED);
      if (p.dashT >= FG.DASH_FRAMES) { p.state = 'stand'; p.vx = 0; }
    } else if (p.state === 'bdash') {
      p.dashT++;
      p.vx = p.dashT <= 14 ? -p.facing * px(FG.BDASH_SPEED) : 0;
      if (p.dashT >= FG.BDASH_FRAMES) { p.state = 'stand'; p.vx = 0; }
    } else if (p.state === 'atk') {
      var mv = p.moves[p.mv];
      p.mf++;
      if (mv.thr && p.mf === mv.thr.f) tryThrow(m, p, o);
      if (mv.vel && p.mf === mv.vel.f) p.vy = mv.vel.vy;
      if (mv.proj && p.mf === mv.proj.f) spawnProjectile(m, p, mv);
      if (mv.lunge && p.mf >= mv.lunge.f1 && p.mf <= mv.lunge.f2) p.vx = p.facing * mv.lunge.vx;
      else if (p.y === 0 && p.vy === 0) p.vx = 0;
      if (p.mf > mv.frames) endMove(p);
    }
  }

  function actOnInput(m, p) {
    if (p.pend && m.frame > p.pend.exp) p.pend = null;
    if (p.dashReq && m.frame - p.dashReqF > 4) p.dashReq = 0;
    // 受身：倒地后 TECH_WINDOW 帧内按任意键，向后翻滚快速起身（每次倒地限一次）
    if (p.state === 'down' && p.pend && !p.teched && FG.DOWN_FRAMES - p.downLeft <= FG.TECH_WINDOW && p.downLeft > FG.TECH_RISE) {
      p.pend = null;
      p.teched = true;
      p.downLeft = FG.TECH_RISE;
      p.vx = -p.facing * px(FG.TECH_ROLL);
      m.events.push({ type: 'tech', p: p.idx, x: p.x });
      return;
    }
    // 防御反击：防御硬直中同按 C+D，消耗半格能量
    if (p.state === 'stun' && p.blocked && p.y === 0 && p.pend && p.power >= FG.GC_COST && pairPressed(p, p.pend, BIT.C, BIT.D)) {
      p.pend = null;
      startMove(m, p, 'GC');
      m.events.push({ type: 'gc', p: p.idx, x: p.x });
      return;
    }
    var inAtk = p.state === 'atk';
    // 空投：重拳 / 重脚刚出手 2 帧内补按另一键，改成投技（两键按得不齐也能出投）
    if (inAtk && p.pend && p.mf <= 2 && /^[52][BD]$/.test(p.mv) && pairPressed(p, p.pend, BIT.B, BIT.D)) {
      p.pend = null;
      startMove(m, p, 'TH');
      return;
    }
    var canCancel = inAtk && p.connected;
    var inDash = p.state === 'dash';
    if (!isActionable(p) && !canCancel && !inDash) return;

    if (p.pend) {
      var stance = inAtk ? p.moves[p.mv].stance : (p.holdDown && !inDash ? 'crouch' : 'stand');
      var cmd = resolveCommand(p, p.pend, stance, inDash ? 'stand' : p.state);
      if (cmd && (!canCancel || p.moves[p.mv].cancels.indexOf(cmd) >= 0)) {
        p.pend = null;
        startMove(m, p, cmd);
        return;
      }
    }
    if (inAtk || p.state === 'air' || inDash) return;

    if (p.dashReq && (p.state === 'stand' || p.state === 'crouch')) {
      var fwd = p.dashReq === 6;
      p.dashReq = 0;
      p.state = fwd ? 'dash' : 'bdash'; p.stance = 'stand'; p.dashT = 0;
      m.events.push({ type: fwd ? 'dash' : 'bdash', p: p.idx, x: p.x });
      return;
    }

    if ((p.state === 'stand' || p.state === 'crouch') && (p.input & BIT.UP) && !p.holdDown) {
      p.state = 'air'; p.stance = 'air';
      p.vy = p.jumpV;
      m.events.push({ type: 'jump', p: p.idx, x: p.x });
      p.vx = p.holdFwd ? p.facing * p.jumpFwd : (p.holdBack ? -p.facing * p.jumpBack : 0);
      return;
    }
    if (p.holdDown) { p.state = 'crouch'; p.stance = 'crouch'; p.vx = 0; return; }
    p.state = 'stand'; p.stance = 'stand';
    p.vx = p.holdFwd ? p.facing * p.walkF : (p.holdBack ? -p.facing * p.walkB : 0);
  }

  function physics(m, p) {
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= GRAV;
      p.y += p.vy;
      if (p.y <= 0) {
        p.y = 0; p.vy = 0;
        m.events.push({ type: 'land', p: p.idx, x: p.x });
        if (p.state === 'air') { p.state = 'stand'; p.stance = 'stand'; p.vx = 0; }
        else if (p.state === 'atk' && p.mv && p.moves[p.mv].airOnly) endMove(p);
      }
    }
    if (p.vx !== 0) p.x += p.vx;
    if (p.x > WALL) p.x = WALL;
    else if (p.x < -WALL) p.x = -WALL;
  }

  function pushApart(a, b) {
    if (a.y > 0 && b.y > 0) return;
    var d = b.x - a.x;
    var ad = Math.abs(d);
    if (ad >= MIN_DIST) return;
    var over = MIN_DIST - ad;
    var s = d >= 0 ? 1 : -1;
    var half = Math.floor(over / 2);
    a.x -= s * half;
    b.x += s * (over - half);
    a.x = FG.clamp(a.x, -WALL, WALL);
    b.x = FG.clamp(b.x, -WALL, WALL);
  }

  function worldBox(p, b) {
    var x1, x2;
    if (p.facing === 1) { x1 = p.x + b[0]; x2 = p.x + b[2]; }
    else { x1 = p.x - b[2]; x2 = p.x - b[0]; }
    return [x1, p.y + b[1], x2, p.y + b[3]];
  }

  function hurtRect(d) {
    if (d.state === 'down') return null;
    if (d.state === 'bdash' && d.dashT <= FG.BDASH_INVUL) return null;
    if (d.state === 'atk' && d.mv) {
      var iv = d.moves[d.mv].invul;
      if (iv && d.mf >= iv[0] && d.mf <= iv[1]) return null;
    }
    return worldBox(d, d.hurt[d.stance]);
  }

  function overlap(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  }

  // 防御规则：必须按住后方；高段只能站防，低段只能蹲防，中段都可以
  function canBlock(d, level) {
    if (level === 'throw') return false;
    if (!d.holdBack) return false;
    var okState = d.state === 'stand' || d.state === 'crouch' || (d.state === 'stun' && d.blocked);
    if (!okState) return false;
    var crouching = d.stance === 'crouch';
    if (level === 'high') return !crouching;
    if (level === 'low') return crouching;
    return true;
  }

  function applyHit(m, att, def, h, isProj) {
    var dmg = Math.max(1, Math.round(h.dmg * att.dmgMul));
    var blocked = canBlock(def, h.level);
    var stunTime = Math.max(1, blocked ? h.blockstun : h.hitstun);
    var ex = Math.round((att.x + def.x) / 2);
    var ey = def.y + px(80);
    if (blocked) {
      if (!m.infinite) def.health = Math.max(0, def.health - Math.max(1, Math.round(dmg / 10)));
      att.power = Math.min(FG.POWER_MAX, att.power + 10);
      def.power = Math.min(FG.POWER_MAX, def.power + 5);
      att.lastResult = 'block';
      m.events.push({ type: 'block', x: ex, y: ey, att: att.idx, def: def.idx, dmg: dmg, proj: !!isProj });
    } else {
      if (!m.infinite) def.health = Math.max(0, def.health - dmg);
      att.power = Math.min(FG.POWER_MAX, att.power + 20);
      def.power = Math.min(FG.POWER_MAX, def.power + 10);
      att.hitCount++;
      def.comboBy = att.idx;
      att.lastResult = 'hit';
      m.events.push({ type: 'hit', x: ex, y: ey, dmg: dmg, proj: !!isProj, att: att.idx, def: def.idx,
        kd: !!h.kd, combo: att.hitCount, heavy: h.hitstop >= 9 });
    }
    def.state = 'stun';
    def.blocked = blocked;
    def.stunLeft = stunTime;
    def.kdPending = !blocked && !!h.kd;
    def.mv = null; def.mf = 0; def.connected = false; def.hitDone = [];
    def.vx = 0;
    def.pushV = Math.round(att.facing * h.push / stunTime);
    m.hitstop = Math.max(m.hitstop, h.hitstop);
  }

  // 投技判定：距离够近、双方在地面、对手可被打到（非无敌 / 非倒地）且不在硬直中
  function tryThrow(m, p, o) {
    var T = p.moves[p.mv].thr;
    var near = Math.abs(o.x - p.x) <= T.range;
    var grounded = p.y === 0 && o.y === 0;
    var free = o.state === 'stand' || o.state === 'crouch' || o.state === 'dash' ||
      (o.state === 'atk' && !o.moves[o.mv].airOnly);
    if (!near || !grounded || !free || !hurtRect(o)) {
      m.events.push({ type: 'whiff', p: p.idx, id: p.mv });
      return;
    }
    // 拆投：对手也在出投技的前几帧，或刚在容差内同按了 B+D
    var clash = o.state === 'atk' && o.mv === 'TH' && o.mf <= T.f;
    var teched = clash || (o.pend && m.frame - o.pend.f <= FG.THROW_BREAK && pairPressed(o, o.pend, BIT.B, BIT.D));
    if (teched) {
      [p, o].forEach(function (q, k) {
        q.mv = null; q.mf = 0; q.connected = false; q.hitDone = []; q.pend = null;
        q.state = 'stun'; q.blocked = true; q.stunLeft = 14; q.kdPending = false; q.vx = 0;
        var away = k === 0 ? -p.facing : p.facing;
        q.pushV = Math.round(away * px(70) / 14);
      });
      m.hitstop = Math.max(m.hitstop, 8);
      m.events.push({ type: 'throwbreak', p: p.idx, x: Math.round((p.x + o.x) / 2) });
      return;
    }
    p.connected = true;
    applyHit(m, p, o, { dmg: T.dmg, hitstun: 18, blockstun: 0, hitstop: 10, push: px(90), level: 'throw', kd: true }, false);
    m.events.push({ type: 'throw', p: p.idx, x: o.x });
  }

  function stepProjectiles(m) {
    var list = m.proj;
    for (var i = 0; i < list.length; i++) {
      var pr = list[i];
      if (!pr.alive) continue;
      pr.x += pr.vx;
      pr.life--;
      if (pr.life <= 0 || Math.abs(pr.x) > px(FG.WALL + 200)) { pr.alive = false; continue; }
      var att = m.p[pr.owner], def = m.p[1 - pr.owner];
      var hr = hurtRect(def);
      if (!hr) continue;
      var hw = Math.floor(pr.w / 2), hh = Math.floor(pr.h / 2);
      if (overlap([pr.x - hw, pr.y - hh, pr.x + hw, pr.y + hh], hr)) {
        pr.alive = false;
        applyHit(m, att, def, pr, true);
      }
    }
    m.proj = list.filter(function (q) { return q.alive; });
  }

  // 两人同帧的命中先全部判定，再统一结算（保证交换对打时结果对称）
  function checkHits(m) {
    var found = [];
    for (var i = 0; i < 2; i++) {
      var a = m.p[i], d = m.p[1 - i];
      if (a.state !== 'atk' || !a.mv) continue;
      var hr = hurtRect(d);
      if (!hr) continue;
      var hits = a.moves[a.mv].hits;
      for (var k = 0; k < hits.length; k++) {
        var h = hits[k];
        if (a.hitDone[k] || a.mf < h.f1 || a.mf > h.f2) continue;
        if (overlap(worldBox(a, h.box), hr)) {
          a.hitDone[k] = true;
          a.connected = true;
          found.push({ a: a, d: d, h: h });
          break;
        }
      }
    }
    for (var j = 0; j < found.length; j++) applyHit(m, found[j].a, found[j].d, found[j].h, false);
  }

  function checkRoundEnd(m) {
    var p0 = m.p[0], p1 = m.p[1];
    if (m.mode === 'training') {
      if (p0.health <= 0) p0.health = p0.maxHealth;
      if (p1.health <= 0) p1.health = p1.maxHealth;
      return;
    }
    var w;
    if (p0.health <= 0 || p1.health <= 0) {
      w = (p0.health <= 0 && p1.health <= 0) ? -2 : (p0.health > 0 ? 0 : 1);
    } else if (m.timer <= 0) {
      w = p0.health === p1.health ? -2 : (p0.health > p1.health ? 0 : 1);
    } else {
      return;
    }
    m.winner = w;
    m.phase = 'ko';
    m.phaseT = FG.KO_FRAMES;
    m.hitstop = 0;
    m.events.push({ type: 'ko', winner: w, perfect: (w === 0 || w === 1) && m.p[w].health === m.p[w].maxHealth });
    for (var i = 0; i < 2; i++) {
      var p = m.p[i];
      p.vx = 0; p.pushV = 0; p.pend = null;
      p.mv = null; p.mf = 0; p.connected = false; p.hitDone = [];
      if (p.health <= 0) {
        p.state = 'down'; p.stance = 'stand'; p.kdPending = false; p.downLeft = 999999;
      } else {
        p.state = p.y > 0 ? 'air' : 'stand';
        p.stance = p.state === 'air' ? 'air' : 'stand';
        p.stunLeft = 0; p.blocked = false;
      }
    }
  }

  function endRound(m) {
    if (m.winner === 0 || m.winner === 1) m.wins[m.winner]++;
    if (m.wins[0] >= m.maxWins || m.wins[1] >= m.maxWins) {
      m.matchWinner = m.wins[0] > m.wins[1] ? 0 : 1;
      m.phase = 'matchEnd';
      return;
    }
    m.round++;
    resetRound(m);
  }

  function step(m, inputs) {
    m.events = [];
    m.frame++;
    var p = m.p;
    recordInput(m, p[0], inputs[0] | 0);
    recordInput(m, p[1], inputs[1] | 0);

    if (m.phase === 'intro') {
      m.phaseT--;
      if (m.phaseT <= 0) { m.phase = 'fight'; m.events.push({ type: 'fight' }); }
      return m;
    }
    if (m.phase === 'ko') {
      physics(m, p[0]);
      physics(m, p[1]);
      m.phaseT--;
      if (m.phaseT <= 0) endRound(m);
      return m;
    }
    if (m.phase !== 'fight') return m;
    if (m.freeze > 0) { m.freeze--; return m; }
    if (m.hitstop > 0) { m.hitstop--; return m; }
    if (m.mode !== 'training') m.timer--;

    for (var i = 0; i < 2; i++) if (isActionable(p[i])) faceOpponent(p[i], p[1 - i]);
    tickState(m, p[0], p[1]);
    tickState(m, p[1], p[0]);
    actOnInput(m, p[0]);
    actOnInput(m, p[1]);
    physics(m, p[0]);
    physics(m, p[1]);
    pushApart(p[0], p[1]);
    stepProjectiles(m);
    checkHits(m);
    checkRoundEnd(m);
    return m;
  }

  function key(m) {
    var s = [m.frame, m.phase, m.timer, m.hitstop, m.freeze, m.seed, m.wins.join('-'), m.proj.length];
    for (var i = 0; i < 2; i++) {
      var p = m.p[i];
      s.push(p.x, p.y, p.vx, p.vy, p.state, p.stance, p.mv, p.mf, p.health, p.power,
        p.stunLeft, p.facing, p.pushV, p.blocked ? 1 : 0, p.dashT, p.downLeft, p.teched ? 1 : 0, p.pressF.join('/'));
    }
    m.proj.forEach(function (q) { s.push(q.x, q.y, q.vx, q.life); });
    return s.join(',');
  }

  FG.sim = {
    createMatch: createMatch,
    resetRound: resetRound,
    step: step,
    worldBox: worldBox,
    hurtRect: hurtRect,
    canBlock: canBlock,
    key: key
  };
})();
