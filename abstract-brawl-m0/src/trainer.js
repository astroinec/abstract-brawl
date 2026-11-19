/* 训练模式辅助：实测帧优势、连段伤害统计、假人动作录制与回放。
 * 只读取对局状态，不改动战斗逻辑；每个模拟帧调用一次 observe。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var REC_MAX = 600;   // 最长录制 10 秒

  function create() {
    return {
      // 帧优势：P1 的攻击接触到对手后，记录双方各自恢复行动的帧
      contact: false, aFree: -1, dFree: -1, adv: null, advKind: '', advMove: null, kd: false,
      // 连段
      comboHits: 0, comboDmg: 0, maxHits: 0, maxDmg: 0, lastDmg: 0,
      // 录制回放
      rec: { mode: 'off', buf: [], idx: 0 }
    };
  }

  function actionable(p) { return p.state === 'stand' || p.state === 'crouch' || p.state === 'air'; }

  function observe(T, m) {
    var a = m.p[0], d = m.p[1];
    for (var i = 0; i < m.events.length; i++) {
      var e = m.events[i];
      if ((e.type === 'hit' || e.type === 'block') && e.att === 0) {
        T.contact = true; T.aFree = -1; T.dFree = -1;
        T.advKind = e.type === 'hit' ? (e.kd ? '击倒' : '命中') : '防御';
        T.advMove = a.mv;
        if (e.type === 'hit') {
          if (e.combo <= 1) { T.comboHits = 0; T.comboDmg = 0; }
          T.comboHits = e.combo;
          T.comboDmg += e.dmg;
          T.lastDmg = e.dmg;
          if (T.comboHits > T.maxHits) T.maxHits = T.comboHits;
          if (T.comboDmg > T.maxDmg) T.maxDmg = T.comboDmg;
        }
      }
    }
    if (T.contact) {
      if (T.aFree < 0 && actionable(a)) T.aFree = m.frame;
      if (T.dFree < 0 && actionable(d)) T.dFree = m.frame;
      if (T.aFree >= 0 && T.dFree >= 0) {
        T.adv = T.dFree - T.aFree;
        T.contact = false;
      }
    }
  }

  // 训练模式下决定 P1 / 假人本帧的输入：录制时由玩家操控假人，回放时假人重复录下的动作
  function route(T, p1Input, dummyInput) {
    var R = T.rec;
    if (R.mode === 'rec') {
      R.buf.push(p1Input);
      if (R.buf.length >= REC_MAX) R.mode = 'off';
      return [0, p1Input];
    }
    if (R.mode === 'play' && R.buf.length) {
      var v = R.buf[R.idx];
      R.idx = (R.idx + 1) % R.buf.length;
      return [p1Input, v];
    }
    return [p1Input, dummyInput];
  }

  function toggleRecord(T) {
    var R = T.rec;
    if (R.mode === 'rec') R.mode = 'off';
    else { R.mode = 'rec'; R.buf = []; R.idx = 0; }
    return R.mode;
  }

  function togglePlay(T) {
    var R = T.rec;
    if (R.mode === 'play') R.mode = 'off';
    else if (R.buf.length) { R.mode = 'play'; R.idx = 0; }
    return R.mode;
  }

  FG.trainer = { create: create, observe: observe, route: route, toggleRecord: toggleRecord, togglePlay: togglePlay, REC_MAX: REC_MAX };
})();
