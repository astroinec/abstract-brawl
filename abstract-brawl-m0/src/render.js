/* 画面：镜头、舞台、角色精灵、弹道、HUD、各界面。纯表现层。 */
(function () {
  'use strict';
  var FG = window.FG;
  var W = FG.W, H = FG.H, G = FG.GROUND_Y, SUB = FG.SUB;
  var TAU = Math.PI * 2;
  var FONT = FG.fx.FONT;
  var UI = FG.ui, UC = FG.ui.C;
  var NOW = 0;   // 当前动画帧，供不带 t 参数的部件使用
  var OT = FG.fx.outlineText;
  var ORDER = ['frog', 'roo'];
  var MODE_NAMES = { cpu: '单机 · 对战电脑', training: '训练模式', pvp: '本地双人', arcade: '闯关模式' };
  var DARK_FILTER = 'brightness(0.6) saturate(1.6) hue-rotate(250deg)';

  function X(wx) { return W / 2 + wx / SUB; }
  function Y(wy) { return G - wy / SUB; }

  function text(ctx, s, x, y, size, color, align, weight) {
    // 18px 以上用圆体展示字（单一字重，不加粗），小字用黑体加粗保证清晰
    ctx.font = size >= 18 ? size + 'px ' + FONT : (weight ? weight + ' ' : '') + size + 'px ' + UI.BODY;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 平行四边形（血条形状）；slant > 0 向右倾
  function para(ctx, x, y, w, h, slant) {
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w + slant, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  // ---------------- 镜头 ----------------
  function updateCamera(cam, m, S) {
    var a = m.p[0], b = m.p[1];
    var mid = (a.x + b.x) / 2 / SUB;
    var d = Math.abs(a.x - b.x) / SUB;
    var tz = FG.clamp(1.22 - (d - 120) / 900, 1, 1.18);
    if (S && S.superCut) {
      mid = m.p[S.superCut.p].x / SUB;
      tz = 1.32;
    }
    if (S && S.kick) tz += S.kick;   // 重击瞬间镜头推近
    cam.zoom += (tz - cam.zoom) * (S && S.kick > 0.01 ? 0.35 : 0.12);
    var lim = W / 2 - W / 2 / cam.zoom;
    var tx = FG.clamp(mid, -lim, lim);
    cam.x += (tx - cam.x) * 0.15;
    cam.x = FG.clamp(cam.x, -lim, lim);
  }

  function worldTransform(ctx, cam, shakeX, shakeY) {
    ctx.translate(W / 2 + shakeX, G + shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2 - cam.x, -G);
  }

  // ---------------- 世界绘制 ----------------
  function shadow(ctx, p) {
    var s = Math.max(0.35, 1 - (p.y / SUB) / 260);
    var w = p.fid === 'roo' ? 64 : 54;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(X(p.x), G + 3, w * s, 10 * s, 0, 0, TAU);
    ctx.fill();
  }

  function fighter(ctx, m, p, t, view) {
    shadow(ctx, p);
    if (FG.sprites.ready(p.fid)) {
      var pose = FG.sprites.poseOf(m, p, t, view.fxs);
      if (view.mirror && p.idx === 1) pose.filter = DARK_FILTER;
      if (view.fxs.superCut && view.fxs.superCut.p === p.idx) {
        ctx.save();
        ctx.shadowColor = FG.FIGHTERS[p.fid].color;
        ctx.shadowBlur = 30;
        FG.sprites.drawSprite(ctx, p.fid, pose.key, X(p.x), Y(p.y), p.facing, pose);
        ctx.restore();
      } else {
        FG.sprites.drawSprite(ctx, p.fid, pose.key, X(p.x), Y(p.y), p.facing, pose);
      }
    } else {
      FG.art.drawCreature(ctx, p.fid, X(p.x), Y(p.y), FG.art.poseOf(p, t));
    }
  }

  function drawTongue(ctx, pr, owner, t) {
    var x = X(pr.x), y = Y(pr.y);
    var mo = FG.sprites.DEFS.frog.mouth;
    var mx = X(owner.x) + owner.facing * mo[0], my = Y(owner.y) - mo[1];
    var attached = owner.state === 'atk' && owner.mv === '236A';
    ctx.save();
    ctx.lineCap = 'round';
    if (attached) {
      var cy = my - 18 + Math.sin(t / 2) * 6;
      ctx.strokeStyle = '#b2405f';
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + x) / 2, cy, x, y); ctx.stroke();
      ctx.strokeStyle = '#ff8fb1';
      ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + x) / 2, cy, x, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my - 3); ctx.quadraticCurveTo((mx + x) / 2, cy - 4, x, y - 3); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,143,177,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x - pr.vx / SUB * 6, y); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = '#ff6f9c';
    ctx.strokeStyle = '#8a2240';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, 17, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(x - 5, y - 5, 5, 3, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCuffs(ctx, pr, t) {
    var x = X(pr.x), y = Y(pr.y);
    var dir = pr.vx > 0 ? 1 : -1;
    ctx.save();
    for (var k = 1; k <= 3; k++) {
      ctx.globalAlpha = 0.18 / k;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath(); ctx.arc(x - dir * k * 14, y, 20, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(x, y);
    ctx.rotate(t * 0.35 * dir);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#4b5568';
    ctx.beginPath(); ctx.arc(-13, 0, 12, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(13, 0, 12, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#d6deea';
    ctx.beginPath(); ctx.arc(-13, 0, 12, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(13, 0, 12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#aab4c6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
    ctx.restore();
  }

  function box(ctx, r, stroke, fill) {
    var l = X(r[0]), rt = X(r[2]), top = Y(r[3]), bot = Y(r[1]);
    ctx.fillStyle = fill;
    ctx.fillRect(l, top, rt - l, bot - top);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(l, top, rt - l, bot - top);
  }

  function debugBoxes(ctx, m) {
    for (var i = 0; i < 2; i++) {
      var p = m.p[i];
      var hr = FG.sim.hurtRect(p);
      if (hr) box(ctx, hr, 'rgba(120,180,255,1)', 'rgba(120,180,255,0.16)');
      if (p.state === 'atk' && p.mv) {
        var hits = p.moves[p.mv].hits;
        for (var k = 0; k < hits.length; k++) {
          var h = hits[k];
          if (p.mf >= h.f1 && p.mf <= h.f2) box(ctx, FG.sim.worldBox(p, h.box), '#ff4d6d', 'rgba(255,77,109,0.35)');
        }
      }
    }
    m.proj.forEach(function (pr) {
      var hw = Math.floor(pr.w / 2), hh = Math.floor(pr.h / 2);
      box(ctx, [pr.x - hw, pr.y - hh, pr.x + hw, pr.y + hh], '#ff4d6d', 'rgba(255,77,109,0.35)');
    });
  }

  function drawWorld(ctx, view, t) {
    var m = view.match, S = view.fxs;
    FG.fx.drawWorldBack(ctx, S);
    FG.fx.drawGhosts(ctx, S);
    // 被攻击方先画，攻击方压在上面
    var order = (m.p[0].state === 'atk' && m.p[1].state !== 'atk') ? [1, 0] : [0, 1];
    fighter(ctx, m, m.p[order[0]], t, view);
    fighter(ctx, m, m.p[order[1]], t, view);
    for (var i = 0; i < m.proj.length; i++) {
      var pr = m.proj[i], owner = m.p[pr.owner];
      if (owner.fid === 'frog') drawTongue(ctx, pr, owner, t); else drawCuffs(ctx, pr, t);
    }
    FG.fx.drawWorldFront(ctx, S, m);
    if (view.showHitbox) debugBoxes(ctx, m);
    FG.fx.drawNumbersAndCaptions(ctx, S, m);
  }

  // ---------------- HUD ----------------
  function portraitRing(ctx, fid, x, y, r, mirror, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,4,0,0.4)';
    ctx.beginPath(); ctx.arc(x + 1, y + 5, r + 7, 0, TAU); ctx.fill();
    ctx.fillStyle = UC.cream;
    ctx.beginPath(); ctx.arc(x, y, r + 7, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = UC.ink; ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = UC.ink;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (!FG.sprites.drawPortrait(ctx, fid, x, y, r, mirror)) {
      ctx.fillStyle = FG.FIGHTERS[fid].color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function healthBar(ctx, m, i, lag, t) {
    var p = m.p[i], F = FG.FIGHTERS[p.fid];
    var left = i === 0;
    var bw = 332, bh = 24, by = 26;
    var bx = left ? 100 : W - 100 - bw;
    var r = Math.max(0, p.health / p.maxHealth), lr = FG.clamp(lag / p.maxHealth, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(10,4,0,0.4)';
    UI.rr(ctx, bx - 4, by + 1, bw + 8, bh + 8, (bh + 8) / 2); ctx.fill();
    UI.rr(ctx, bx - 5, by - 5, bw + 10, bh + 10, (bh + 10) / 2);
    ctx.fillStyle = UC.cream; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = UC.ink; ctx.stroke();
    UI.rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = '#2a1409'; ctx.fill();
    ctx.save();
    UI.rr(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
    // 余伤（红橙色，缓慢跟随）
    var lw = bw * lr;
    ctx.fillStyle = '#ff5a3a';
    if (left) ctx.fillRect(bx + bw - lw, by, lw, bh); else ctx.fillRect(bx, by, lw, bh);
    var hw = bw * r;
    var g = ctx.createLinearGradient(0, by, 0, by + bh);
    if (r < 0.3) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 5);
      g.addColorStop(0, 'rgb(255,' + Math.round(130 + 60 * pulse) + ',90)');
      g.addColorStop(1, '#c8321c');
    } else {
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.45, F.color);
      g.addColorStop(1, F.accent);
    }
    ctx.fillStyle = g;
    if (left) ctx.fillRect(bx + bw - hw, by, hw, bh); else ctx.fillRect(bx, by, hw, bh);
    // 分段刻度 + 高光，像一节节的竹筒
    ctx.fillStyle = 'rgba(42,20,9,0.26)';
    for (var k = 1; k < 10; k++) ctx.fillRect(bx + bw * k / 10 - 1, by, 2, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillRect(bx, by + 2, bw, 5);
    ctx.restore();
    ctx.restore();
    portraitRing(ctx, p.fid, left ? 52 : W - 52, 44, 30, !left, F.color);
    UI.title(ctx, p.name, left ? bx + 6 : bx + bw - 6, by + bh + 22, 18, UC.cream, UC.ink, 4, left ? 'left' : 'right');
    for (var w = 0; w < m.maxWins; w++) {
      var sx = left ? bx + bw - 12 - w * 24 : bx + 12 + w * 24;
      UI.lantern(ctx, sx, by + bh + 22, 22, w < m.wins[i], w < m.wins[i] ? Math.sin(t / 16 + w) * 0.1 : 0);
    }
  }

  function powerGauge(ctx, p, i, t) {
    var left = i === 0;
    var segW = 64, gap = 6, bh = 14, by = H - 32;
    var total = segW * 3 + gap * 2;
    var bx = left ? 78 : W - 78 - total;
    var lvl = Math.floor(p.power / 100);
    ctx.save();
    var tx = bx - 58, tw = total + 68, ty = by - 9, th = bh + 18;
    ctx.fillStyle = 'rgba(10,4,0,0.35)';
    UI.rr(ctx, tx, ty + 4, tw, th, th / 2); ctx.fill();
    UI.rr(ctx, tx, ty, tw, th, th / 2);
    ctx.fillStyle = 'rgba(52,26,12,0.9)'; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(255,240,204,0.7)'; ctx.stroke();
    for (var s2 = 0; s2 < 3; s2++) {
      var sx0 = bx + s2 * (segW + gap);
      var fill = FG.clamp((p.power - s2 * 100) / 100, 0, 1);
      var full = fill >= 1;
      UI.bar(ctx, sx0, by, segW, bh, fill, full ? '#ffe27a' : '#9fe6d6', full ? '#ff9a1f' : '#2fa598');
      if (full) {
        ctx.save();
        UI.rr(ctx, sx0, by, segW, bh, bh / 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.25 * Math.sin(t / 6 + s2)).toFixed(2) + ')';
        ctx.fillRect(sx0 + ((t * 3) % (segW + 30)) - 20, by, 14, bh);
        ctx.restore();
      }
    }
    var lab = lvl >= 3 ? 'MAX' : 'Lv' + lvl;
    UI.title(ctx, lab, bx - 28, by + bh / 2 + 1, 16, lvl >= 1 ? UC.mustard : UC.dim, UC.ink, 4);
    ctx.restore();
  }

  function timerBadge(ctx, m, t) {
    var cx = W / 2, cy = 44;
    ctx.save();
    ctx.fillStyle = 'rgba(10,4,0,0.4)';
    ctx.beginPath(); ctx.arc(cx + 1, cy + 6, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = UC.cream;
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = UC.ink; ctx.stroke();
    var g = ctx.createRadialGradient(cx, cy - 10, 4, cx, cy, 34);
    g.addColorStop(0, '#6a3a1e'); g.addColorStop(1, '#2e160a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,204,0.5)';
    for (var d = 0; d < 12; d++) {
      var a = d * TAU / 12;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29, d % 3 === 0 ? 1.8 : 1.1, 0, TAU); ctx.fill();
    }
    var secs = Math.max(0, Math.ceil(m.timer / 60));
    var ts = m.mode === 'training' ? '∞' : String(secs);
    var urgent = m.mode !== 'training' && secs <= 10 && m.phase === 'fight';
    UI.title(ctx, ts, cx, cy + 2, 32, urgent && Math.floor(t / 10) % 2 ? '#ff7a5a' : UC.cream, UC.ink, 5);
    ctx.restore();
    if (m.mode !== 'training') UI.title(ctx, '第 ' + m.round + ' 回合', cx, cy + 58, 14, UC.cream, UC.ink, 4);
  }

  function comboCounter(ctx, m, S) {
    for (var i = 0; i < 2; i++) {
      var a = m.p[i], d = m.p[1 - i];
      if (a.hitCount >= 2 && d.state === 'stun' && !d.blocked) {
        var pop = 1 + S.comboPop[i] * 0.45;
        ctx.save();
        ctx.translate(i === 0 ? 70 : W - 70, 190);
        ctx.scale(pop, pop);
        OT(ctx, String(a.hitCount), 0, 0, 58, '#ffe14d', '#3a0a00', 9);
        OT(ctx, '连击', 0, 40, 20, '#ffffff', '#3a0a00', 5);
        ctx.restore();
      }
    }
  }

  function hud(ctx, m, view, t) {
    var g = ctx.createLinearGradient(0, 0, 0, 110);
    g.addColorStop(0, 'rgba(24,10,5,0.6)');
    g.addColorStop(1, 'rgba(24,10,5,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 110);
    healthBar(ctx, m, 0, view.lag[0], t);
    healthBar(ctx, m, 1, view.lag[1], t);
    timerBadge(ctx, m, t);
    powerGauge(ctx, m.p[0], 0, t);
    powerGauge(ctx, m.p[1], 1, t);
    comboCounter(ctx, m, view.fxs);
  }

  function vsSplash(ctx, m, k, t) {
    var e = FG.clamp(k, 0, 1);
    var slide = 1 - Math.min(1, e / 0.15);
    slide = slide * slide;
    var fade = Math.min(1, (1 - e) / 0.25);
    ctx.save();
    ctx.fillStyle = 'rgba(22,9,4,' + (0.8 * fade).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 2; i++) {
      var p = m.p[i], F = FG.FIGHTERS[p.fid], left = i === 0;
      var cw = 392, ch = 320, cx0 = left ? 40 : W - 40 - cw, cy0 = 100;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(left ? -slide * 520 : slide * 520, 0);
      ctx.translate(cx0 + cw / 2, cy0 + ch / 2);
      ctx.rotate(left ? -0.035 : 0.035);
      ctx.translate(-cw / 2, -ch / 2);
      ctx.fillStyle = 'rgba(10,4,0,0.45)';
      UI.rr(ctx, 2, 10, cw, ch, 24); ctx.fill();
      UI.rr(ctx, -5, -5, cw + 10, ch + 10, 28);
      ctx.fillStyle = UC.cream; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = UC.ink; ctx.stroke();
      UI.rr(ctx, 0, 0, cw, ch, 24);
      var g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, F.color); g.addColorStop(1, F.accent);
      ctx.fillStyle = g; ctx.fill();
      ctx.save();
      UI.rr(ctx, 0, 0, cw, ch, 24); ctx.clip();
      // 半调圆点底纹
      ctx.fillStyle = 'rgba(255,255,255,0.17)';
      for (var gy = 10, row = 0; gy < ch; gy += 22, row++) {
        for (var gx = row % 2 ? 10 : 21; gx < cw; gx += 22) { ctx.beginPath(); ctx.arc(gx, gy, 3.2, 0, TAU); ctx.fill(); }
      }
      var d = FG.sprites.def(p.fid, FG.sprites.DEFS[p.fid].select);
      var pose = { sx: 1.7, sy: 1.7 + Math.sin(t / 10) * 0.02, rot: 0, ox: 0, oy: 0 };
      FG.sprites.drawSprite(ctx, p.fid, d, cw / 2, ch - 14, left ? 1 : -1, pose);
      ctx.restore();
      UI.stitch(ctx, 0, 0, cw, ch, 24, 9, UC.ink, 0.28);
      ctx.restore();
      var nx = left ? cx0 + 8 : cx0 + cw - 8;
      UI.title(ctx, F.name, nx, cy0 + ch + 40, 38, UC.cream, UC.ink, 8, left ? 'left' : 'right');
      UI.title(ctx, '「' + F.quote + '」', nx, cy0 + ch + 78, 17, UC.mustard, UC.ink, 5, left ? 'left' : 'right');
    }
    ctx.globalAlpha = fade;
    var vs = e < 0.2 ? 2.2 - e * 6 : 1 + Math.sin(t / 5) * 0.03;
    ctx.translate(W / 2, 262);
    ctx.scale(vs, vs);
    // 红色印章底
    ctx.fillStyle = 'rgba(10,4,0,0.4)';
    ctx.beginPath(); ctx.arc(2, 8, 68, 0, TAU); ctx.fill();
    ctx.fillStyle = UC.cream;
    ctx.beginPath(); ctx.arc(0, 0, 68, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = UC.ink; ctx.stroke();
    var sg = ctx.createRadialGradient(-14, -18, 6, 0, 0, 58);
    sg.addColorStop(0, '#ff7a55'); sg.addColorStop(1, '#c42f18');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.fill();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,240,204,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    UI.title(ctx, 'VS', 0, 4, 66, UC.cream, UC.ink, 10);
    ctx.restore();
  }

  function banner(ctx, m, view, t) {
    var S = view.fxs;
    if (m.phase === 'intro') {
      var pt = m.phaseT;
      var total = FG.INTRO_FRAMES + FG.VS_FRAMES;
      if (m.round === 1 && pt > 55) {
        vsSplash(ctx, m, (total - pt) / (total - 55), t);
      } else if (pt > 22) {
        var k = Math.min(1, (55 - pt) / 8);
        ctx.save();
        ctx.translate(W / 2, 240);
        ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
        OT(ctx, '第 ' + m.round + ' 回合', 0, 0, 64, '#ffffff', '#2a1409', 10);
        ctx.restore();
      } else {
        var k2 = 1 + (pt / 22) * 0.8;
        ctx.save();
        ctx.translate(W / 2, 240);
        ctx.scale(k2, k2);
        ctx.globalAlpha = Math.min(1, pt / 6 + 0.2);
        OT(ctx, 'FIGHT!', 0, 0, 84, '#ffe14d', '#7a1a00', 12);
        ctx.restore();
      }
    } else if (m.phase === 'ko') {
      var e = FG.KO_FRAMES - m.phaseT;
      if (e < 80) {
        var s = e < 10 ? 2.2 - e * 0.12 : 1 + Math.sin(e / 4) * 0.03;
        ctx.save();
        ctx.translate(W / 2, 230);
        ctx.scale(s, s);
        ctx.rotate(-0.05);
        OT(ctx, m.timer <= 0 ? 'TIME' : 'K.O.', 0, 0, 110, '#ff3b3b', '#ffffff', 10);
        if (S.perfect && e > 20) OT(ctx, 'PERFECT', 0, 80, 40, '#ffe14d', '#3a0a00', 8);
        ctx.restore();
      } else {
        var a = Math.min(1, m.phaseT / 30);
        var winText = m.winner === -2 ? '平局' : m.p[m.winner].name + ' 胜';
        ctx.save();
        ctx.globalAlpha = a;
        OT(ctx, winText, W / 2, 220, 60, '#ffffff', '#2a1409', 10);
        if (m.winner >= 0) OT(ctx, '「' + FG.FIGHTERS[m.p[m.winner].fid].winQuote + '」', W / 2, 284, 26, '#ffe14d', '#000000', 6);
        ctx.restore();
      }
    }
  }

  function fmtAdv(v) {
    if (v === null || v === undefined) return '—';
    return v > 0 ? '+' + v : String(v);
  }

  function trainingPanel(ctx, m, view) {
    var p = m.p[0];
    var id = p.lastMove;
    var mv = id ? p.moves[id] : null;
    var x = W / 2 - 304, y = 110;
    panel(ctx, x, y, 608, 122, { r: 14, alpha: 0.9, shadow: false });
    var l1 = '上次招式：' + (mv ? mv.name + '（' + id + '）' : '—');
    var l2 = '';
    if (mv) {
      var kd = mv.hits.some(function (h) { return h.kd; });
      l2 = '启动 ' + mv.startup + ' · 持续 ' + mv.active + ' · 后摇 ' + mv.recovery + ' · 全长 ' + mv.frames;
      if (mv.hits.length) l2 += '　命中 ' + (kd ? '击倒' : fmtAdv(mv.advHit)) + ' · 防御 ' + fmtAdv(mv.advBlock);
    }
    var T = view.trk, R = T.rec;
    var advTxt = T.adv === null ? '—' : fmtAdv(T.adv) + '（' + T.advKind + (T.advMove ? ' · ' + T.advMove : '') + '）';
    var l2b = '实测帧优势 ' + advTxt + '　连段 ' + T.comboHits + ' Hit / ' + T.comboDmg +
      '　最高 ' + T.maxHits + ' Hit / ' + T.maxDmg;
    var recTxt = R.mode === 'rec' ? '● 录制中 ' + (R.buf.length / 60).toFixed(1) + 's（你在操控假人）' :
      (R.mode === 'play' ? '▶ 回放中 ' + (R.idx / 60).toFixed(1) + ' / ' + (R.buf.length / 60).toFixed(1) + 's' :
        (R.buf.length ? '已录 ' + (R.buf.length / 60).toFixed(1) + 's' : '未录制'));
    var l3 = '假人：' + (R.mode === 'off' ? FG.ai.DUMMY_NAMES[FG.ai.DUMMY_MODES[view.dummyMode]] : '录像') +
      '　判定框 ' + (view.showHitbox ? '开' : '关') + '　无限血 ' + (m.infinite ? '开' : '关') + '　录像：' + recTxt;
    var l4 = 'T 假人 · H 判定框 · R 重置 · I 无限血 · O 录制假人 · P 回放录像';
    text(ctx, l1, x + 18, y + 18, 15, UC.cream, 'left', 'bold');
    text(ctx, l2, x + 18, y + 40, 13, UC.paper, 'left', 'bold');
    text(ctx, l2b, x + 18, y + 62, 13, '#8fe0d2', 'left', 'bold');
    text(ctx, l3, x + 18, y + 84, 12, R.mode === 'rec' ? '#ffb0a0' : '#e9d3a6', 'left', 'bold');
    text(ctx, l4, x + 18, y + 105, 12, UC.dim, 'left', 'bold');
  }

  // ---------------- 各界面 ----------------
  var IDLE_CAM = { x: 0, zoom: 1 };

  function menuButtons(ctx, items, index, cx, y, gap) {
    var h = gap < 50 ? 40 : 46;
    for (var i = 0; i < items.length; i++) UI.button(ctx, items[i].label, cx, y + i * gap, i === index ? 340 : 310, h, i === index, NOW);
  }

  // 底部操作提示：深色胶囊 + 奶油字
  function hint(ctx, s, x, y, size) {
    size = size || 13;
    ctx.save();
    ctx.font = 'bold ' + size + 'px ' + UI.BODY;
    var w = ctx.measureText(s).width + 30, h = size + 13;
    ctx.fillStyle = 'rgba(34,15,6,0.74)';
    UI.rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,204,0.5)'; ctx.stroke();
    ctx.fillStyle = UC.cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y + 1);
    ctx.restore();
  }

  function logo(ctx, x, y, t) {
    // 夜市招牌式标题：内嵌的空白招牌贴图 + 程序绘制的文字，轻轻摆动
    var plate = FG.sprites.ui('logo_plate');
    var pw = 400, ph = plate ? pw * plate.naturalHeight / plate.naturalWidth : 240;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t / 55) * 0.012);
    if (plate) {
      ctx.fillStyle = 'rgba(10,4,0,0.28)';
      ctx.beginPath(); ctx.ellipse(0, ph * 0.9, pw * 0.36, 9, 0, 0, TAU); ctx.fill();
      ctx.drawImage(plate, -pw / 2, 0, pw, ph);
    } else {
      UI.panel(ctx, -pw / 2 + 20, 16, pw - 40, ph * 0.75, { r: 28 });
    }
    var cy = ph * 0.42;
    UI.title(ctx, '抽象格斗', 0, cy, 62, UC.cream, UC.ink, 13);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
    UI.title(ctx, '黄色三幻神 · 夜市乱斗', 0, ph * 0.66, 17, UC.ink, 'rgba(255,240,204,0.85)', 4);
    ctx.restore();
  }

  function drawTitle(ctx, view, t) {
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.3)';
    ctx.fillRect(0, 0, W, H);
    var bob = Math.sin(t / 12) * 4;
    FG.sprites.drawSprite(ctx, 'frog', 'win', 168, 534, 1,
      { sx: 1.55, sy: 1.55 + Math.sin(t / 9) * 0.03, rot: Math.sin(t / 30) * 0.04, ox: 0, oy: bob });
    FG.sprites.drawSprite(ctx, 'roo', 'win', W - 168, 534, -1,
      { sx: 1.6, sy: 1.6 + Math.sin(t / 11) * 0.02, rot: 0, ox: 0, oy: -bob });
    logo(ctx, W / 2, 10, t);
    menuButtons(ctx, view.items, view.index, W / 2, 300, 46);
    hint(ctx, '↑/↓ 选择  ·  Enter 确认  ·  手柄 A 确认', W / 2, 522);
  }

  function statBar(ctx, label, v, x, y, color) {
    text(ctx, label, x, y, 13, UC.cream, 'left', 'bold');
    for (var i = 0; i < 5; i++) {
      UI.rr(ctx, x + 42 + i * 24, y - 5, 20, 10, 5);
      ctx.fillStyle = i < v ? color : 'rgba(255,240,204,0.14)';
      ctx.fill();
      if (i < v) { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(42,20,9,0.55)'; ctx.stroke(); }
    }
  }

  function drawSelect(ctx, view, t) {
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.52)';
    ctx.fillRect(0, 0, W, H);
    UI.title(ctx, '选择你的角色', W / 2, 40, 38, UC.cream, UC.ink, 8);
    UI.tag(ctx, MODE_NAMES[view.mode], W / 2, 82, 15, UC.mustard);
    for (var i = 0; i < ORDER.length; i++) {
      var fid = ORDER[i], F = FG.FIGHTERS[fid];
      var cx = 250 + i * 460, sel = i === view.pick;
      var x0 = cx - 215, y0 = 106, w = 430, h = 372;
      UI.panel(ctx, x0, y0, w, h, { accent: sel ? F.color : null, alpha: sel ? 0.95 : 0.66, r: 22 });
      ctx.save();
      UI.rr(ctx, x0, y0, w, h, 22);
      ctx.clip();
      var glow = ctx.createRadialGradient(x0 + 115, y0 + h - 120, 10, x0 + 115, y0 + h - 120, 200);
      glow.addColorStop(0, F.color + (sel ? '99' : '33'));
      glow.addColorStop(1, F.color + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(x0, y0, w, h);
      var bob = sel ? Math.abs(Math.sin(t / 8)) * 8 : 0;
      FG.sprites.drawSprite(ctx, fid, FG.sprites.DEFS[fid].select, x0 + 115, y0 + h - 34, 1,
        { sx: 1.45, sy: 1.45 + (sel ? Math.sin(t / 7) * 0.03 : 0), rot: 0, ox: 0, oy: bob, alpha: sel ? 1 : 0.82 });
      ctx.restore();
      var tx = x0 + 228;
      UI.title(ctx, F.name, tx, y0 + 48, 32, UC.cream, UC.ink, 7, 'left');
      text(ctx, F.tag, tx, y0 + 82, 13, F.color, 'left', 'bold');
      var sc = sel ? F.color : 'rgba(255,240,204,0.5)';
      statBar(ctx, '攻击', F.stats.atk, tx, y0 + 112, sc);
      statBar(ctx, '速度', F.stats.spd, tx, y0 + 136, sc);
      statBar(ctx, '体力', F.stats.hp, tx, y0 + 160, sc);
      statBar(ctx, '射程', F.stats.reach, tx, y0 + 184, sc);
      var sp = FG.MOVESETS[fid];
      var cells = ['236A', '623B', '214B', '214D'];
      for (var k = 0; k < cells.length; k++) {
        var cid = cells[k];
        text(ctx, cid.slice(0, 3) + '+' + cid[3] + ' ' + sp[cid].name, tx, y0 + 216 + k * 19, 12, UC.paper, 'left', 'bold');
      }
      text(ctx, '236+C ' + sp['236C'].name, tx, y0 + 216 + 4 * 19, 12, '#ffb79a', 'left', 'bold');
      UI.title(ctx, '「' + F.quote + '」', cx, y0 + h - 22, 16, UC.mustard, UC.ink, 5);
      if (sel) UI.tag(ctx, view.mode === 'pvp' ? 'P1' : '你', x0 + 36, y0 + 36, 16, F.color, -0.1);
      var clr = FG.save.data.cleared[fid];
      if (clr) UI.tag(ctx, '★ 已通关' + (clr > 1 ? ' ×' + clr : ''), x0 + w - 70, y0 + 34, 13, UC.mustard, 0.06);
    }
    var other = FG.FIGHTERS[ORDER[1 - view.pick]].name;
    var tip = view.mode === 'pvp' ? 'P2 操控：' + other : (view.mode === 'training' ? '假人：' + other :
      (view.mode === 'arcade' ? '三关：' + other + ' → 暗黑' + FG.FIGHTERS[ORDER[view.pick]].name + ' → ' + other : '电脑对手：' + other));
    if (view.mode === 'cpu') {
      var dn = FG.ai.LEVEL_NAMES[view.diff];
      UI.tag(ctx, '难度  ' + (view.diff > 1 ? '◀ ' : '') + dn + (view.diff < 3 ? ' ▶' : '') + '  (↑/↓)', W / 2, 500, 15,
        ['', '#a7e07a', UC.mustard, '#ff8a6a'][view.diff]);
      hint(ctx, '←/→ 选择角色  ·  Enter 开始  ·  Esc 返回　　' + tip, W / 2, 526, 12);
    } else {
      hint(ctx, '←/→ 选择角色  ·  Enter 开始  ·  Esc 返回　　' + tip, W / 2, 512, 13);
    }
  }

  function drawFight(ctx, view, t) {
    var m = view.match, S = view.fxs, cam = view.cam;
    var sk = S.shake * [0, 0.45, 1][FG.save.data.shake === undefined ? 2 : FG.save.data.shake];
    var sx = sk ? (Math.random() * 2 - 1) * sk : 0;
    var sy = sk ? (Math.random() * 2 - 1) * sk * 0.6 : 0;
    ctx.save();
    ctx.translate(sx * 0.4, sy * 0.4);
    FG.fx.stage(ctx, cam, t);
    ctx.restore();
    ctx.save();
    worldTransform(ctx, cam, sx, sy);
    drawWorld(ctx, view, t);
    ctx.restore();
    hud(ctx, m, view, t);
    if (view.mode === 'arcade' && view.arc) {
      OT(ctx, FG.arcade.STAGES[view.arc.stage].title + ' · ' + FG.ai.LEVEL_NAMES[FG.arcade.STAGES[view.arc.stage].level],
        W / 2, H - 24, 14, '#ffe3b0', '#24120a', 4);
    }
    if (view.mode === 'training' && !S.superCut) trainingPanel(ctx, m, view);
    FG.fx.drawScreen(ctx, S, m, t);
    banner(ctx, m, view, t);
  }

  function panel(ctx, x, y, w, h, o) { UI.panel(ctx, x, y, w, h, o); }

  function drawPause(ctx, view, t) {
    drawFight(ctx, view, t);
    ctx.fillStyle = 'rgba(24,10,5,0.6)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 240, 140, 480, 330);
    OT(ctx, '暂停', W / 2, 190, 46, '#ffffff', '#2a1409', 8);
    menuButtons(ctx, view.items, view.index, W / 2, 268, 56);
    hint(ctx, '↑/↓ 选择  ·  Enter 确认  ·  Esc 继续', W / 2, 440, 13);
  }

  function drawResult(ctx, view, t) {
    var m = view.match;
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.56)';
    ctx.fillRect(0, 0, W, H);
    var wp = m.p[m.matchWinner], F = FG.FIGHTERS[wp.fid];
    var lp = m.p[1 - m.matchWinner];
    ctx.save();
    ctx.translate(250, 330);
    ctx.rotate(t * 0.004);
    for (var i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.fillStyle = 'rgba(255,200,90,0.12)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(600, -60); ctx.lineTo(600, 60); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    FG.sprites.drawSprite(ctx, lp.fid, FG.sprites.DEFS[lp.fid].down, 430, 528, -1,
      { sx: 1.1, sy: 1.1, rot: 0, ox: 0, oy: 0 });
    ctx.restore();
    FG.sprites.drawSprite(ctx, wp.fid, FG.sprites.DEFS[wp.fid].win, 248, 530, 1,
      { sx: 1.95, sy: 1.95 + Math.sin(t / 6) * 0.04, rot: Math.sin(t / 18) * 0.04, ox: 0, oy: Math.abs(Math.sin(t / 8)) * 10 });
    panel(ctx, W / 2 + 14, 104, 430, 330, { accent: F.color, r: 22 });
    UI.tag(ctx, 'WINNER', W / 2 + 229, 146, 26, UC.mustard, -0.02);
    UI.title(ctx, F.name, W / 2 + 229, 202, 44, UC.cream, UC.ink, 8);
    UI.title(ctx, '「' + F.winQuote + '」', W / 2 + 229, 250, 19, UC.mustard, UC.ink, 5);
    text(ctx, '比分  ' + m.wins[0] + ' : ' + m.wins[1], W / 2 + 229, 288, 19, UC.cream, 'center');
    menuButtons(ctx, view.items, view.index, W / 2 + 229, 350, 52);
  }

  function drawHelp(ctx, view, t) {
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(26,12,6,0.8)';
    ctx.fillRect(0, 0, W, H);
    OT(ctx, '操作说明', W / 2, 46, 38, '#ffffff', '#2a1409', 8);
    panel(ctx, 56, 80, W - 112, 396, { r: 24 });
    var lines = [
      'P1 移动：W 跳 · S 蹲 · A 左 · D 右',
      'P1 攻击：J 轻拳 A · K 重拳 B · L 轻脚 C · ; 重脚 D',
      'P2（本地双人）：方向键移动，N M , . 依次为 A B C D',
      '搓招方向按朝向换算（前 = 面向对手）',
      '奶蛙：236+A 舌鞭 · 623+B 大笑弹跳 · 236+C 齁齁齁连打（超杀）',
      '　　　214+B 肚皮压顶（跳压，须站防）· 214+D 躺平滑铲（下段）',
      '美团袋鼠：236+A 手铐飞扣 · 623+B 胆大上勾 · 236+C 胆子真是肥嘟嘟的',
      '　　　214+B 尾巴扫街（下段）· 214+D 准时飞踹（两段击倒）',
      '超必杀消耗 1 格能量（100）。防御：按住后方，站防挡中高段，蹲防挡下段',
      '系统：66 前冲 · 44 后撤（开头无敌）· 近身 B+D 投技（被抓瞬间同按 B+D 拆投）',
      '　　　防御中 C+D 防御反击（半格能量）· 被击倒瞬间按任意键受身',
      '手柄：左摇杆或十字键移动，A B X Y 对应 A B C D，Start 暂停',
      '训练：H 判定框 · T 假人 · R 重置 · I 无限血 · O 录制假人 · P 回放录像'
    ];
    for (var i = 0; i < lines.length; i++) text(ctx, lines[i], W / 2, 108 + i * 29, 14, '#f8ebc9', 'center', 'bold');
    hint(ctx, 'Enter / Esc 返回标题', W / 2, 518, 14);
  }

  // ---------------- 闯关界面 ----------------
  function wrapLines(ctx, str, maxW, size) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    var out = [], cur = '';
    for (var i = 0; i < str.length; i++) {
      var nx = cur + str[i];
      if (ctx.measureText(nx).width > maxW && cur) { out.push(cur); cur = str[i]; }
      else cur = nx;
    }
    if (cur) out.push(cur);
    return out;
  }

  function drawStory(ctx, view, t) {
    var A = view.arc, sm = FG.arcade.stageMatch(A.fid, A.stage);
    var lines = FG.arcade.LINES[A.fid][A.stage];
    var ln = lines[Math.min(A.line, lines.length - 1)];
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.55)';
    ctx.fillRect(0, 0, W, H);
    // 关卡标题
    UI.tag(ctx, sm.title, W / 2, 54, 26, UC.lantern, -0.03, UC.cream);
    OT(ctx, '难度 ' + FG.ai.LEVEL_NAMES[sm.level] + (A.continues ? '　已续关 ' + A.continues + ' 次' : ''), W / 2, 98, 15, '#ffe3b0', '#24120a', 4);
    // 两名角色：说话的一方亮、放大
    var who = [A.fid, sm.fid1];
    for (var i = 0; i < 2; i++) {
      var speak = ln.s === i, left = i === 0;
      var pose = { sx: speak ? 1.75 : 1.6, sy: (speak ? 1.75 : 1.6) + (speak ? Math.sin(t / 7) * 0.03 : 0), rot: 0, ox: 0,
        oy: speak ? Math.abs(Math.sin(t / 9)) * 6 : 0, alpha: speak ? 1 : 0.55 };
      if (i === 1 && sm.mirror) pose.filter = DARK_FILTER;
      FG.sprites.drawSprite(ctx, who[i], speak ? 'idle' : 'block', left ? 190 : W - 190, 400, left ? 1 : -1, pose);
    }
    // 对话框
    var name = ln.s === 0 ? FG.FIGHTERS[A.fid].name : (sm.name1 || FG.FIGHTERS[sm.fid1].name);
    var col = ln.s === 0 ? FG.FIGHTERS[A.fid].color : (sm.mirror ? '#b48cff' : FG.FIGHTERS[sm.fid1].color);
    panel(ctx, 60, 388, W - 120, 124);
    UI.tag(ctx, name, ln.s === 0 ? 170 : W - 170, 380, 19, col, ln.s === 0 ? -0.02 : 0.02);
    var rows = wrapLines(ctx, ln.t, W - 200, 22);
    for (var r = 0; r < rows.length; r++) text(ctx, rows[r], W / 2, 438 + r * 32, 22, '#ffffff', 'center', 'bold');
    var blink = Math.floor(t / 20) % 2 ? '▼' : '▽';
    text(ctx, (A.line + 1) + ' / ' + lines.length + '　Enter 继续 ' + blink + '　Esc 放弃', W - 90, 496, 13, '#ecd5a8', 'right');
  }

  function drawContinue(ctx, view, t) {
    var A = view.arc;
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.74)';
    ctx.fillRect(0, 0, W, H);
    FG.sprites.drawSprite(ctx, A.fid, 'lying', 250, 470, 1, { sx: 1.8, sy: 1.8, rot: 0, ox: 0, oy: 0, alpha: 0.85 });
    panel(ctx, W / 2 + 6, 128, 404, 294, { accent: UC.lantern, r: 22 });
    UI.title(ctx, '挑战失败', W / 2 + 208, 182, 42, '#ff8a6a', UC.ink, 8);
    UI.tag(ctx, FG.arcade.STAGES[A.stage].title, W / 2 + 208, 228, 16, UC.mustard);
    text(ctx, '已续关 ' + A.continues + ' 次', W / 2 + 208, 258, 15, UC.cream, 'center');
    menuButtons(ctx, view.items, view.index, W / 2 + 208, 322, 54);
  }

  function drawEnding(ctx, view, t) {
    var A = view.arc, F = FG.FIGHTERS[A.fid];
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.52)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(250, 330);
    ctx.rotate(t * 0.004);
    for (var i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.fillStyle = 'rgba(255,205,70,0.13)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(600, -60); ctx.lineTo(600, 60); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    FG.sprites.drawSprite(ctx, A.fid, 'win', 250, 522, 1,
      { sx: 1.95, sy: 1.95 + Math.sin(t / 6) * 0.04, rot: Math.sin(t / 18) * 0.04, ox: 0, oy: Math.abs(Math.sin(t / 8)) * 10 });
    panel(ctx, W / 2 - 14, 68, 452, 404, { accent: UC.mustard, r: 22 });
    UI.title(ctx, '通关！', W / 2 + 212, 116, 48, UC.mustard, UC.ink, 9);
    UI.title(ctx, F.name + ' · 结局', W / 2 + 212, 162, 22, UC.cream, UC.ink, 5);
    var E = FG.arcade.ENDINGS[A.fid];
    var shown = Math.min(E.length, Math.floor((t - (A.endTick || 0)) / 40) + 1);
    for (var k = 0; k < shown; k++) text(ctx, E[k], W / 2 + 212, 214 + k * 36, 18, UC.paper, 'center');
    UI.tag(ctx, '续关 ' + A.continues + ' 次', W / 2 + 212, 392, 14, UC.mustard);
    hint(ctx, 'Enter 返回标题', W / 2 + 212, 436, 14);
  }

  function drawSettings(ctx, view, t) {
    FG.fx.stage(ctx, IDLE_CAM, t);
    ctx.fillStyle = 'rgba(24,10,5,0.6)';
    ctx.fillRect(0, 0, W, H);
    UI.title(ctx, '设置', W / 2, 52, 40, UC.cream, UC.ink, 8);
    panel(ctx, W / 2 - 290, 92, 580, 380, { r: 24 });
    var d = FG.save.data, items = view.settings;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], sel = i === view.index, y = 132 + i * 48;
      if (sel) {
        ctx.save();
        UI.rr(ctx, W / 2 - 262, y - 20, 524, 40, 20);
        ctx.fillStyle = 'rgba(255,201,51,0.18)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = UC.mustard; ctx.stroke();
        ctx.restore();
        UI.lantern(ctx, W / 2 - 242, y + 1, 22, true, Math.sin(t / 14) * 0.12);
      }
      var lx = W / 2 - 218;
      if (it.kind === 'back' || it.kind === 'reset') {
        var lab = it.kind === 'reset' && view.confirmReset && sel ? '再按一次 Enter 确认清除' : it.label;
        UI.title(ctx, lab, W / 2, y + 1, 21, it.kind === 'reset' ? (view.confirmReset && sel ? '#ff8a6a' : UC.paper) : UC.cream, UC.ink, 5);
        continue;
      }
      UI.title(ctx, it.label, lx, y + 1, 20, sel ? UC.mustard : UC.cream, UC.ink, 5, 'left');
      var vx = W / 2 + 40;
      if (it.kind === 'vol') {
        UI.bar(ctx, vx, y - 8, 170, 16, d[it.key], '#ffe27a', '#ff9a1f');
        text(ctx, Math.round(d[it.key] * 100) + '%', vx + 214, y + 1, 14, UC.cream, 'center', 'bold');
      } else {
        var v = it.kind === 'bool' ? (d[it.key] ? '开' : '关') : (it.kind === 'shake' ? ['关', '弱', '标准'][d.shake] : FG.ai.LEVEL_NAMES[d.diff]);
        UI.title(ctx, (sel ? '◀  ' : '') + v + (sel ? '  ▶' : ''), vx + 110, y + 1, 20, UC.cream, UC.ink, 5);
      }
    }
    var st = FG.sfx.state();
    hint(ctx, '↑/↓ 选择  ·  ←/→ 调整  ·  Esc 返回　　音频 ' + (st.loaded >= st.total ? '已就绪' : '加载中 ' + st.loaded + '/' + st.total), W / 2, 512, 13);
  }

  function draw(ctx, view) {
    var t = view.tick;
    NOW = t;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (view.screen === 'title') drawTitle(ctx, view, t);
    else if (view.screen === 'select') drawSelect(ctx, view, t);
    else if (view.screen === 'fight' && view.match) drawFight(ctx, view, t);
    else if (view.screen === 'pause' && view.match) drawPause(ctx, view, t);
    else if (view.screen === 'result' && view.match) drawResult(ctx, view, t);
    else if (view.screen === 'help') drawHelp(ctx, view, t);
    else if (view.screen === 'settings') drawSettings(ctx, view, t);
    else if (view.screen === 'story' && view.arc) drawStory(ctx, view, t);
    else if (view.screen === 'continue' && view.arc) drawContinue(ctx, view, t);
    else if (view.screen === 'ending' && view.arc) drawEnding(ctx, view, t);
    ctx.restore();
  }

  FG.render = { draw: draw, updateCamera: updateCamera };
})();
