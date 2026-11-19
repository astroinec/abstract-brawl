/* 自动化测试：在浏览器中运行，结果写入 window.__RESULT__ 与页面 #out。 */
(function () {
  'use strict';
  var FG = window.FG, BIT = FG.BIT, px = FG.px, SUB = FG.SUB;
  var F = BIT.RIGHT, B = BIT.LEFT, DN = BIT.DOWN, UP = BIT.UP;
  var rows = [];
  var fails = 0;

  function ok(name, cond, extra) {
    var pass = !!cond;
    if (!pass) fails++;
    rows.push({ name: name, pass: pass, extra: extra === undefined ? '' : String(extra) });
  }
  function run(name, fn) {
    try { fn(); } catch (e) { ok(name + '（抛出异常）', false, e && e.stack ? e.stack.split('\n')[0] : e); }
  }
  // 1P 奶蛙（面向右）、2P 美团袋鼠（面向左）；跳过开场直接进入战斗
  function mk(f0, f1) {
    var m = FG.sim.createMatch({ mode: 'pvp', fid0: f0 || 'frog', fid1: f1 || 'roo', seed: 1 });
    m.phase = 'fight';
    m.phaseT = 0;
    return m;
  }
  function steps(m, n, a, b) {
    for (var i = 0; i < n; i++) {
      var ma = typeof a === 'function' ? a(i) : (a || 0);
      var mb = typeof b === 'function' ? b(i) : (b || 0);
      FG.sim.step(m, [ma, mb]);
    }
  }
  function seq(m, masks, p2) {
    for (var i = 0; i < masks.length; i++) FG.sim.step(m, [masks[i], p2 || 0]);
  }

  run('确定性', function () {
    var a = FG.sim.createMatch({ mode: 'pvp', seed: 7 });
    var b = FG.sim.createMatch({ mode: 'pvp', seed: 7 });
    var rnd = { seed: 99 };
    var dirs = [0, BIT.LEFT, BIT.RIGHT, BIT.DOWN, BIT.DOWN | BIT.LEFT, BIT.DOWN | BIT.RIGHT, BIT.UP, BIT.UP | BIT.RIGHT];
    var btns = [BIT.A, BIT.B, BIT.C, BIT.D];
    var same = true, at = -1, atk = 0;
    for (var i = 0; i < 1500 && same; i++) {
      var x = dirs[Math.floor(FG.nextRand(rnd) * dirs.length)];
      if (FG.nextRand(rnd) < 0.1) x |= btns[Math.floor(FG.nextRand(rnd) * 4)];
      var y = dirs[Math.floor(FG.nextRand(rnd) * dirs.length)];
      if (FG.nextRand(rnd) < 0.1) y |= btns[Math.floor(FG.nextRand(rnd) * 4)];
      FG.sim.step(a, [x, y]);
      FG.sim.step(b, [x, y]);
      if (a.p[0].state === 'atk' || a.p[1].state === 'atk') atk++;
      if (FG.sim.key(a) !== FG.sim.key(b)) { same = false; at = i; }
    }
    ok('同输入两次运行 1500 帧逐帧一致', same, same ? '' : '差异于第 ' + at + ' 步');
    ok('测试序列确实包含出招（非空转）', atk > 100, atk);
  });

  run('帧数据：5A 与 2C', function () {
    var mv = FG.MOVESETS.frog['5A'];
    ok('5A 启动5 / 持续2 / 后摇8 / 全长14（启动=第一判定帧序号）',
      mv.startup === 5 && mv.active === 2 && mv.recovery === 8 && mv.frames === 14,
      [mv.startup, mv.active, mv.recovery, mv.frames].join('/'));
    ok('帧数据自洽：启动+持续+后摇-1 = 全长', mv.startup + mv.active + mv.recovery - 1 === mv.frames);
    ok('5A 命中 +3 / 防御 0', mv.advHit === 3 && mv.advBlock === 0, mv.advHit + ' / ' + mv.advBlock);
    var c = FG.MOVESETS.frog['2C'];
    ok('2C 命中 +4 / 防御 +1', c.advHit === 4 && c.advBlock === 1, c.advHit + ' / ' + c.advBlock);
  });

  // 实测帧优势：攻击方出招后，双方各自回到可行动状态的帧差，应与面板显示的数值一致
  function measureAdv(cmd, defHold) {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-50);
    m.p[1].x = px(0);
    FG.sim.step(m, [cmd, 0]);
    var hit = -1, atkFree = -1, defFree = -1;
    for (var i = 1; i < 80 && (atkFree < 0 || defFree < 0); i++) {
      FG.sim.step(m, [0, defHold]);
      var a = m.p[0], d = m.p[1];
      if (hit < 0 && a.connected) hit = i;
      if (hit < 0) continue;
      if (atkFree < 0 && a.state !== 'atk') atkFree = i;
      if (defFree < 0 && (d.state === 'stand' || d.state === 'crouch' || d.state === 'air')) defFree = i;
    }
    return { connected: hit >= 0, adv: defFree - atkFree };
  }

  run('帧优势：实测与面板显示一致（5A/2C，命中与防御）', function () {
    var cases = [
      { mv: '5A', cmd: BIT.A, def: 0, kind: 'hit' },
      { mv: '5A', cmd: BIT.A, def: BIT.RIGHT, kind: 'block' },
      { mv: '2C', cmd: BIT.DOWN | BIT.C, def: 0, kind: 'hit' },
      { mv: '2C', cmd: BIT.DOWN | BIT.C, def: BIT.DOWN | BIT.RIGHT, kind: 'block' }
    ];
    cases.forEach(function (c) {
      var r = measureAdv(c.cmd, c.def);
      var mv = FG.MOVESETS.frog[c.mv];
      var shown = c.kind === 'hit' ? mv.advHit : mv.advBlock;
      ok(c.mv + ' ' + c.kind + '：实测 ' + r.adv + ' / 面板 ' + shown, r.connected && r.adv === shown, r.adv + ' vs ' + shown);
    });
  });

  run('搓招：236+A 舌鞭', function () {
    var m = mk('frog', 'roo');
    m.p[1].x = px(300);
    seq(m, [DN, DN | F, F, F | BIT.A]);
    ok('236A 被识别', m.p[0].mv === '236A', m.p[0].mv);
  });

  run('搓招：顺序错误不触发 236', function () {
    var m = mk('frog', 'roo');
    m.p[1].x = px(300);
    seq(m, [F, F | DN, DN, DN | BIT.A]);
    ok('错误顺序不触发 236A', m.p[0].mv !== '236A', m.p[0].mv);
  });

  run('搓招：623+B 升龙（美团袋鼠）', function () {
    var m = mk('roo', 'frog');
    m.p[1].x = px(300);
    seq(m, [F, F, DN, DN | F, DN | F | BIT.B]);
    ok('623B 被识别', m.p[0].mv === '623B', m.p[0].mv);
    steps(m, 6);
    ok('升龙会离地', m.p[0].y > 0, (m.p[0].y / SUB).toFixed(1));
  });

  run('搓招：623 顺序错误不触发（落到普通重拳）', function () {
    var m = mk('roo', 'frog');
    m.p[1].x = px(300);
    seq(m, [DN, DN | F, F, F | BIT.B]);
    ok('2→3→6+B 不识别为升龙', m.p[0].mv === '5B', m.p[0].mv);
  });

  run('搓招：214+B / 214+D 两个角色都能识别', function () {
    ['frog', 'roo'].forEach(function (fid) {
      [['B', BIT.B], ['D', BIT.D]].forEach(function (k) {
        var m = mk(fid, fid === 'frog' ? 'roo' : 'frog');
        m.p[1].x = px(300);
        seq(m, [DN, DN | B, B, B | k[1]]);
        ok(fid + ' 214' + k[0] + ' 被识别', m.p[0].mv === '214' + k[0], m.p[0].mv);
      });
    });
    var w = mk('frog', 'roo');
    w.p[1].x = px(300);
    seq(w, [DN, DN | F, F, F | BIT.D]);
    ok('236+D 不误判为 214D', w.p[0].mv !== '214D', w.p[0].mv);
  });

  // 让 P1 在距离 dist 处发出 214 必杀，P2 全程按 defHold，返回 P2 首次受到的结果
  function special214(fid, btn, dist, defHold) {
    var m = mk(fid, fid === 'frog' ? 'roo' : 'frog');
    m.p[0].x = px(-dist / 2);
    m.p[1].x = px(dist / 2);
    seq(m, [DN, DN | B, B, B | btn], defHold);
    var res = null, maxY = 0;
    for (var i = 0; i < 60 && !res; i++) {
      FG.sim.step(m, [0, defHold]);
      maxY = Math.max(maxY, m.p[0].y);
      if (m.p[1].state === 'stun') res = m.p[1].blocked ? 'block' : 'hit';
    }
    return { res: res, maxY: maxY, m: m };
  }

  run('214 必杀：判定高低与位移', function () {
    var hb = BIT.RIGHT;   // P2 面向左，按右即后方
    var r1 = special214('frog', BIT.B, 160, hb | DN);
    ok('奶蛙肚皮压顶为中段跳压：蹲防挡不住', r1.res === 'hit', r1.res);
    ok('肚皮压顶会离地', r1.maxY > 0, (r1.maxY / SUB).toFixed(1));
    var r2 = special214('frog', BIT.B, 160, hb);
    ok('肚皮压顶可被站防', r2.res === 'block', r2.res);
    var r3 = special214('frog', BIT.D, 180, hb);
    ok('奶蛙躺平滑铲为下段：站防挡不住', r3.res === 'hit', r3.res);
    var r4 = special214('roo', BIT.B, 150, hb);
    ok('袋鼠尾巴扫街为下段：站防挡不住', r4.res === 'hit', r4.res);
    var r5 = special214('roo', BIT.B, 150, hb | DN);
    ok('尾巴扫街可被蹲防', r5.res === 'block', r5.res);
    var r6 = special214('roo', BIT.D, 170, 0);
    ok('袋鼠准时飞踹命中', r6.res === 'hit', r6.res);
    steps(r6.m, 60);
    ok('准时飞踹两段都命中并击倒', r6.m.p[0].lastResult === 'hit' && r6.m.p[1].health <= r6.m.p[1].maxHealth - 140, r6.m.p[1].maxHealth - r6.m.p[1].health);
  });

  run('214 必杀可由普通技取消', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-50); m.p[1].x = px(0);
    FG.sim.step(m, [BIT.A, 0]);
    steps(m, 7);
    ok('5A 已命中（214D 取消前提）', m.p[0].connected === true, m.p[0].connected);
    seq(m, [DN, DN | B, B, B | BIT.D]);
    steps(m, 2);
    ok('5A 命中后取消为 214D', m.p[0].mv === '214D', m.p[0].mv);
  });

  run('超必杀：能量不足不发，满 100 发出并扣能量', function () {
    var a = mk('roo', 'frog');
    a.p[1].x = px(300);
    a.p[0].power = 50;
    seq(a, [DN, DN | F, F, F | BIT.C]);
    steps(a, 2);
    ok('能量 50 时不发 236C', a.p[0].mv !== '236C', a.p[0].mv);
    var b = mk('roo', 'frog');
    b.p[1].x = px(300);
    b.p[0].power = 100;
    seq(b, [DN, DN | F, F, F | BIT.C]);
    steps(b, 2);
    ok('能量 100 时发 236C 并扣至 0', b.p[0].mv === '236C' && b.p[0].power === 0, b.p[0].mv + ' / ' + b.p[0].power);
  });

  run('命中：5A 造成 40 点伤害', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-60);
    m.p[1].x = px(0);
    var h0 = m.p[1].health;
    FG.sim.step(m, [BIT.A, 0]);
    steps(m, 8);
    ok('5A 命中扣 40', m.p[1].health === h0 - 40, h0 - m.p[1].health);
    ok('攻击方记录为命中', m.p[0].lastResult === 'hit', m.p[0].lastResult);
  });

  run('防御：按住后方挡中段，扣 1/10', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-60);
    m.p[1].x = px(0);
    var h0 = m.p[1].health;
    FG.sim.step(m, [BIT.A, BIT.RIGHT]);
    steps(m, 8, 0, BIT.RIGHT);
    ok('防住（攻击方结果为 block）', m.p[0].lastResult === 'block', m.p[0].lastResult);
    ok('防御掉 4 点（40 的 1/10）', m.p[1].health === h0 - 4, h0 - m.p[1].health);
  });

  run('高低：下段 2C 站防挡不住，蹲防可挡', function () {
    var a = mk('frog', 'roo');
    a.p[0].x = px(-50);
    a.p[1].x = px(0);
    FG.sim.step(a, [DN | BIT.C, 0]);
    steps(a, 8, 0, BIT.RIGHT);
    ok('站防挡不住下段', a.p[0].lastResult === 'hit', a.p[0].lastResult);
    var b = mk('frog', 'roo');
    b.p[0].x = px(-50);
    b.p[1].x = px(0);
    FG.sim.step(b, [DN | BIT.C, 0]);
    steps(b, 8, 0, DN | BIT.RIGHT);
    ok('蹲防可挡下段', b.p[0].lastResult === 'block', b.p[0].lastResult);
  });

  run('气弹：舌鞭命中扣 70', function () {
    var m = mk('frog', 'roo');
    m.p[1].x = px(250);
    seq(m, [DN, DN | F, F, F | BIT.A]);
    var h0 = m.p[1].health;
    steps(m, 150);
    ok('舌鞭命中扣 70', m.p[1].health === h0 - 70, h0 - m.p[1].health);
  });

  run('连段取消：5A 命中后可取消为舌鞭', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-50);
    m.p[1].x = px(0);
    FG.sim.step(m, [BIT.A, 0]);
    steps(m, 7);
    ok('5A 已命中（连段开始）', m.p[0].connected === true, m.p[0].connected);
    seq(m, [DN, DN | F, F, F | BIT.A]);
    steps(m, 2);
    ok('命中后取消为 236A', m.p[0].mv === '236A', m.p[0].mv);
  });

  run('跳跃：起跳有高度，落地回到站立', function () {
    var m = mk('frog', 'roo');
    FG.sim.step(m, [UP, 0]);
    var peak = 0;
    for (var i = 0; i < 60; i++) {
      FG.sim.step(m, [0, 0]);
      peak = Math.max(peak, m.p[0].y);
    }
    ok('起跳有高度（>50px）', peak > px(50), (peak / SUB).toFixed(1));
    ok('落地后站立', m.p[0].state === 'stand' && m.p[0].y === 0, m.p[0].state + ' / ' + m.p[0].y);
  });

  run('边界：不走出舞台', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-395);
    steps(m, 90, B, 0);
    ok('左墙限制在 -400px 以内', m.p[0].x >= px(-400), (m.p[0].x / SUB).toFixed(1));
  });

  run('推挤：重叠时自动分开', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = 0;
    m.p[1].x = px(10);
    FG.sim.step(m, [0, 0]);
    var gap = Math.abs(m.p[1].x - m.p[0].x);
    ok('间距不小于最小值', gap >= px(FG.PUSH_MIN) - 1, (gap / SUB).toFixed(1));
  });

  run('KO：血量归零判负并计入胜场', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-50);
    m.p[1].x = px(0);
    m.p[1].health = 30;
    FG.sim.step(m, [BIT.A, 0]);
    steps(m, 10);
    ok('进入 KO 阶段，红方（奶蛙）胜', m.phase === 'ko' && m.winner === 0, m.phase + ' / ' + m.winner);
    steps(m, FG.KO_FRAMES + 2);
    ok('结算后胜场 +1 并进入下一回合', m.wins[0] === 1 && m.phase === 'intro', m.wins.join('-') + ' / ' + m.phase);
  });

  run('训练假人：自动防御只在对方出招时防御', function () {
    var m = mk('frog', 'roo');
    ok('对方未出招 → 不动', FG.ai.dummyDecide(m, m.p[1], m.p[0], 'auto') === 0);
    m.p[0].state = 'atk';
    m.p[0].mv = '5A';
    var k1 = FG.ai.dummyDecide(m, m.p[1], m.p[0], 'auto');
    ok('对方中段出招 → 后退防御', k1 === BIT.RIGHT, k1);
    m.p[0].mv = '2C';
    var k2 = FG.ai.dummyDecide(m, m.p[1], m.p[0], 'auto');
    ok('对方下段出招 → 蹲下防御', k2 === (BIT.RIGHT | BIT.DOWN), k2);
  });

  run('随机防御假人：同一次攻击答复一致，多次攻击有防有不防', function () {
    var m = mk('frog', 'roo');
    var st = FG.ai.newAI(1);
    m.p[0].state = 'atk'; m.p[0].mv = '5A'; m.p[0].mf = 5; m.p[0].serial = 1;
    var first = FG.ai.dummyDecide(m, m.p[1], m.p[0], 'random', st);
    var same = true;
    for (var i = 0; i < 10; i++) if (FG.ai.dummyDecide(m, m.p[1], m.p[0], 'random', st) !== first) same = false;
    ok('同一次攻击内答复不变', same, first);
    var blocks = 0;
    for (var k = 0; k < 40; k++) {
      m.p[0].serial = 100 + k;
      if (FG.ai.dummyDecide(m, m.p[1], m.p[0], 'random', st) !== 0) blocks++;
    }
    ok('随机防御：40 次攻击中有防也有不防', blocks > 5 && blocks < 35, blocks);
  });

  run('数据：连段取消目标全部存在', function () {
    var missing = [];
    Object.keys(FG.MOVESETS).forEach(function (fid) {
      var set = FG.MOVESETS[fid];
      Object.keys(set).forEach(function (id) {
        set[id].cancels.forEach(function (c) { if (!set[c]) missing.push(fid + ':' + id + '->' + c); });
      });
    });
    ok('所有取消目标存在', missing.length === 0, missing.join(' '));
  });

  run('电脑陪练：3600 帧稳定运行', function () {
    var m = FG.sim.createMatch({ mode: 'cpu', fid0: 'frog', fid1: 'roo', seed: 5 });
    var ai = FG.ai.newAI(1), bad = '', starts = 0, last = [null, null];
    for (var i = 0; i < 3600 && !bad; i++) {
      var p2 = FG.ai.cpuDecide(m, m.p[1], m.p[0], ai);
      var p1 = (i % 90 < 45) ? F : ((i % 90 < 60) ? (DN | F | BIT.A) : 0);
      FG.sim.step(m, [p1, p2]);
      for (var j = 0; j < 2; j++) {
        var q = m.p[j];
        if (q.state === 'atk' && q.mv !== last[j]) starts++;
        last[j] = q.state === 'atk' ? q.mv : null;
        if (!isFinite(q.x) || !isFinite(q.y) || q.health < 0 || q.power < 0 || q.power > FG.POWER_MAX) {
          bad = '第 ' + i + ' 帧 P' + (j + 1) + ' 数值异常';
        }
      }
      if (m.phase === 'matchEnd') m = FG.sim.createMatch({ mode: 'cpu', fid0: 'frog', fid1: 'roo', seed: i + 1 });
    }
    ok('电脑陪练 3600 帧无异常', bad === '', bad);
    ok('电脑陪练确实出招（>10 次）', starts > 10, starts);
  });

  run('电脑对电脑：完整对局能结束，且有攻防', function () {
    var m = FG.sim.createMatch({ mode: 'cpu', fid0: 'frog', fid1: 'roo', seed: 11 });
    var a0 = FG.ai.newAI(2), a1 = FG.ai.newAI(2);
    var rounds = 0, contacts = 0, f = 0;
    for (f = 0; f < 60 * 60 * 15 && m.phase !== 'matchEnd'; f++) {
      var i0 = FG.ai.cpuDecide(m, m.p[0], m.p[1], a0);
      var i1 = FG.ai.cpuDecide(m, m.p[1], m.p[0], a1);
      FG.sim.step(m, [i0, i1]);
      for (var e = 0; e < m.events.length; e++) {
        if (m.events[e].type === 'ko') rounds++;
        if (m.events[e].type === 'hit' || m.events[e].type === 'block') contacts++;
      }
    }
    ok('电脑对电脑 15 分钟内打完整场', m.phase === 'matchEnd', 'frames=' + f + ' phase=' + m.phase);
    ok('电脑对电脑回合结束 ≥ 2 次', rounds >= 2, rounds);
    ok('电脑对电脑攻防接触 ≥ 20 次', contacts >= 20, contacts);
  });

  // ================= 阶段二：系统 =================
  run('前冲 66 / 后撤 44', function () {
    var m = mk('frog', 'roo');
    m.p[1].x = px(300);
    var x0 = m.p[0].x;
    seq(m, [F, 0, F]);
    steps(m, 1);
    ok('66 进入前冲', m.p[0].state === 'dash', m.p[0].state);
    steps(m, FG.DASH_FRAMES);
    ok('前冲位移大于走路', (m.p[0].x - x0) / SUB > 90, ((m.p[0].x - x0) / SUB).toFixed(0));
    ok('前冲结束回到站立', m.p[0].state === 'stand', m.p[0].state);
    var b = mk('frog', 'roo');
    b.p[1].x = px(300);
    seq(b, [B, 0, B]);
    steps(b, 2);
    ok('44 进入后撤', b.p[0].state === 'bdash', b.p[0].state);
    ok('后撤开头无受击框（无敌）', FG.sim.hurtRect(b.p[0]) === null);
    steps(b, FG.BDASH_INVUL + 2);
    ok('无敌结束后恢复受击框', b.p[0].state !== 'bdash' || FG.sim.hurtRect(b.p[0]) !== null);
    var c = mk('frog', 'roo');
    c.p[1].x = px(300);
    seq(c, [DN, DN | F, F, 0, F]);
    ok('236 收尾的 6 不算轻点（不误出前冲）', c.p[0].state !== 'dash', c.p[0].state);
    var d = mk('frog', 'roo');
    d.p[1].x = px(300);
    seq(d, [F]); steps(d, 20); seq(d, [F]);
    ok('两次轻点间隔太久不出前冲', d.p[0].state !== 'dash', d.p[0].state);
  });

  run('前冲中可直接出招', function () {
    var m = mk('frog', 'roo');
    m.p[1].x = px(300);
    seq(m, [F, 0, F]); steps(m, 3);
    seq(m, [BIT.A]);
    ok('前冲中按 A 出 5A', m.p[0].mv === '5A', m.p[0].mv);
  });

  // 让 P1 发投技（B+D 同按），P2 输入 p2 函数
  function throwAt(dist, p2fn, f0, f1) {
    var m = mk(f0 || 'frog', f1 || 'roo');
    m.p[0].x = px(-dist / 2);
    m.p[1].x = px(dist / 2);
    var res = null, h0 = m.p[1].health;
    for (var i = 0; i < 40; i++) {
      var p2 = p2fn ? p2fn(i) : 0;
      FG.sim.step(m, [i === 0 ? (BIT.B | BIT.D) : 0, p2]);
      for (var e = 0; e < m.events.length; e++) {
        var t = m.events[e].type;
        if (!res && (t === 'throw' || t === 'whiff' || t === 'throwbreak')) res = t;
      }
    }
    return { res: res, dmg: h0 - m.p[1].health, m: m };
  }

  run('投技：近身成功、远距离抓空、不可防御、可拆', function () {
    var r1 = throwAt(70);
    ok('近身 B+D 投中', r1.res === 'throw', r1.res);
    ok('投技伤害 120', r1.dmg === 120, r1.dmg);
    ok('被投后击倒', r1.m.p[1].state === 'down' || r1.m.p[1].state === 'stand', r1.m.p[1].state);
    var r2 = throwAt(200);
    ok('距离远时抓空', r2.res === 'whiff', r2.res);
    var r3 = throwAt(70, function () { return BIT.RIGHT; });
    ok('按住后方防御也会被投', r3.res === 'throw', r3.res);
    var r4 = throwAt(70, function (i) { return i === 1 ? (BIT.B | BIT.D) : 0; });
    ok('被抓瞬间同按 B+D 拆投', r4.res === 'throwbreak' && r4.dmg === 0, r4.res + ' / ' + r4.dmg);
    var r5 = throwAt(70, function () { return BIT.UP; });
    ok('对手起跳时投不到', r5.res !== 'throw', r5.res);
  });

  run('投技：两键差 1 帧也能出（空投取消重拳）', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-35); m.p[1].x = px(35);
    seq(m, [BIT.B, BIT.B | BIT.D]);
    ok('先 B 后 D 变成投技', m.p[0].mv === 'TH', m.p[0].mv);
  });

  run('防御反击：防御中 C+D，消耗 50 能量，无敌并击倒', function () {
    var m = mk('frog', 'roo');
    m.p[0].x = px(-50); m.p[1].x = px(0);
    m.p[1].power = 100;
    FG.sim.step(m, [BIT.A, BIT.RIGHT]);
    for (var i = 0; i < 8 && m.p[1].state !== 'stun'; i++) FG.sim.step(m, [0, BIT.RIGHT]);
    ok('P2 进入防御硬直', m.p[1].state === 'stun' && m.p[1].blocked, m.p[1].state);
    var hs = m.hitstop;
    steps(m, hs, 0, BIT.RIGHT);
    FG.sim.step(m, [0, BIT.RIGHT | BIT.C | BIT.D]);
    ok('发动防御反击', m.p[1].mv === 'GC', m.p[1].mv);
    ok('消耗 50 能量', m.p[1].power <= 100 - 50 + 10, m.p[1].power);
    FG.sim.step(m, [0, 0]);
    ok('防御反击开头无敌', FG.sim.hurtRect(m.p[1]) === null);
    var kd = false;
    for (var k = 0; k < 40; k++) { FG.sim.step(m, [0, 0]); if (m.p[0].state === 'down' || m.p[0].kdPending) kd = true; }
    ok('防御反击打中后击倒对手', kd, m.p[0].state);
    var n = mk('frog', 'roo');
    n.p[0].x = px(-50); n.p[1].x = px(0);
    n.p[1].power = 20;
    FG.sim.step(n, [BIT.A, BIT.RIGHT]);
    steps(n, 12, 0, BIT.RIGHT);
    FG.sim.step(n, [0, BIT.RIGHT | BIT.C | BIT.D]);
    ok('能量不足不能防御反击', n.p[1].mv !== 'GC', n.p[1].mv);
  });

  run('受身：倒地瞬间按键快速起身', function () {
    function knock(tech) {
      var m = mk('frog', 'roo');
      m.p[0].x = px(-60); m.p[1].x = px(20);
      FG.sim.step(m, [DN | BIT.D, 0]);
      var down = -1, up = -1, x0 = 0;
      for (var i = 0; i < 120 && up < 0; i++) {
        var inp = (tech && down >= 0 && i === down + 2) ? BIT.A : 0;
        FG.sim.step(m, [0, inp]);
        if (down < 0 && m.p[1].state === 'down') { down = i; x0 = m.p[1].x; }
        if (down >= 0 && m.p[1].state === 'stand') up = i;
      }
      return { down: down, rise: up - down, dx: (m.p[1].x - x0) / SUB };
    }
    var a = knock(false), b = knock(true);
    ok('扫腿击倒（倒地发生）', a.down >= 0 && b.down >= 0, a.down + ' / ' + b.down);
    ok('受身比普通起身快', b.rise < a.rise - 15, b.rise + ' vs ' + a.rise);
    ok('受身向后翻滚（远离对手）', b.dx > 20, b.dx.toFixed(0));
  });

  // ================= 阶段二：电脑难度 =================
  run('电脑难度：三档参数逐级提升', function () {
    var L = FG.ai.LEVELS;
    ok('防御率 简单 < 普通 < 困难', L[1].block < L[2].block && L[2].block < L[3].block);
    ok('反应 简单最慢、困难最快', L[1].react > L[2].react && L[2].react > L[3].react);
    ok('简单不会确认连段，困难会', L[1].confirm === 0 && L[3].confirm > 0.5);
  });

  // 电脑（P1）对固定木桩（P2 站立不动或一直防御），统计行为
  function cpuVsDummy(level, frames, dummyHold) {
    var m = FG.sim.createMatch({ mode: 'training', fid0: 'frog', fid1: 'roo', seed: 3 });
    var ai = FG.ai.newAI(level), st = { confirms: 0, throws: 0, dash: 0, hits: 0, specials: 0 };
    for (var i = 0; i < frames; i++) {
      // 每 5 秒把两人拉开，保证有远距离接近的场景
      if (i % 300 === 0) { m.p[0].x = px(-320); m.p[1].x = px(320); }
      var p2 = dummyHold ? dummyHold(m, i) : 0;
      var a = m.p[0];
      // 取消 = 上一帧还在打中对手的普通技里，这一帧换成必杀
      var wasNormalHit = a.state === 'atk' && a.connected && a.mv && a.mv.length === 2 && a.mv !== 'TH' && a.mv !== 'GC';
      FG.sim.step(m, [FG.ai.cpuDecide(m, m.p[0], m.p[1], ai), p2]);
      m.infinite = true;
      for (var e = 0; e < m.events.length; e++) {
        var ev = m.events[e];
        if (ev.type === 'move' && ev.p === 0 && /^(236|623|214)/.test(ev.id) && wasNormalHit) st.confirms++;
        if (ev.type === 'move' && ev.p === 0 && /^(236|623|214)/.test(ev.id)) st.specials++;
        if (ev.type === 'throw' && ev.p === 0) st.throws++;
        if ((ev.type === 'dash' || ev.type === 'bdash') && ev.p === 0) st.dash++;
        if (ev.type === 'hit' && ev.att === 0) st.hits++;
      }
    }
    return st;
  }

  run('电脑难度：困难会确认连段、冲刺、投技，简单不会确认', function () {
    var hard = cpuVsDummy(3, 3600), easy = cpuVsDummy(1, 3600);
    ok('困难：普通技打中后取消必杀 ≥ 3 次', hard.confirms >= 3, JSON.stringify(hard));
    ok('简单：不主动确认（偶发取消远少于困难）', easy.confirms * 3 <= hard.confirms, JSON.stringify(easy));
    ok('困难会冲刺 / 后撤', hard.dash >= 1, hard.dash);
    var block = cpuVsDummy(3, 3600, function (m) { return m.p[0].x < m.p[1].x ? BIT.RIGHT : BIT.LEFT; });
    ok('困难面对一直防御的对手会用投技', block.throws >= 1, JSON.stringify(block));
  });

  run('电脑难度：困难会受身，简单不会', function () {
    function techs(level) {
      var n = 0;
      for (var s = 0; s < 6; s++) {
        var m = mk('frog', 'roo');
        var ai = FG.ai.newAI(level);
        m.seed = 100 + s;
        // 直接让对手进入"即将倒地"的硬直，避免电脑先把扫腿防住
        var d = m.p[1];
        d.state = 'stun'; d.blocked = false; d.kdPending = true; d.stunLeft = 3;
        for (var i = 0; i < 90; i++) {
          FG.sim.step(m, [0, FG.ai.cpuDecide(m, m.p[1], m.p[0], ai)]);
          for (var e = 0; e < m.events.length; e++) if (m.events[e].type === 'tech') n++;
        }
      }
      return n;
    }
    var h = techs(3), e = techs(1);
    ok('困难 6 次倒地中受身 ≥ 3 次', h >= 3, h);
    ok('简单从不受身', e === 0, e);
  });

  run('电脑对电脑：三档难度都能打完整场', function () {
    [1, 2, 3].forEach(function (lv) {
      var m = FG.sim.createMatch({ mode: 'cpu', fid0: 'frog', fid1: 'roo', seed: 40 + lv });
      var a0 = FG.ai.newAI(lv), a1 = FG.ai.newAI(lv), f = 0;
      for (f = 0; f < 60 * 60 * 15 && m.phase !== 'matchEnd'; f++) {
        FG.sim.step(m, [FG.ai.cpuDecide(m, m.p[0], m.p[1], a0), FG.ai.cpuDecide(m, m.p[1], m.p[0], a1)]);
      }
      ok(FG.ai.LEVEL_NAMES[lv] + '：完整对局能结束', m.phase === 'matchEnd', 'frames=' + f);
    });
  });

  run('难度越高对弱电脑胜率越高（困难 vs 简单）', function () {
    var hardWins = 0;
    for (var s = 0; s < 4; s++) {
      var m = FG.sim.createMatch({ mode: 'cpu', fid0: s % 2 ? 'roo' : 'frog', fid1: s % 2 ? 'frog' : 'roo', seed: 70 + s });
      var a0 = FG.ai.newAI(3), a1 = FG.ai.newAI(1);
      for (var f = 0; f < 60 * 60 * 15 && m.phase !== 'matchEnd'; f++) {
        FG.sim.step(m, [FG.ai.cpuDecide(m, m.p[0], m.p[1], a0), FG.ai.cpuDecide(m, m.p[1], m.p[0], a1)]);
      }
      if (m.matchWinner === 0) hardWins++;
    }
    ok('困难对简单 4 场至少赢 3 场', hardWins >= 3, hardWins);
  });

  // ================= 阶段二：训练辅助 =================
  run('训练：实测帧优势与面板一致，连段伤害累计', function () {
    [['5A', BIT.A, 0, 'hit'], ['5A', BIT.A, BIT.RIGHT, 'block'], ['2C', DN | BIT.C, 0, 'hit']].forEach(function (c) {
      var m = mk('frog', 'roo'), T = FG.trainer.create();
      m.p[0].x = px(-50); m.p[1].x = px(0);
      FG.sim.step(m, [c[1], c[2]]); FG.trainer.observe(T, m);
      for (var i = 0; i < 60; i++) { FG.sim.step(m, [0, c[2]]); FG.trainer.observe(T, m); }
      var mv = FG.MOVESETS.frog[c[0]], shown = c[3] === 'hit' ? mv.advHit : mv.advBlock;
      ok(c[0] + ' ' + c[3] + ' 实测 ' + T.adv + ' = 面板 ' + shown, T.adv === shown, T.adv);
    });
    var m2 = mk('frog', 'roo'), T2 = FG.trainer.create();
    m2.p[0].x = px(-50); m2.p[1].x = px(0);
    FG.sim.step(m2, [BIT.A, 0]); FG.trainer.observe(T2, m2);
    for (var j = 0; j < 7; j++) { FG.sim.step(m2, [0, 0]); FG.trainer.observe(T2, m2); }
    var masks = [DN, DN | F, F, F | BIT.A];
    for (var k = 0; k < 120; k++) { FG.sim.step(m2, [masks[k] || 0, 0]); FG.trainer.observe(T2, m2); }
    ok('连段 5A > 舌鞭：2 Hit 共 110 伤害', T2.comboHits === 2 && T2.comboDmg === 110 && T2.maxDmg === 110,
      T2.comboHits + ' Hit / ' + T2.comboDmg);
  });

  run('训练：录制假人动作并回放', function () {
    var T = FG.trainer.create();
    ok('开始录制', FG.trainer.toggleRecord(T) === 'rec');
    var r1 = FG.trainer.route(T, BIT.LEFT, 0);
    ok('录制中玩家输入驱动假人，P1 不动', r1[0] === 0 && r1[1] === BIT.LEFT, r1.join(','));
    FG.trainer.route(T, BIT.A, 0);
    FG.trainer.route(T, 0, 0);
    ok('停止录制', FG.trainer.toggleRecord(T) === 'off' && T.rec.buf.length === 3, T.rec.buf.length);
    ok('开始回放', FG.trainer.togglePlay(T) === 'play');
    var out = [FG.trainer.route(T, BIT.D, 99)[1], FG.trainer.route(T, 0, 99)[1], FG.trainer.route(T, 0, 99)[1], FG.trainer.route(T, 0, 99)[1]];
    ok('回放按录制顺序循环', out.join(',') === [BIT.LEFT, BIT.A, 0, BIT.LEFT].join(','), out.join(','));
    ok('回放时 P1 仍由玩家操控', FG.trainer.route(T, BIT.D, 99)[0] === BIT.D);
    var E = FG.trainer.create();
    ok('没有录像时不能回放', FG.trainer.togglePlay(E) === 'off');
  });

  // ================= 阶段二：闯关 =================
  run('闯关：三关数据完整、镜像关为暗黑同角色', function () {
    ['frog', 'roo'].forEach(function (fid) {
      var lines = FG.arcade.LINES[fid];
      ok(fid + ' 每关都有对白', lines.length === FG.arcade.STAGES.length && lines.every(function (l) { return l.length >= 2; }));
      var s1 = FG.arcade.stageMatch(fid, 1);
      ok(fid + ' 第二关是暗黑' + FG.FIGHTERS[fid].name, s1.mirror && s1.fid1 === fid && s1.name1 === FG.arcade.DARK[fid], s1.name1);
      var s2 = FG.arcade.stageMatch(fid, 2);
      ok(fid + ' 最终关为困难', s2.level === 3 && s2.fid1 !== fid);
      ok(fid + ' 有结局文本', FG.arcade.ENDINGS[fid].length >= 3);
    });
    var mm = FG.sim.createMatch({ mode: 'cpu', fid0: 'frog', fid1: 'frog', name1: '暗黑奶蛙' });
    ok('同角色对局可创建，且对手显示暗黑名字', mm.p[1].fid === 'frog' && mm.p[1].name === '暗黑奶蛙');
  });

  window.__RESULT__ = { pass: fails === 0, fails: fails, rows: rows };
  var out = document.getElementById('out');
  if (out) {
    var passed = rows.filter(function (r) { return r.pass; }).length;
    out.textContent = rows.map(function (r) {
      return (r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '  [' + r.extra + ']' : '');
    }).join('\n') + '\n---\n通过 ' + passed + ' / ' + rows.length;
  }
  document.body.setAttribute('data-done', '1');
})();
