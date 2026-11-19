/* 特效与舞台（纯表现层，不参与战斗逻辑）：
 * 命中火花、冲击环、粒子、伤害数字、防御护盾、尘土、梗字幕、残影、
 * 震屏、白闪、KO 慢动作、超杀暗屏插图卡，以及"外卖夜市"舞台。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var W = FG.W, H = FG.H, G = FG.GROUND_Y, SUB = FG.SUB;
  var TAU = Math.PI * 2;
  var FONT = '"KuaiLe","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
  var BODYFONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';

  function X(wx) { return W / 2 + wx / SUB; }
  function Y(wy) { return G - wy / SUB; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function create() {
    return {
      sparks: [], rings: [], parts: [], nums: [], dust: [], caps: [], ghosts: [], shields: [],
      lines: [], shake: 0, white: 0, slow: 0, superCut: null, koPop: 0, kick: 0,
      lastFrame: -1, prevState: ['stand', 'stand'],
      flash: [0, 0], comboPop: [0, 0], lastCombo: [0, 0]
    };
  }

  function burst(S, x, y, n, colors, spd, life, grav) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, TAU), v = rnd(spd * 0.4, spd);
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: life, max: life,
        r: rnd(2, 4.5), c: colors[i % colors.length], g: grav === undefined ? 0.22 : grav });
    }
  }

  function addDust(S, wx, n, dir) {
    for (var i = 0; i < n; i++) {
      S.dust.push({ x: X(wx) + rnd(-18, 18), y: G - 2, vx: (dir || rnd(-1, 1)) * rnd(0.6, 2.4), vy: -rnd(0.2, 1.2),
        r: rnd(6, 12), life: 26, max: 26 });
    }
  }

  function caption(S, p, text, big) {
    S.caps.push({ p: p, text: text, t: 0, life: big ? 90 : 60, big: !!big });
  }

  function onEvents(S, m, events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'hit') {
        var x = X(e.x), y = Y(e.y);
        var big = e.heavy || e.kd || e.dmg >= 90;
        S.sparks.push({ x: x, y: y, t: 0, life: big ? 18 : 13, size: big ? 1.5 : 1, rot: rnd(0, TAU), kind: 'hit' });
        S.rings.push({ x: x, y: y, t: 0, life: big ? 20 : 14, r0: 8, r1: big ? 90 : 55, c: big ? '255,214,90' : '255,255,255', w: big ? 7 : 4 });
        burst(S, x, y, big ? 16 : 8, ['#fff6c2', '#ffd166', '#ff9f43', '#ffffff'], big ? 7 : 5, big ? 30 : 22);
        var ci = Math.max(0, (e.combo || 1) - 1) % 5;
        S.nums.push({ x: x + (e.att === 0 ? 1 : -1) * ci * 16 + rnd(-6, 6), y: y - 24 - ci * 22, v: e.dmg, t: 0, life: 44, big: big });
        S.shake = Math.max(S.shake, big ? 10 : 4);
        if (big) {
          S.kick = Math.max(S.kick, e.kd ? 0.07 : 0.045);
          S.lines.push({ x: x, y: y, t: 0, life: 10, n: 14, rot: rnd(0, TAU), r0: 40, r1: 150 });
        }
        S.flash[e.def] = 6;
        if (e.kd) S.rings.push({ x: x, y: y, t: 0, life: 26, r0: 20, r1: 150, c: '255,120,90', w: 3 });
      } else if (e.type === 'block') {
        S.shields.push({ p: e.def, t: 0, life: 14 });
        S.sparks.push({ x: X(e.x), y: Y(e.y), t: 0, life: 10, size: 0.8, rot: rnd(0, TAU), kind: 'block' });
        burst(S, X(e.x), Y(e.y), 10, ['#bfe9ff', '#7fd0ff', '#ffffff'], 5, 16, 0.12);
        S.shake = Math.max(S.shake, 2);
      } else if (e.type === 'jump') {
        addDust(S, e.x, 5);
      } else if (e.type === 'land') {
        addDust(S, e.x, 7);
        var lp = m.p[e.p];
        if (lp.state === 'atk' && lp.mv === '214B' && lp.fid === 'frog') {
          S.rings.push({ x: X(e.x), y: G, t: 0, life: 22, r0: 20, r1: 190, c: '255,230,150', w: 8, flat: true });
          S.rings.push({ x: X(e.x), y: G, t: 0, life: 30, r0: 10, r1: 120, c: '255,255,255', w: 4, flat: true });
          addDust(S, e.x, 10, 1); addDust(S, e.x, 10, -1);
          S.shake = Math.max(S.shake, 9);
        }
      } else if (e.type === 'move') {
        var mv = m.p[e.p].moves[e.id];
        if (mv.caption && e.id !== '236C') caption(S, e.p, mv.caption, false);
        if (/D$|623B|236A|214B/.test(e.id)) addDust(S, m.p[e.p].x, 4, m.p[e.p].facing);
      } else if (e.type === 'dash' || e.type === 'bdash') {
        addDust(S, e.x, e.type === 'dash' ? 6 : 8, e.type === 'dash' ? -m.p[e.p].facing : m.p[e.p].facing);
      } else if (e.type === 'tech') {
        caption(S, e.p, '受身！', false);
        addDust(S, e.x, 8);
        S.rings.push({ x: X(e.x), y: G - 30, t: 0, life: 16, r0: 10, r1: 70, c: '160,230,255', w: 4 });
      } else if (e.type === 'gc') {
        var gp = m.p[e.p];
        S.rings.push({ x: X(gp.x), y: Y(gp.y) - 80, t: 0, life: 20, r0: 20, r1: 140, c: '127,208,255', w: 8 });
        S.white = Math.max(S.white, 3);
        S.shake = Math.max(S.shake, 5);
      } else if (e.type === 'throw') {
        var tp = m.p[e.p];
        caption(S, e.p, tp.moves.TH.name + '！', false);
        S.rings.push({ x: X(e.x), y: G - 60, t: 0, life: 24, r0: 16, r1: 130, c: '255,160,90', w: 6 });
        burst(S, X(e.x), G - 60, 14, ['#ffd166', '#ff9f43', '#ffffff'], 6, 26);
      } else if (e.type === 'throwbreak') {
        caption(S, e.p, '拆投！', false);
        S.sparks.push({ x: X(e.x), y: G - 90, t: 0, life: 14, size: 1.3, rot: rnd(0, TAU), kind: 'block' });
        burst(S, X(e.x), G - 90, 12, ['#ffffff', '#bfe9ff'], 6, 20);
        S.shake = Math.max(S.shake, 5);
      } else if (e.type === 'super') {
        S.superCut = { p: e.p, id: e.id, t: 0, life: FG.SUPER_FREEZE + 14 };
        caption(S, e.p, m.p[e.p].moves[e.id].caption, true);
        S.white = Math.max(S.white, 4);
      } else if (e.type === 'ko') {
        S.white = 12;
        S.slow = 70;
        S.shake = 16;
        S.koPop = 1;
        S.caps.length = 0;
        S.perfect = !!e.perfect;
      }
    }
  }

  function snapGhosts(S, m, t) {
    if (t % 3 !== 0) return;
    for (var i = 0; i < 2; i++) {
      var p = m.p[i];
      var special = p.state === 'atk' && p.mv && (p.mv === '623B' || p.mv === '236C' || p.mv === '5D' || p.mv === '214B' || p.mv === '214D');
      if (special || p.state === 'dash' || (p.state === 'bdash' && p.dashT <= FG.BDASH_INVUL) ||
          (p.state === 'stun' && !p.blocked && p.kdPending)) {
        S.ghosts.push({ fid: p.fid, x: p.x, y: p.y, facing: p.facing, pose: FG.sprites.poseOf(m, p, t, S), life: 12, max: 12,
          c: FG.FIGHTERS[p.fid].accent });
      }
    }
  }

  // sparks / rings / nums / caps / shields：t 逐帧递增，到 life 时移除
  function tick(list) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (++list[i].t >= list[i].life) list.splice(i, 1);
    }
  }

  // 每个模拟帧调用一次：招式专属粒子、倒地扬尘。只用于画面，不影响战斗逻辑
  function perFrame(S, m) {
    for (var q = 0; q < m.proj.length; q++) {
      var pr = m.proj[q], ow = m.p[pr.owner], px0 = X(pr.x), py0 = Y(pr.y);
      if (ow.fid === 'frog') {
        // 舌鞭：甩出的口水滴
        S.parts.push({ x: px0 - pr.vx / SUB * 2, y: py0 + rnd(-6, 6), vx: -pr.vx / SUB * 0.15 + rnd(-0.5, 0.5), vy: rnd(-1.5, 0.5),
          life: 22, max: 22, r: rnd(2.5, 5), c: m.frame % 3 ? '#ffd0e0' : '#ffffff', g: 0.25, round: true });
      } else {
        // 手铐：金属反光与灰色碎屑
        if (m.frame % 5 === 0) S.sparks.push({ x: px0 + rnd(-14, 14), y: py0 + rnd(-14, 10), t: 0, life: 9, size: 0.45, rot: rnd(0, TAU), kind: 'glint' });
        if (m.frame % 2 === 0) S.parts.push({ x: px0 - pr.vx / SUB * 3, y: py0 + rnd(-8, 8), vx: rnd(-0.6, 0.6), vy: rnd(-0.6, 0.6),
          life: 14, max: 14, r: rnd(1.5, 3), c: '#d8e2ee', g: 0 });
      }
    }
    for (var i = 0; i < 2; i++) {
      var p = m.p[i];
      if (p.state === 'atk' && p.mv) {
        var mv = p.moves[p.mv], f = p.mf, act = f >= mv.startup && f < mv.startup + mv.active;
        var sx = X(p.x), sy = Y(p.y);
        if (p.mv === '214B' && p.fid === 'roo' && act) addDust(S, p.x + p.facing * 60 * SUB, 3, p.facing);
        if (p.mv === '214D' && p.fid === 'frog' && act) addDust(S, p.x - p.facing * 20 * SUB, 2, -p.facing);
        if (p.mv === '2D' && act) addDust(S, p.x + p.facing * 50 * SUB, 2, p.facing);
        if (p.mv === '623B' && p.y > 0 && p.vy > 0) {
          for (var k = 0; k < 2; k++) S.parts.push({ x: sx + rnd(-26, 26), y: sy - rnd(0, 60), vx: 0, vy: rnd(2, 5),
            life: 14, max: 14, r: rnd(2, 4), c: FG.FIGHTERS[p.fid].color, g: 0, streak: true });
        }
        if (p.mv === '236C' && f < mv.startup) {
          // 超杀蓄力：粒子向角色聚拢
          var a = rnd(0, TAU), d = rnd(70, 120);
          S.parts.push({ x: sx + Math.cos(a) * d, y: sy - 80 + Math.sin(a) * d, vx: -Math.cos(a) * d / 12, vy: -Math.sin(a) * d / 12,
            life: 12, max: 12, r: rnd(2.5, 4.5), c: m.frame % 2 ? '#fff3b0' : FG.FIGHTERS[p.fid].color, g: 0 });
        }
      }
      // 刚倒地：扬尘 + 轻微震屏；弹起后再落地一次小扬尘
      if (p.state === 'down' && S.prevState[i] !== 'down') { addDust(S, p.x, 9, 1); addDust(S, p.x, 9, -1); S.shake = Math.max(S.shake, 6); }
      if (p.state === 'down' && FG.DOWN_FRAMES - p.downLeft === 14) addDust(S, p.x, 5);
      S.prevState[i] = p.state;
    }
  }

  function update(S, m, t) {
    if (m && m.frame !== S.lastFrame) { S.lastFrame = m.frame; perFrame(S, m); }
    if (m) snapGhosts(S, m, t);
    tick(S.lines);
    tick(S.sparks); tick(S.rings); tick(S.nums); tick(S.caps); tick(S.shields);
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var q = S.parts[i];
      q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= 0.96;
      if (--q.life <= 0) S.parts.splice(i, 1);
    }
    for (var j = S.dust.length - 1; j >= 0; j--) {
      var d = S.dust[j];
      d.x += d.vx; d.y += d.vy; d.vx *= 0.93; d.r += 0.5;
      if (--d.life <= 0) S.dust.splice(j, 1);
    }
    for (var k = S.ghosts.length - 1; k >= 0; k--) if (--S.ghosts[k].life <= 0) S.ghosts.splice(k, 1);
    if (S.superCut) { S.superCut.t++; if (S.superCut.t > S.superCut.life) S.superCut = null; }
    S.shake *= 0.85; if (S.shake < 0.3) S.shake = 0;
    S.kick *= 0.82; if (S.kick < 0.002) S.kick = 0;
    if (S.white > 0) S.white--;
    if (S.slow > 0) S.slow--;
    if (S.koPop > 0) S.koPop = Math.max(0, S.koPop - 0.02);
    for (var n = 0; n < 2; n++) {
      if (S.flash[n] > 0) S.flash[n]--;
      if (S.comboPop[n] > 0) S.comboPop[n] = Math.max(0, S.comboPop[n] - 0.08);
      if (m) {
        var hc = m.p[n].hitCount;
        if (hc !== S.lastCombo[n]) { if (hc >= 2) S.comboPop[n] = 1; S.lastCombo[n] = hc; }
      }
    }
  }

  // ---------------- 舞台：外卖夜市 ----------------
  var SIGNS = [
    { x: 30, w: 150, t: '奶茶', c: '#ff5fa2' },
    { x: 205, w: 130, t: '烧烤', c: '#ffb020' },
    { x: 360, w: 240, t: '外卖站', c: '#ffd21f' },
    { x: 625, w: 130, t: '24H', c: '#43e0ff' },
    { x: 780, w: 160, t: '蛙蛙铺', c: '#7dff6a' }
  ];

  function layer(ctx, k, cam, fn) {
    var z = 1 + (cam.zoom - 1) * k;
    ctx.save();
    ctx.translate(W / 2, G);
    ctx.scale(z, z);
    ctx.translate(-W / 2 - cam.x * k, -G);
    fn();
    ctx.restore();
  }

  // 灯笼位置（占背景图宽高的比例），用来叠加呼吸发光；steam 为摊位蒸汽出口
  var LANTERNS = [[.022,.183],[.043,.183],[.105,.222],[.106,.464],[.159,.474],[.169,.249],[.231,.266],[.286,.273],[.34,.269],
    [.36,.475],[.428,.277],[.562,.3],[.672,.3],[.741,.295],[.813,.274],[.89,.238],[.959,.188],[.982,.183]];
  var STEAM = [[.215,.52],[.265,.5],[.74,.53],[.80,.55]];
  var IMG_Y = 0;          // 背景图在画面中的纵向位置（画面坐标）
  var VIGNETTE = null;

  function vignette() {
    if (VIGNETTE) return VIGNETTE;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
    g.addColorStop(0, 'rgba(10,4,20,0)');
    g.addColorStop(1, 'rgba(10,4,20,0.55)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    VIGNETTE = c;
    return c;
  }

  // 用绘制好的夜市背景：多层视差由同一张图的缩放和位移模拟（背景移动量小于地面）
  function paintedStage(ctx, cam, t, img) {
    var scale = H / img.naturalHeight;               // 背景图高度正好撑满画面
    var iw = img.naturalWidth * scale;
    var extra = 1.12;                                 // 比画面略宽，留出镜头平移余量
    var dw = Math.max(W * extra, iw), dh = dw * img.naturalHeight / img.naturalWidth;
    // 地面线对齐：图中地面大约从 62% 处开始，把它对到 GROUND_Y 附近
    var groundInImg = 0.74;   // 摊位底边约在 0.70，路面从这里往下铺；角色脚踩在路面上沿略靠下
    var oy = G - dh * groundInImg + 4;
    var ox = -(dw - W) / 2;
    ctx.save();
    ctx.translate(W / 2, G);
    var z = 1 + (cam.zoom - 1) * 0.55;               // 背景只跟随一半的缩放
    ctx.scale(z, z);
    ctx.translate(-W / 2 - cam.x * 0.35, -G);
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(-200, -200, W + 400, H + 400);
    ctx.drawImage(img, ox, oy, dw, dh);
    // 灯笼呼吸发光
    ctx.globalCompositeOperation = 'lighter';
    var glow = FG.sprites.ui('fx_glow');
    for (var i = 0; i < LANTERNS.length; i++) {
      var L = LANTERNS[i], lx = ox + L[0] * dw, ly = oy + L[1] * dh;
      var k = 0.5 + 0.5 * Math.sin(t / 26 + i * 1.7);
      var r = 26 + k * 8 + (L[1] > 0.4 ? 8 : 0);
      ctx.globalAlpha = 0.18 + 0.12 * k;
      if (glow) ctx.drawImage(glow, lx - r * 2, ly - r * 2, r * 4, r * 4);
      else { ctx.fillStyle = 'rgb(255,150,70)'; ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // 摊位蒸汽：缓慢上升、扩散的柔和圆团
    for (var j = 0; j < STEAM.length; j++) {
      for (var q = 0; q < 5; q++) {
        var ph = ((t * 0.55 + q * 26 + j * 11) % 130) / 130;
        var sx = ox + STEAM[j][0] * dw + Math.sin(ph * 6 + q + j) * 10;
        var sy = oy + STEAM[j][1] * dh - ph * 70;
        ctx.fillStyle = 'rgba(255,240,225,' + (0.2 * (1 - ph) * Math.min(1, ph * 6)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 6 + ph * 16, 0, TAU); ctx.fill();
      }
    }
    // 飘落的灯笼碎光（少量，不抢戏）
    ctx.globalCompositeOperation = 'lighter';
    for (var f = 0; f < 14; f++) {
      var fx = ((f * 197 + t * (0.25 + (f % 3) * 0.08)) % (W + 80)) - 40 + ox * 0 ;
      var fy = ((f * 83 + t * (0.18 + (f % 4) * 0.05)) % (G - 40));
      ctx.fillStyle = 'rgba(255,200,120,' + (0.18 + 0.12 * Math.sin(t / 15 + f)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // 前景地面：略微加深并做一条淡淡的地平线，让角色脚下更稳
    ctx.save();
    ctx.translate(W / 2, G);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2 - cam.x, -G);
    var fl = ctx.createLinearGradient(0, G - 6, 0, H + 40);
    fl.addColorStop(0, 'rgba(30,14,40,0)');
    fl.addColorStop(0.15, 'rgba(30,14,40,0.28)');
    fl.addColorStop(1, 'rgba(14,6,24,0.72)');
    ctx.fillStyle = fl;
    ctx.fillRect(-300, G - 6, W + 600, H - G + 60);
    ctx.restore();
    // 暗角 + 整体一点暖色，统一画面气质
    ctx.drawImage(vignette(), 0, 0, W, H);
  }

  function stage(ctx, cam, t) {
    var img = FG.sprites && FG.sprites.ui && FG.sprites.ui('stage_market');
    if (img) { paintedStage(ctx, cam, t, img); return; }
    // 天空
    var g = ctx.createLinearGradient(0, 0, 0, G);
    g.addColorStop(0, '#120c2e');
    g.addColorStop(0.5, '#3b1857');
    g.addColorStop(0.85, '#b33a6b');
    g.addColorStop(1, '#ff8a5c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    layer(ctx, 0.15, cam, function () {
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      ctx.beginPath(); ctx.arc(760, 90, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.12)';
      ctx.beginPath(); ctx.arc(760, 90, 60, 0, TAU); ctx.fill();
      for (var s = 0; s < 40; s++) {
        var sx = (s * 137) % 1100 - 70, sy = (s * 53) % 200 + 10;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(t / 30 + s)).toFixed(2) + ')';
        ctx.fillRect(sx, sy, 2, 2);
      }
    });
    // 远景楼群
    layer(ctx, 0.35, cam, function () {
      for (var i = 0; i < 22; i++) {
        var bx = i * 56 - 120, bh = 120 + ((i * 71) % 7) * 26;
        ctx.fillStyle = '#1f1238';
        ctx.fillRect(bx, G - 70 - bh, 50, bh + 70);
        for (var wy = 0; wy < bh / 22; wy++) {
          for (var wx = 0; wx < 3; wx++) {
            if ((i * 7 + wy * 3 + wx) % 5 === 0) continue;
            ctx.fillStyle = ((i + wy + wx) % 4 === 0) ? 'rgba(255,200,120,0.55)' : 'rgba(255,200,120,0.18)';
            ctx.fillRect(bx + 7 + wx * 14, G - 60 - bh + wy * 22, 7, 9);
          }
        }
      }
    });
    // 中景店铺与霓虹招牌
    layer(ctx, 0.7, cam, function () {
      ctx.fillStyle = '#2a1640';
      ctx.fillRect(-160, G - 150, W + 320, 150);
      for (var i = 0; i < SIGNS.length; i++) {
        var s = SIGNS[i];
        var on = Math.sin(t / 9 + i * 2.3) > -0.92;
        ctx.fillStyle = '#170c26';
        ctx.fillRect(s.x, G - 140, s.w, 120);
        ctx.fillStyle = on ? 'rgba(255,220,150,0.16)' : 'rgba(255,220,150,0.05)';
        ctx.fillRect(s.x + 10, G - 92, s.w - 20, 72);
        ctx.save();
        ctx.font = 'bold 26px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = s.c;
        ctx.shadowBlur = on ? 18 : 0;
        ctx.fillStyle = on ? s.c : 'rgba(120,90,140,0.8)';
        ctx.fillText(s.t, s.x + s.w / 2, G - 116);
        ctx.restore();
        ctx.strokeStyle = on ? s.c : 'rgba(120,90,140,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x + 6, G - 136, s.w - 12, 40);
      }
      // 灯笼串
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var lx = -160; lx <= W + 160; lx += 8) ctx.lineTo(lx, G - 170 + Math.sin(lx / 80) * 10);
      ctx.stroke();
      for (var li = -150; li < W + 160; li += 64) {
        var ly = G - 166 + Math.sin(li / 80) * 10;
        ctx.fillStyle = 'rgba(255,90,70,0.95)';
        ctx.beginPath(); ctx.ellipse(li, ly, 8, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,170,110,' + (0.25 + 0.15 * Math.sin(t / 12 + li)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(li, ly, 18, 0, TAU); ctx.fill();
      }
    });
    // 近景围观人群剪影
    layer(ctx, 0.88, cam, function () {
      ctx.fillStyle = '#12091e';
      for (var c = 0; c < 26; c++) {
        var cx = c * 44 - 150, hop = Math.max(0, Math.sin(t / 8 + c * 1.7)) * 3;
        ctx.beginPath();
        ctx.arc(cx, G - 44 - hop - (c % 3) * 4, 11, 0, TAU);
        ctx.fill();
        ctx.fillRect(cx - 14, G - 34 - hop - (c % 3) * 4, 28, 40);
      }
    });
    // 地面
    layer(ctx, 1, cam, function () {
      var fl = ctx.createLinearGradient(0, G, 0, H);
      fl.addColorStop(0, '#3a2350');
      fl.addColorStop(1, '#120a1c');
      ctx.fillStyle = fl;
      ctx.fillRect(-200, G, W + 400, H - G + 40);
      ctx.fillStyle = 'rgba(255,210,31,0.55)';
      for (var m = -200; m < W + 200; m += 90) ctx.fillRect(m, G + 54, 48, 5);
      for (var r = 0; r < SIGNS.length; r++) {
        var s2 = SIGNS[r];
        var rg = ctx.createLinearGradient(0, G, 0, G + 70);
        rg.addColorStop(0, s2.c + '55');
        rg.addColorStop(1, s2.c + '00');
        ctx.fillStyle = rg;
        ctx.fillRect(s2.x + 10, G, s2.w - 20, 70);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (var x = -1200; x <= 2200; x += 110) {
        ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.35, G); ctx.lineTo(x, H + 40); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-200, G, W + 400, 2);
    });
  }

  // ---------------- 世界层特效（在镜头变换内绘制） ----------------
  function star(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function drawWorldBack(ctx, S) {
    for (var i = 0; i < S.dust.length; i++) {
      var d = S.dust[i];
      ctx.fillStyle = 'rgba(210,190,230,' + (0.35 * d.life / d.max).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
    }
  }

  function drawGhosts(ctx, S) {
    for (var i = 0; i < S.ghosts.length; i++) {
      var g = S.ghosts[i];
      var pose = {};
      for (var k in g.pose) pose[k] = g.pose[k];
      pose.flash = 0; pose.tint = 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      FG.sprites.drawSprite(ctx, g.fid, pose.key, X(g.x), Y(g.y), g.facing, pose, 0.28 * g.life / g.max);
      ctx.restore();
    }
  }

  function drawWorldFront(ctx, S, m) {
    for (var s = 0; s < S.shields.length; s++) {
      var sh = S.shields[s], p = m.p[sh.p], k = sh.t / sh.life;
      var cx = X(p.x) + p.facing * 34, cy = Y(p.y) - 80;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#8fdcff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (var h = 0; h < 6; h++) {
        var a = h * Math.PI / 3 + Math.PI / 6;
        ctx.lineTo(cx + Math.cos(a) * (40 + k * 16) * 0.6, cy + Math.sin(a) * (40 + k * 16));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(127,208,255,0.18)';
      ctx.fill();
      ctx.restore();
    }
    for (var r = 0; r < S.rings.length; r++) {
      var rg = S.rings[r], q = rg.t / rg.life;
      ctx.strokeStyle = 'rgba(' + rg.c + ',' + (1 - q).toFixed(3) + ')';
      ctx.lineWidth = rg.w * (1 - q) + 1;
      var rr = rg.r0 + (rg.r1 - rg.r0) * Math.sqrt(q);
      ctx.beginPath();
      if (rg.flat) ctx.ellipse(rg.x, rg.y, rr, rr * 0.22, 0, 0, TAU); else ctx.arc(rg.x, rg.y, rr, 0, TAU);
      ctx.stroke();
    }
    for (var ln = 0; ln < S.lines.length; ln++) {
      // 重击冲击速度线
      var L = S.lines[ln], lu = L.t / L.life;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - lu)).toFixed(3) + ')';
      ctx.lineWidth = 3 * (1 - lu) + 1;
      for (var li = 0; li < L.n; li++) {
        var la = L.rot + li * TAU / L.n, r0 = L.r0 + lu * 40, r1 = L.r1 + lu * 60;
        ctx.beginPath();
        ctx.moveTo(L.x + Math.cos(la) * r0, L.y + Math.sin(la) * r0);
        ctx.lineTo(L.x + Math.cos(la) * r1, L.y + Math.sin(la) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (var i = 0; i < S.sparks.length; i++) {
      var sp = S.sparks[i], u = sp.t / sp.life;
      var tex = FG.sprites.ui(sp.kind === 'block' ? 'fx_block' : (sp.kind === 'glint' ? 'fx_hit' : (sp.size > 1.2 ? 'fx_heavy' : 'fx_hit')));
      if (tex) {
        // 贴图版：先快速放大再缓慢消散，轻微旋转；黑底贴图用 lighter 叠加，黑色自动透明
        var sz = (sp.kind === 'glint' ? 46 : 96) * sp.size * (0.55 + 0.75 * Math.min(1, u * 3.2));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, (1 - u) * 1.4);
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.kind === 'block' ? 0 : sp.rot * 0.35);
        ctx.drawImage(tex, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = sp.kind === 'block' ? '#8fdcff' : (sp.kind === 'glint' ? '#eef6ff' : '#fff3b0');
      star(ctx, sp.x, sp.y, (34 + 30 * u) * sp.size, (9 + 6 * u) * sp.size, sp.kind === 'glint' ? 4 : 6, sp.rot + u);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      star(ctx, sp.x, sp.y, (20 + 12 * u) * sp.size, (6) * sp.size, 4, sp.rot * 2 - u);
      ctx.fill();
      ctx.restore();
    }
    for (var j = 0; j < S.parts.length; j++) {
      var pt = S.parts[j];
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.c;
      if (pt.round) { ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill(); }
      else if (pt.streak) ctx.fillRect(pt.x - 1.5, pt.y - pt.r * 4, 3, pt.r * 8);
      else ctx.fillRect(pt.x - pt.r / 2, pt.y - pt.r / 2, pt.r, pt.r);
    }
    ctx.globalAlpha = 1;
  }

  function outlineText(ctx, s, x, y, size, fill, stroke, lw, align) {
    ctx.font = size >= 17 ? size + 'px ' + FONT : 'bold ' + size + 'px ' + BODYFONT;   // 大字用圆体，小字用黑体保清晰
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  }

  function drawNumbersAndCaptions(ctx, S, m) {
    for (var i = 0; i < S.nums.length; i++) {
      var n = S.nums[i], u = n.t / n.life;
      var sc = n.t < 6 ? 1 + (6 - n.t) * 0.12 : 1;
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, u - 0.6) / 0.4;
      outlineText(ctx, String(n.v), n.x, n.y - u * 40, (n.big ? 30 : 22) * sc, n.big ? '#ffd166' : '#ffffff', '#2a0f12', 5);
      ctx.restore();
    }
    for (var c = 0; c < S.caps.length; c++) {
      var cp = S.caps[c], p = m.p[cp.p];
      var a = cp.t < 8 ? cp.t / 8 : (cp.t > cp.life - 12 ? (cp.life - cp.t) / 12 : 1);
      var pop = cp.t < 8 ? 1.25 - cp.t * 0.03 : 1;
      var hh = p.fid === 'roo' ? 210 : 190;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      outlineText(ctx, cp.text, X(p.x), Y(p.y) - hh - (cp.big ? 10 : 0), (cp.big ? 30 : 22) * pop,
        cp.big ? '#ffe14d' : '#ffffff', '#000000', cp.big ? 7 : 5);
      ctx.restore();
    }
  }

  // ---------------- 屏幕层特效 ----------------
  function drawScreen(ctx, S, m, t) {
    if (S.superCut && m) {
      var sc = S.superCut, u = sc.t, L = sc.life;
      var a = u < 6 ? u / 6 : (u > L - 10 ? (L - u) / 10 : 1);
      var p = m.p[sc.p];
      var F = FG.FIGHTERS[p.fid];
      var left = sc.p === 0;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a) * 0.72;
      ctx.fillStyle = '#05020c';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, a);
      // 放射速度线
      ctx.strokeStyle = 'rgba(255,230,140,0.35)';
      ctx.lineWidth = 2;
      var cx = left ? 280 : W - 280, cy = 270;
      for (var i = 0; i < 36; i++) {
        var an = i * TAU / 36 + t * 0.02;
        var r1 = 160 + ((i * 37 + t * 9) % 120);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1);
        ctx.lineTo(cx + Math.cos(an) * 700, cy + Math.sin(an) * 700);
        ctx.stroke();
      }
      // 斜条带 + 插图卡
      var slide = u < 10 ? (1 - u / 10) : 0;
      var bandY = 150;
      ctx.save();
      ctx.translate(0, bandY);
      ctx.transform(1, -0.08, 0, 1, 0, 0);
      var bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, F.accent);
      bg.addColorStop(1, F.color);
      ctx.fillStyle = bg;
      ctx.fillRect(-40, 40, W + 80, 170);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (var st = 0; st < 30; st++) ctx.fillRect(-40 + ((st * 70 + t * 14) % (W + 120)), 40, 24, 170);
      ctx.restore();
      var img = FG.sprites.cutinImage(p.fid);
      var cutDef = FG.sprites.def(p.fid, FG.sprites.DEFS[p.fid].cutin);
      if (img && cutDef.cut) {
        var ch = 330, cw = ch * img.naturalWidth / img.naturalHeight;
        var cx0 = left ? 30 - slide * 420 : W - 30 - cw + slide * 420;
        var cy0 = 360 - ch + slide * 60;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-40, 0, W + 80, 362);
        ctx.clip();
        ctx.translate(cx0 + (left ? cw : 0), cy0);
        if (left) ctx.scale(-1, 1);   // AI 插图里角色朝左，左侧玩家翻转成朝向画面中央
        // 先画一层放大的纯色剪影当描边，再画本体
        var sil = FG.sprites.cutinSilhouette(p.fid);
        if (sil) {
          ctx.globalAlpha *= 0.95;
          ctx.drawImage(sil, -8, -8, cw + 16, ch + 16);
          ctx.globalAlpha /= 0.95;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        ctx.restore();
      } else if (img) {
        var ih = 300, iw = ih * img.naturalWidth / img.naturalHeight;
        var ix = left ? 40 - slide * 400 : W - 40 - iw + slide * 400;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ix - 6, 110 - 6, iw + 12, ih + 12);
        ctx.restore();
        ctx.drawImage(img, ix, 110, iw, ih);
      }
      var tx = left ? W - 60 : 60, al = left ? 'right' : 'left';
      outlineText(ctx, '超必杀', tx + (left ? 1 : -1) * slide * 300, 210, 34, '#ffffff', '#000000', 7, al);
      outlineText(ctx, p.moves[sc.id].name, tx + (left ? 1 : -1) * slide * 500, 262, 46, '#ffe14d', '#3a0a00', 9, al);
      ctx.restore();
    }
    if (S.white > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (S.white / 14).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  FG.fx = {
    create: create,
    onEvents: onEvents,
    update: update,
    stage: stage,
    drawWorldBack: drawWorldBack,
    drawGhosts: drawGhosts,
    drawWorldFront: drawWorldFront,
    drawNumbersAndCaptions: drawNumbersAndCaptions,
    drawScreen: drawScreen,
    outlineText: outlineText,
    FONT: FONT
  };
})();
