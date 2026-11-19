/* 应用层：标题 / 选角 / 对战 / 暂停 / 结算 / 闯关（对白、续关、结局）/ 说明，以及固定 60Hz 的主循环。 */
(function () {
  'use strict';
  var FG = window.FG;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  // 高分屏按设备像素比放大画布，文字更清晰；逻辑坐标仍是 960x540
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FG.W * dpr;
  canvas.height = FG.H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var ORDER = ['frog', 'roo'];

  var MODES = [
    { id: 'cpu', label: '单机 · 对战电脑' },
    { id: 'training', label: '训练模式' },
    { id: 'pvp', label: '本地双人' },
    { id: 'arcade', label: '闯关模式' },
    { id: 'settings', label: '设置' },
    { id: 'help', label: '操作说明' }
  ];
  // 设置项：kind = vol（0~1，步长 0.1）/ shake（0 关 1 弱 2 标准）/ bool / reset / back
  var SETTINGS = [
    { key: 'bgm', label: '音乐音量', kind: 'vol' },
    { key: 'sfx', label: '音效音量', kind: 'vol' },
    { key: 'voice', label: '播报语音', kind: 'bool' },
    { key: 'shake', label: '震屏强度', kind: 'shake' },
    { key: 'diff', label: '电脑默认难度', kind: 'diff' },
    { key: 'reset', label: '清除存档', kind: 'reset' },
    { key: 'back', label: '返回', kind: 'back' }
  ];
  var PAUSE_ITEMS = [{ label: '继续' }, { label: '重新开始' }, { label: '返回标题' }];
  var RESULT_ITEMS = [{ label: '再来一局' }, { label: '返回标题' }];
  var CONTINUE_ITEMS = [{ label: '继续挑战' }, { label: '返回标题' }];

  var view = {
    screen: 'title', items: MODES, index: 0, tick: 0,
    mode: 'cpu', pick: 0, diff: FG.save.data.diff || 2, match: null, ai: null, mirror: false,
    settings: SETTINGS, confirmReset: false,
    showHitbox: false, dummyMode: 0, dummyState: FG.ai.newAI(1),
    trk: FG.trainer.create(),
    arc: null,
    lag: [1000, 1000], fxs: FG.fx.create(), cam: { x: 0, zoom: 1 }, slowAcc: 0
  };

  // 每个界面对应的背景音乐
  var SCREEN_MUSIC = { title: 'bgm_title', help: 'bgm_title', settings: 'bgm_title', select: 'bgm_select',
    story: 'bgm_select', continue: 'bgm_select', ending: 'bgm_title', result: 'bgm_title' };

  function setScreen(name) {
    var prev = view.screen;
    view.screen = name;
    view.index = 0;
    if (name === 'pause') FG.sfx.duck(0.35);
    else if (prev === 'pause') FG.sfx.duck(1);
    if (SCREEN_MUSIC[name]) FG.sfx.music(SCREEN_MUSIC[name]);
    else if (name === 'fight' && prev !== 'pause') FG.sfx.music('fight');
    if (name === 'settings') view.confirmReset = false;
    if (name === 'fight') FG.input.clearTaps();   // 菜单里的按键不能带进对战
    if (name === 'title') view.items = MODES;
    else if (name === 'pause') view.items = PAUSE_ITEMS;
    else if (name === 'result') view.items = RESULT_ITEMS;
    else if (name === 'continue') view.items = CONTINUE_ITEMS;
    else view.items = [];
  }

  function freshMatch(opts, level) {
    view.match = FG.sim.createMatch(opts);
    view.ai = FG.ai.newAI(level);
    view.dummyState = FG.ai.newAI(1);
    view.lag = [view.match.p[0].health, view.match.p[1].health];
    view.fxs = FG.fx.create();
    view.cam = { x: 0, zoom: 1 };
    var keep = view.trk.rec;   // 重新开始时保留训练录像
    view.trk = FG.trainer.create();
    view.trk.rec = keep;
    keep.mode = 'off';
    setScreen('fight');
  }

  function startMatch() {
    if (view.mode === 'arcade') {
      var sm = FG.arcade.stageMatch(view.arc.fid, view.arc.stage);
      view.mirror = sm.mirror;
      freshMatch({ mode: 'cpu', fid0: sm.fid0, fid1: sm.fid1, name1: sm.name1, seed: Date.now() >>> 0 }, sm.level);
      return;
    }
    var p1 = ORDER[view.pick], p2 = ORDER[1 - view.pick];
    view.mirror = false;
    freshMatch({ mode: view.mode, fid0: p1, fid1: p2, seed: Date.now() >>> 0 }, view.diff);
  }

  // ---------------- 闯关流程 ----------------
  function startArcade() {
    view.arc = { fid: ORDER[view.pick], stage: 0, line: 0, continues: 0, startTick: view.tick };
    setScreen('story');
  }

  function arcadeAfterMatch() {
    var m = view.match, A = view.arc;
    if (m.matchWinner === 0) {
      A.stage++;
      A.line = 0;
      if (A.stage >= FG.arcade.STAGES.length) {
        A.endTick = view.tick;
        var cl = FG.save.data.cleared;
        cl[A.fid] = (cl[A.fid] || 0) + 1;
        FG.save.save();
        setScreen('ending');
      }
      else setScreen('story');
    } else {
      setScreen('continue');
    }
  }

  function fightStep() {
    var m = view.match;
    var s = FG.input.sample();
    var p1 = s[0], p2 = s[1];
    if (view.mode === 'cpu' || view.mode === 'arcade') {
      p2 = FG.ai.cpuDecide(m, m.p[1], m.p[0], view.ai);
    } else if (view.mode === 'training') {
      var dummy = FG.ai.dummyDecide(m, m.p[1], m.p[0], FG.ai.DUMMY_MODES[view.dummyMode], view.dummyState);
      var routed = FG.trainer.route(view.trk, p1, dummy);
      p1 = routed[0]; p2 = routed[1];
    }
    var wasDown = [m.p[0].state === 'down', m.p[1].state === 'down'];
    FG.sim.step(m, [p1, p2]);
    if (view.mode === 'training') FG.trainer.observe(view.trk, m);
    // 回合播报：标题横幅出现时（intro 剩 55 帧）报回合数；首回合 VS 之后
    if (m.phase === 'intro' && m.phaseT === 54) {
      var finalRound = m.wins[0] === m.maxWins - 1 && m.wins[1] === m.maxWins - 1;
      FG.sfx.roundCall(m.round, finalRound);
    }
    for (var i = 0; i < m.events.length; i++) {
      var e = m.events[i];
      if (e.type === 'ko') { FG.sfx.play('ko'); FG.sfx.koCall(m.timer <= 0, e.perfect); continue; }
      FG.sfx.play(e.type === 'hit' && (e.heavy || e.kd) ? 'heavy' : e.type);
    }
    for (var q = 0; q < 2; q++) if (!wasDown[q] && m.p[q].state === 'down' && m.phase === 'fight') FG.sfx.play('down');
    FG.fx.onEvents(view.fxs, m, m.events);
    if (m.phase === 'matchEnd') {
      if (view.mode === 'arcade') arcadeAfterMatch();
      else setScreen('result');
    }
  }

  function cycle(n, d) { return (view.index + n + d) % n; }

  function changeSetting(it, dir) {
    var d = FG.save.data;
    if (it.kind === 'vol') d[it.key] = Math.round(FG.clamp(d[it.key] + dir * 0.1, 0, 1) * 10) / 10;
    else if (it.kind === 'shake') d.shake = FG.clamp(d.shake + dir, 0, 2);
    else if (it.kind === 'bool') d[it.key] = !d[it.key];
    else if (it.kind === 'diff') { d.diff = FG.clamp(d.diff + dir, 1, 3); view.diff = d.diff; }
    else return false;
    FG.save.save();
    FG.sfx.applyVolume();
    return true;
  }

  function handleActions() {
    var acts = FG.input.actions();
    if (!acts.length) return;
    FG.sfx.unlock();
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var sc = view.screen;
      if (sc !== 'fight') {
        if (a === 'up' || a === 'down' || a === 'left' || a === 'right') FG.sfx.play('ui_move');
        else if (a === 'ok') FG.sfx.play('ui_ok');
        else if (a === 'back' || a === 'escape') FG.sfx.play('ui_back');
      } else if (a === 'escape') FG.sfx.play('ui_back');
      if (sc === 'settings') {
        var it = SETTINGS[view.index];
        if (a === 'up') { view.index = cycle(SETTINGS.length, -1); view.confirmReset = false; }
        else if (a === 'down') { view.index = cycle(SETTINGS.length, 1); view.confirmReset = false; }
        else if (a === 'left' || a === 'right') changeSetting(it, a === 'left' ? -1 : 1);
        else if (a === 'ok') {
          if (it.kind === 'back') setScreen('title');
          else if (it.kind === 'reset') {
            if (view.confirmReset) { FG.save.reset(); view.diff = FG.save.data.diff; FG.sfx.applyVolume(); view.confirmReset = false; }
            else view.confirmReset = true;
          } else changeSetting(it, 1);
        } else if (a === 'escape' || a === 'back') setScreen('title');
        continue;
      }
      if (sc === 'title') {
        if (a === 'up') view.index = cycle(MODES.length, -1);
        else if (a === 'down') view.index = cycle(MODES.length, 1);
        else if (a === 'ok') {
          var it = MODES[view.index];
          if (it.id === 'help') setScreen('help');
          else if (it.id === 'settings') setScreen('settings');
          else { view.mode = it.id; view.pick = 0; view.diff = FG.save.data.diff || view.diff; setScreen('select'); }
        }
      } else if (sc === 'select') {
        var hasDiff = view.mode === 'cpu';   // 闯关每关难度固定（简单 → 普通 → 困难）
        if (a === 'left' || a === 'right') view.pick = (view.pick + 1) % ORDER.length;
        else if ((a === 'up' || a === 'down') && hasDiff) view.diff = FG.clamp(view.diff + (a === 'up' ? 1 : -1), 1, 3);
        else if (a === 'up' || a === 'down') view.pick = (view.pick + 1) % ORDER.length;
        else if (a === 'ok') { if (view.mode === 'arcade') startArcade(); else startMatch(); }
        else if (a === 'back' || a === 'escape') setScreen('title');
      } else if (sc === 'fight') {
        var tr = view.mode === 'training';
        if (a === 'escape') setScreen('pause');
        else if (a === 'hitbox') view.showHitbox = !view.showHitbox;
        else if (tr && a === 'reset') { FG.sim.resetRound(view.match); view.trk.rec.idx = 0; }
        else if (tr && a === 'dummy') view.dummyMode = (view.dummyMode + 1) % FG.ai.DUMMY_MODES.length;
        else if (tr && a === 'infinite') view.match.infinite = !view.match.infinite;
        else if (tr && a === 'record') { FG.sim.resetRound(view.match); FG.trainer.toggleRecord(view.trk); }
        else if (tr && a === 'play') { FG.sim.resetRound(view.match); FG.trainer.togglePlay(view.trk); }
      } else if (sc === 'pause') {
        if (a === 'up') view.index = cycle(PAUSE_ITEMS.length, -1);
        else if (a === 'down') view.index = cycle(PAUSE_ITEMS.length, 1);
        else if (a === 'ok') {
          if (view.index === 0) setScreen('fight');
          else if (view.index === 1) startMatch();
          else setScreen('title');
        } else if (a === 'escape' || a === 'back') setScreen('fight');
      } else if (sc === 'result') {
        if (a === 'up' || a === 'down') view.index = (view.index + 1) % RESULT_ITEMS.length;
        else if (a === 'ok') {
          if (view.index === 0) startMatch();
          else setScreen('title');
        } else if (a === 'escape' || a === 'back') setScreen('title');
      } else if (sc === 'story') {
        if (a === 'ok') {
          var lines = FG.arcade.LINES[view.arc.fid][view.arc.stage];
          view.arc.line++;
          if (view.arc.line >= lines.length) startMatch();
        } else if (a === 'escape' || a === 'back') setScreen('title');
      } else if (sc === 'continue') {
        if (a === 'up' || a === 'down') view.index = (view.index + 1) % CONTINUE_ITEMS.length;
        else if (a === 'ok') {
          if (view.index === 0) { view.arc.continues++; view.arc.line = 0; setScreen('story'); }
          else setScreen('title');
        } else if (a === 'escape' || a === 'back') setScreen('title');
      } else if (sc === 'ending') {
        if (a === 'ok' || a === 'escape' || a === 'back') setScreen('title');
      } else if (sc === 'help') {
        if (a === 'ok' || a === 'escape' || a === 'back') setScreen('title');
      }
    }
  }

  function updateFx() {
    if (view.screen === 'fight') {
      FG.fx.update(view.fxs, view.match, view.tick);
      FG.render.updateCamera(view.cam, view.match, view.fxs);
    }
    if (view.match) {
      for (var j = 0; j < 2; j++) {
        var hp = view.match.p[j].health;
        if (view.lag[j] > hp) view.lag[j] = Math.max(hp, view.lag[j] - 4);
        else view.lag[j] = hp;
      }
    }
  }

  var last = 0, acc = 0, STEP = 1 / 60;
  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    view.tick++;
    handleActions();
    if (view.screen !== 'fight') FG.input.clearTaps();
    if (view.screen === 'fight') {
      acc += dt;
      while (acc >= STEP && view.screen === 'fight') {
        acc -= STEP;
        // KO 慢动作：只放慢表现节奏，逻辑帧本身不变
        if (view.fxs.slow > 0) {
          view.slowAcc = (view.slowAcc + 1) % 2;
          if (view.slowAcc) continue;
        }
        fightStep();
      }
      if (view.screen !== 'fight') acc = 0;
    } else {
      acc = 0;
    }
    updateFx();
    FG.render.draw(ctx, view);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  FG.app = { view: view, startMatch: startMatch, setScreen: setScreen, startArcade: startArcade, arcadeAfterMatch: arcadeAfterMatch,
    SETTINGS: SETTINGS };
  FG.sfx.music('bgm_title');
})();
