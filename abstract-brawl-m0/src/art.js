/* 角色绘制：程序化"抽象生物"占位美术，全部由 Canvas 代码绘制，后期可整体替换。
 * 坐标：原点 = 脚底中心；局部 y 向上为正；lx 为朝向前方（正 = 面向的一侧）。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var TAU = Math.PI * 2;
  var SUB = FG.SUB;

  var PAL = {
    frog: {
      body: '#ffe066', flash: '#fffbe6', light: '#fff6c2', line: '#4d4210', dark: '#6b5a14',
      eye: '#ffffff', iris: '#5fd17a', pupil: '#14231a', blush: '#ffb3a6',
      shoulder: [20, 46]
    },
    roo: {
      body: '#ffb547', flash: '#fff1d6', light: '#ffe9a8', line: '#5b3a10', dark: '#7a4d10',
      eye: '#ffffff', iris: '#3b2a1a', pupil: '#1b1420', blush: '#ff9a7a',
      shoulder: [22, 88]
    }
  };

  function drawCreature(ctx, fid, cx, gy, pose) {
    var S = PAL[fid];
    var f = pose.f || 1, k = pose.k || 1, sx = pose.sx || 1, sy = pose.sy || 1;
    var rot = pose.rot || 0, bob = pose.bob || 0;
    var cr = Math.cos(rot), sr = Math.sin(rot);
    var body = pose.flash ? S.flash : S.body;

    function P(lx, ly) {
      var x = lx * f * sx * k, y = -ly * sy * k;
      return [cx + x * cr - y * sr, gy + x * sr + y * cr];
    }
    function E(lx, ly, rx, ry, fill, stroke, lw) {
      var c = P(lx, ly);
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], Math.max(0.6, rx * k * sx), Math.max(0.6, ry * k * sy), rot, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = (lw || 3) * k; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    function L(pts, color, w) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var q = P(pts[i][0], pts[i][1]);
        if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = w * k;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    if (fid === 'frog') {
      // 奶蛙：黄色梨形身体、乳白肚皮、绿色大眼、一字嘴
      E(-19, 6, 13, 7, S.dark);
      E(19, 6, 13, 7, S.dark);
      E(-32, 46 + bob, 8, 6, body, S.line, 2.5);
      E(0, 40 + bob, 36, 30, body, S.line, 3);
      E(0, 34 + bob, 22, 18, S.light);
      E(0, 74 + bob, 32, 24, body, S.line, 3);
      E(-14, 92 + bob, 14, 14, S.eye, S.line, 2.5);
      E(14, 92 + bob, 14, 14, S.eye, S.line, 2.5);
      E(-11, 92 + bob, 9, 9, S.iris);
      E(17, 92 + bob, 9, 9, S.iris);
      E(-9, 92 + bob, 4.5, 4.5, S.pupil);
      E(19, 92 + bob, 4.5, 4.5, S.pupil);
      L([[-6, 64 + bob], [12, 64 + bob]], S.line, 2.6);
      E(-22, 66 + bob, 5, 3.5, S.blush);
      E(22, 66 + bob, 5, 3.5, S.blush);
      E(32, 46 + bob, 8, 6, body, S.line, 2.5);
    } else {
      // 美团袋鼠：大鼻子、长耳朵、圆肚皮、胆大的拳头
      var tail = [[-30, 40 + bob], [-62, 38 + bob], [-72, 16 + bob]];
      L(tail, S.line, 13);
      L(tail, body, 7);
      E(-15, 22, 10, 22, body, S.line, 2.5);
      E(15, 22, 10, 22, body, S.line, 2.5);
      E(-18, 6, 16, 7, S.dark);
      E(18, 6, 18, 7, S.dark);
      E(0, 70 + bob, 40, 50, body, S.line, 3);
      E(0, 52 + bob, 26, 19, S.light, S.line, 2.5);
      E(0, 128 + bob, 30, 26, body, S.line, 3);
      E(-12, 160 + bob, 9, 26, body, S.line, 2.5);
      E(12, 160 + bob, 9, 26, body, S.line, 2.5);
      E(-12, 157 + bob, 4.5, 17, S.blush);
      E(12, 157 + bob, 4.5, 17, S.blush);
      E(22, 116 + bob, 13, 9, S.light, S.line, 2);
      E(-9, 134 + bob, 7, 6, S.eye, S.line, 2);
      E(11, 134 + bob, 7, 6, S.eye, S.line, 2);
      E(-7, 133.5 + bob, 3.2, 3.2, S.pupil);
      E(13, 133.5 + bob, 3.2, 3.2, S.pupil);
      L([[6, 106 + bob], [12, 103 + bob], [18, 106 + bob]], S.line, 2);
      E(-27, 84 + bob, 9, 8, body, S.line, 2.5);
      E(32, 84 + bob, 11, 10, body, S.line, 2.5);
    }

    if (pose.reach) {
      var sh = S.shoulder, rx = pose.reach[0], ry = pose.reach[1];
      L([[sh[0], sh[1] + bob], [rx, ry]], S.line, 10);
      L([[sh[0], sh[1] + bob], [rx, ry]], body, 5);
      E(rx, ry, 11, 10, body, S.line, 2.5);
    }
  }

  // 由对局中的角色状态推导绘制姿态（挤压拉伸、受击闪白、出拳伸展等）
  function poseOf(p, t) {
    var sq = p.hurt.crouch[3] / p.hurt.stand[3];
    var pose = { f: p.facing, k: 1, sx: 1, sy: 1, rot: 0, bob: 0, flash: false, reach: null };
    if (p.state === 'down') {
      pose.rot = -p.facing * Math.PI / 2;
      return pose;
    }
    if (p.state === 'air') { pose.sy = 1.1; pose.sx = 0.93; }
    else if (p.stance === 'crouch') { pose.sy = sq; pose.sx = 1.08; }
    else { pose.bob = Math.sin(t / 9) * 1.2; pose.sy = 1 + Math.sin(t / 15) * 0.02; }
    if (p.state === 'stun') {
      pose.flash = !p.blocked && Math.floor(t / 3) % 2 === 0;
      pose.sx *= 0.94;
    }
    if (p.state === 'atk' && p.mv) {
      var hits = p.moves[p.mv].hits;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (p.mf >= h.f1 && p.mf <= h.f2) {
          pose.reach = [((h.box[0] + h.box[2]) / 2) / SUB, ((h.box[1] + h.box[3]) / 2) / SUB];
          pose.sx *= 1.05;
          break;
        }
      }
    }
    return pose;
  }

  // 弹道：奶蛙为舌头（从嘴部拉出），美团袋鼠为一只缝线的袋子
  function drawShot(ctx, pr, owner, t) {
    var x = FG.W / 2 + pr.x / SUB, y = FG.GROUND_Y - pr.y / SUB;
    if (owner.fid === 'frog') {
      var mx = FG.W / 2 + owner.x / SUB + owner.facing * 18, my = FG.GROUND_Y - 64;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ff9cc4';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#ff7fb0';
      ctx.beginPath(); ctx.ellipse(x, y, 12, 9, 0, 0, TAU); ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.2);
      ctx.fillStyle = '#ffb547';
      ctx.strokeStyle = '#5b3a10';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 19, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.restore();
    }
  }

  // 命中火花：黄色（命中）或蓝色（防住）放射线
  function drawSpark(ctx, fx) {
    var x = FG.W / 2 + fx.x / SUB, y = FG.GROUND_Y - fx.y / SUB;
    var a = 1 - fx.t / 18, r = 6 + fx.t * 2.4;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.strokeStyle = fx.kind === 'block' ? '#8fd3ff' : '#ffe27a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var an = i * Math.PI / 4 + 0.3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(an) * r * 0.5, y + Math.sin(an) * r * 0.5);
      ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  FG.art = {
    PAL: PAL,
    drawCreature: drawCreature,
    poseOf: poseOf,
    drawShot: drawShot,
    drawSpark: drawSpark
  };
})();
