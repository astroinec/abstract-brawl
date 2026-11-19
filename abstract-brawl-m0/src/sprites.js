/* 精灵：AI 重绘姿势及保留的网络二创 PNG（assets/），按角色状态选图，再叠加程序补间
 * （呼吸、走路颠簸、蓄力后仰、出招前冲、受击抖动、倒地旋转、闪白）。
 * 图片未加载完成时回退到 art.js 的程序化绘制。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var SUB = FG.SUB;

  // h = 画面中的显示高度（px）；face = 素材本身朝向（1 朝右，-1 朝左）
  // 对战姿势全部为 AI 重绘的统一软胶风格（参考网络二创形象）；超杀插图卡保留二创原图
  // v2 姿势表与 v1 的像素比例不同（1264 vs 1536 宽），h 已按同一角色尺寸换算
  var DEFS = {
    frog: {
      idle:   { src: 'frogx_idle',   h: 158, face: 1 },
      punch:  { src: 'frogx_punch',  h: 160, face: 1 },
      kick:   { src: 'frogx_kick',   h: 155, face: 1 },
      hurt:   { src: 'frogx_hurt',   h: 153, face: 1 },
      block:  { src: 'frogx_block',  h: 159, face: 1 },
      crouch: { src: 'frogx_crouch', h: 128, face: 1 },
      jump:   { src: 'frogx_jump',   h: 157, face: 1 },
      win:    { src: 'frogx_win',    h: 155, face: 1 },
      tongue: { src: 'frogx_tongue', h: 138, face: 1 },
      rise:   { src: 'frogx_rise',   h: 176, face: 1 },
      flop:   { src: 'frogx_flop',   h: 92,  face: 1 },
      slide:  { src: 'frogx_slide',  h: 96,  face: 1 },
      jab:    { src: 'frogx_jab',    h: 157, face: 1 },
      lkick:  { src: 'frogx_lkick',  h: 154, face: 1 },
      hurt2:  { src: 'frogx_hurt2',  h: 151, face: 1 },
      lying:  { src: 'frogx_lying',  h: 89,  face: 1 },
      inhale: { src: 'frogx_inhale', h: 160, face: 1 },
      charge: { src: 'frogx_charge', h: 144, face: 1 },
      getup:  { src: 'frogx_getup',  h: 127, face: 1 },
      dash:   { src: 'frogx_dash',   h: 149, face: 1 },
      gold:   { src: 'frogx_cutin',  h: 300, face: 1, card: true, cut: true },
      laugh: 'win', crouchSy: 1, air: 'jump', down: 'lying', select: 'idle',
      // 每招三段：pre 蓄力（启动帧）、act 判定（多段技按段号取）、rec 收招
      moves: {
        '5A': { act: 'jab' }, '5B': { pre: 'charge', act: 'punch', rec: 'jab' },
        '5C': { act: 'lkick' }, '5D': { pre: 'charge', act: 'kick', rec: 'lkick' },
        '2A': 'crouch', '2B': 'crouch', '2C': 'crouch', '2D': 'slide', jA: 'punch', jC: 'kick',
        '236A': { pre: 'inhale', act: 'tongue' }, '623B': { pre: 'charge', act: 'rise', rec: 'jump' },
        '214B': { pre: 'charge', act: 'flop', rec: 'getup' }, '214D': { pre: 'dash', act: 'slide', rec: 'getup' },
        '236C': { pre: 'charge', act: ['punch', 'jab', 'kick'], rec: 'win' },
        TH: { act: 'jab', rec: 'charge' }, GC: { pre: 'block', act: 'kick' } },
      mouth: [20, 128],
      portrait: { src: 'frogx_idle', cx: 0.52, cy: 0.15, r: 0.2 },
      cutin: 'gold'
    },
    roo: {
      idle:    { src: 'roox_idle',    h: 178, face: 1 },
      punch:   { src: 'roox_punch',   h: 179, face: 1 },
      kick:    { src: 'roox_kick',    h: 179, face: 1 },
      hurt:    { src: 'roox_hurt',    h: 173, face: 1 },
      block:   { src: 'roox_block',   h: 176, face: 1 },
      crouch:  { src: 'roox_crouch',  h: 146, face: 1 },
      jump:    { src: 'roox_jump',    h: 176, face: 1 },
      win:     { src: 'roox_win',     h: 172, face: 1 },
      throw:   { src: 'roox_throw',   h: 162, face: 1 },
      rise:    { src: 'roox_rise',    h: 175, face: 1 },
      sweep:   { src: 'roox_sweep',   h: 140, face: 1 },
      flykick: { src: 'roox_flykick', h: 156, face: 1 },
      jab:     { src: 'roox_jab',     h: 168, face: 1 },
      lkick:   { src: 'roox_lkick',   h: 171, face: 1 },
      hurt2:   { src: 'roox_hurt2',   h: 149, face: 1 },
      lying:   { src: 'roox_lying',   h: 67,  face: 1 },
      windup:  { src: 'roox_windup',  h: 163, face: 1 },
      charge:  { src: 'roox_charge',  h: 163, face: 1 },
      getup:   { src: 'roox_getup',   h: 148, face: 1 },
      dash:    { src: 'roox_dash',    h: 162, face: 1 },
      fat:     { src: 'roox_cutin',   h: 300, face: 1, card: true, cut: true },
      crouchSy: 1, air: 'jump', down: 'lying', select: 'idle',
      moves: {
        '5A': { act: 'jab' }, '5B': { pre: 'windup', act: 'punch', rec: 'jab' },
        '5C': { act: 'lkick' }, '5D': { pre: 'charge', act: 'kick', rec: 'lkick' },
        '2A': 'crouch', '2B': 'crouch', '2C': 'crouch', '2D': 'sweep', jA: 'punch', jC: 'flykick',
        '236A': { pre: 'windup', act: 'throw' }, '623B': { pre: 'charge', act: 'rise', rec: 'jump' },
        '214B': { pre: 'charge', act: 'sweep', rec: 'crouch' }, '214D': { pre: 'dash', act: 'flykick', rec: 'jump' },
        '236C': { pre: 'charge', act: ['jab', 'punch', 'kick'], rec: 'win' },
        TH: { act: 'jab', rec: 'charge' }, GC: { pre: 'block', act: 'kick' } },
      mouth: [30, 120],
      portrait: { src: 'roox_idle', cx: 0.56, cy: 0.3, r: 0.3 },
      cutin: 'fat'
    }
  };

  var store = {};       // src -> { img, ok, white }
  var pending = 0;

  function silhouette(img, color) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function load(src) {
    if (store[src]) return store[src];
    var rec = { img: new Image(), ok: false, white: null, blue: null };
    store[src] = rec;
    pending++;
    rec.img.onload = function () {
      rec.ok = true;
      pending--;
      // 预生成剪影：白色用于受击闪白，蓝色用于防御光
      try {
        rec.white = silhouette(rec.img, '#ffffff');
        rec.blue = silhouette(rec.img, '#7fd0ff');
      } catch (e) { rec.white = null; rec.blue = null; }
      if (/^(stage_market|fx_)/.test(src)) { rec.white = null; rec.blue = null; }
    };
    rec.img.onerror = function () { pending--; rec.ok = false; };
    // 单文件试玩版会把素材以 data URI 注入 window.__FG_ASSETS__，源码版仍读 assets/
    var inline = window.__FG_ASSETS__ && window.__FG_ASSETS__[src];
    rec.img.src = inline || ('assets/' + src + (src === 'stage_market' ? '.jpg' : '.png'));
    return rec;
  }

  Object.keys(DEFS).forEach(function (fid) {
    var d = DEFS[fid];
    Object.keys(d).forEach(function (k) {
      if (d[k] && typeof d[k] === 'object' && d[k].src) load(d[k].src);
    });
  });

  // 界面素材（舞台、特效贴图、标题徽章）：非角色姿势，也走同一套加载与内嵌机制
  var UI_ASSETS = ['stage_market', 'fx_hit', 'fx_heavy', 'fx_block', 'fx_glow', 'logo_plate'];
  UI_ASSETS.forEach(function (n) { load(n); });
  function ui(name) {
    var r = store[name];
    return r && r.ok ? r.img : null;
  }

  function def(fid, key) {
    var d = DEFS[fid];
    var v = d[key];
    if (typeof v === 'string') v = d[v];
    return v && v.src ? v : d.idle;
  }

  function ready(fid) {
    var d = DEFS[fid];
    return store[d.idle.src] && store[d.idle.src].ok;
  }

  // 招式在当前阶段用哪张图：字符串 = 全程一张；对象 = 分 pre/act/rec，act 可按多段技的段号取数组
  function moveKey(spec, phase, mv, f) {
    if (!spec) return 'idle';
    if (typeof spec === 'string') return spec;
    var act = spec.act;
    if (Array.isArray(act)) {
      var idx = 0;
      for (var i = 0; i < mv.hits.length; i++) if (f >= mv.hits[i].f1) idx = i;
      act = act[Math.min(idx, act.length - 1)];
    }
    if (phase === 'pre') return spec.pre || act;
    if (phase === 'rec') {
      // 收招前半段保持出招姿势，后半段才换收招图，避免一出手就缩回
      if (!spec.rec) return act;
      return f - (mv.startup + mv.active - 1) > mv.recovery / 2 ? spec.rec : act;
    }
    return act;
  }

  function ease(t) { return t < 0 ? 0 : (t > 1 ? 1 : t * t * (3 - 2 * t)); }

  // 由角色状态推导：选哪张图 + 补间参数（ox/oy 为朝向前方/向上的像素偏移）
  function poseOf(m, p, t, view) {
    var D = DEFS[p.fid];
    var pose = { key: 'idle', sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, flash: 0, alpha: 1, tint: 0 };
    var won = m.phase === 'ko' && m.winner === p.idx && m.phaseT < FG.KO_FRAMES - 40;
    if (won || (m.phase === 'matchEnd' && m.matchWinner === p.idx)) {
      pose.key = 'win';
      pose.oy = Math.abs(Math.sin(t / 7)) * 10;
      pose.sy = 1 + Math.sin(t / 3.5) * 0.03;
      return pose;
    }
    if (p.state === 'down') {
      var el = FG.DOWN_FRAMES - p.downLeft;
      if (p.downLeft <= 12 && m.phase !== 'ko' && m.phase !== 'matchEnd') {
        pose.key = 'getup';
        pose.sy = 1 - 0.04 * (p.downLeft / 12);
        if (p.teched) { pose.rot = -0.25 * (p.downLeft / FG.TECH_RISE); pose.alpha = 0.85; }
        return pose;
      }
      pose.key = D.down;
      // 摔地弹一下：前 14 帧做一次衰减的跳动，并在第一次着地时被压扁
      if (el < 14) {
        var bk = el / 14;
        pose.oy = Math.abs(Math.sin(bk * Math.PI)) * 22 * (1 - bk);
        if (el < 3) { pose.sy = 0.86; pose.sx = 1.08; }
      }
      return pose;
    }
    if (p.state === 'stun') {
      if (p.blocked) {
        pose.key = p.stance === 'crouch' ? 'crouch' : 'block';
        pose.rot = -0.06;
        pose.ox = -4;
        pose.tint = 0.45;
      } else {
        var hard = p.kdPending || p.stunLeft >= 20;
        pose.key = hard ? 'hurt2' : 'hurt';
        pose.rot = (hard ? -0.08 : -0.18) - Math.min(0.2, p.stunLeft * 0.006);
        pose.ox = Math.sin(t * 1.9) * 4;
        pose.sx = 0.96;
        pose.sy = 1.03;
        if (p.stance === 'crouch') pose.sy *= 0.8;
      }
      if (view && view.flash[p.idx] > 0) pose.flash = view.flash[p.idx] / 6;
      return pose;
    }
    if (p.state === 'atk' && p.mv) {
      var mv = p.moves[p.mv];
      var a1 = mv.startup, a2 = mv.startup + mv.active - 1;
      var f = p.mf;
      var wind, hitK, phase;
      if (f < a1) { wind = ease(f / Math.max(1, a1)); hitK = 0; phase = 'pre'; }
      else if (f <= a2) { wind = 0; hitK = 1; phase = 'act'; }
      else { wind = 0; hitK = 1 - ease((f - a2) / Math.max(1, mv.recovery)); phase = 'rec'; }
      pose.key = moveKey(D.moves[p.mv], phase, mv, f);
      pose.phase = phase;
      var heavy = /B|D/.test(p.mv);
      var kick = /C|D/.test(p.mv) && p.mv.length === 2;
      var preImg = phase === 'pre' && D.moves[p.mv] && D.moves[p.mv].pre;
      if (preImg) wind *= 0.35;
      pose.rot = -0.1 * wind + (kick ? 0.28 : 0.16) * hitK;
      pose.ox = -6 * wind + (heavy ? 26 : 16) * hitK;
      pose.sx = 1 - 0.05 * wind + 0.1 * hitK;
      pose.sy = 1 + 0.04 * wind - 0.06 * hitK;
      if (mv.stance === 'crouch') { pose.sy *= (D.crouchSy < 1 ? 0.72 : 0.95); pose.rot *= 0.5; }
      if (p.mv === '236A') { pose.rot = -0.06 * hitK; pose.ox = 6 * hitK; pose.sy = 1 + 0.05 * Math.sin(f / 2); }
      if (p.mv === '623B') { pose.rot = (p.y > 0 ? -0.12 : -0.04) * hitK; pose.sy = 1.06; pose.sx = 0.96; }
      if (p.mv === '214B' && p.fid === 'frog') {
        // 肚皮压顶：上升时抬头，下落时向前俯冲
        pose.rot = p.vy > 0 ? -0.25 : 0.22;
        pose.ox = 0; pose.sx = 1; pose.sy = 1;
      }
      if (p.mv === '214D' && p.fid === 'frog') { pose.rot = 0; pose.sy = 1; pose.sx = 1 + 0.06 * hitK; pose.ox = 4 * hitK; }
      if (p.mv === '214B' && p.fid === 'roo') {
        // 尾巴扫街：横向拧身，蓄力时向后缩
        pose.rot = 0.05 * hitK; pose.sy = 1; pose.sx = 1 + 0.08 * hitK; pose.ox = -8 * wind + 10 * hitK;
      }
      if (p.mv === '214D' && p.fid === 'roo') { pose.rot = p.y > 0 ? -0.12 : 0; pose.sy = 1; pose.ox = 10 * hitK; }
      if (p.mv === '236C') {
        pose.sy = 1 + Math.sin(f * 0.9) * 0.07;
        pose.sx = 1 - Math.sin(f * 0.9) * 0.05;
        pose.ox = 18 * hitK + Math.sin(f * 1.7) * 3;
      }
      return pose;
    }
    if (p.state === 'dash') {
      pose.key = 'dash';
      pose.rot = 0.08;
      pose.oy = Math.abs(Math.sin(p.dashT * 0.5)) * 4;
      return pose;
    }
    if (p.state === 'bdash') {
      // 后撤：小跳向后，无敌帧内半透明
      pose.key = 'jump';
      var bk = p.dashT / FG.BDASH_FRAMES;
      pose.oy = Math.sin(Math.min(1, bk * 1.4) * Math.PI) * 26;
      pose.rot = -0.14;
      pose.sy = 0.96;
      if (p.dashT <= FG.BDASH_INVUL) pose.alpha = 0.72;
      return pose;
    }
    if (p.state === 'air') {
      pose.key = D.air;
      var up = p.vy > 0;
      pose.sy = up ? 1.08 : 0.97;
      pose.sx = up ? 0.94 : 1.02;
      pose.rot = p.vx === 0 ? 0 : (p.vx * p.facing > 0 ? 0.12 : -0.12);
      return pose;
    }
    if (p.stance === 'crouch') {
      pose.key = 'crouch';
      pose.sy = 1 + Math.sin(t / 14) * 0.015;
      if (p.holdBack) pose.tint = 0.18;
      return pose;
    }
    // 站立 / 行走
    if (p.vx !== 0) {
      var ph = t * 0.32;
      if (p.vx * p.facing > 0 && D.dash) pose.key = 'dash';
      pose.oy = Math.abs(Math.sin(ph)) * 5;
      pose.rot = Math.sin(ph) * 0.05 + (p.vx * p.facing > 0 ? 0.05 : -0.05);
      pose.sy = 1 - Math.abs(Math.sin(ph)) * 0.03;
    } else {
      pose.sy = 1 + Math.sin(t / 14) * 0.018;
      pose.sx = 1 - Math.sin(t / 14) * 0.012;
    }
    if (p.holdBack && m.p[1 - p.idx].state === 'atk') { pose.key = 'block'; pose.tint = 0.22; pose.rot = 0; pose.oy = 0; }
    return pose;
  }

  // 在 (sx0, gy) 处画角色（画面坐标，gy 为脚底）
  function drawSprite(ctx, fid, key, sx0, gy, facing, pose, extraAlpha) {
    var dd = (typeof key === 'object') ? key : def(fid, key);
    var rec = store[dd.src];
    if (!rec || !rec.ok) return false;
    var img = rec.img;
    var h = dd.h, w = h * img.naturalWidth / img.naturalHeight;
    var flip = facing * dd.face;
    ctx.save();
    ctx.globalAlpha = (pose.alpha === undefined ? 1 : pose.alpha) * (extraAlpha === undefined ? 1 : extraAlpha);
    // 横躺后不能继续用直立图的脚底作旋转原点，否则半个身体会陷进地面。
    // 计算缩放、旋转后矩形的最低边，使它仍落在 gy；左右朝向共享同一公式。
    var angle = (pose.rot || 0) * facing;
    var groundLift = pose.grounded ?
      Math.abs(Math.sin(angle)) * w * Math.abs(pose.sx || 1) / 2 +
      Math.max(0, -Math.cos(angle) * h * (pose.sy || 1)) : 0;
    ctx.translate(sx0 + facing * (pose.ox || 0), gy - (pose.oy || 0) - groundLift);
    ctx.rotate(angle);
    ctx.scale(flip * (pose.sx || 1), pose.sy || 1);
    if (pose.filter) ctx.filter = pose.filter;   // 镜像对决的暗黑版本
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.filter = 'none';
    if (pose.flash > 0 && rec.white) {
      ctx.globalAlpha *= Math.min(1, pose.flash) * 0.85;
      ctx.drawImage(rec.white, -w / 2, -h, w, h);
    } else if (pose.tint && rec.blue) {
      ctx.globalAlpha *= pose.tint;
      ctx.drawImage(rec.blue, -w / 2, -h, w, h);
    }
    ctx.restore();
    return true;
  }

  // 头像：圆形裁切的面部
  function drawPortrait(ctx, fid, x, y, r, mirror) {
    var P = DEFS[fid].portrait, rec = store[P.src];
    if (!rec || !rec.ok) return false;
    var img = rec.img, iw = img.naturalWidth, ih = img.naturalHeight;
    var rr = P.r * Math.min(iw, ih);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, P.cx * iw - rr, P.cy * ih - rr, rr * 2, rr * 2, -r, -r, r * 2, r * 2);
    ctx.restore();
    return true;
  }

  // 超杀插图卡（整张二创图，保留其原字幕作为梗）
  function cutinImage(fid) {
    var rec = store[def(fid, DEFS[fid].cutin).src];
    return rec && rec.ok ? rec.img : null;
  }

  function cutinSilhouette(fid) {
    var rec = store[def(fid, DEFS[fid].cutin).src];
    return rec && rec.ok ? rec.white : null;
  }

  FG.sprites = {
    ui: ui,
    cutinSilhouette: cutinSilhouette,
    DEFS: DEFS,
    ready: ready,
    allLoaded: function () {
      return pending === 0 && FG.fontState !== 'loading' &&
        Object.keys(store).every(function (src) { return store[src].ok; });
    },
    def: def,
    poseOf: poseOf,
    drawSprite: drawSprite,
    drawPortrait: drawPortrait,
    cutinImage: cutinImage
  };
})();
