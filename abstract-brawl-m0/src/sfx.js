/* 音频：采样音效 + 背景音乐（assets/audio/，单文件版从 window.__FG_ASSETS__ 读 data URI），
 * 采样未就绪或解码失败时回退到 WebAudio 程序合成音。音量取自 FG.save.data。
 *
 * 来源：背景音乐、风声、防御反击音取自《王者荣耀》客户端素材（仅个人娱乐，不得商用）；
 * 打击 / 界面音效为 Kenney CC0；播报为 macOS「婷婷」语音合成。详见 assets/audio/CREDITS.txt。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var ac = null, master = null, bgmBus = null, sfxBus = null;
  var buffers = {};          // name -> AudioBuffer
  var loading = {};
  var NAMES = ['bgm_title', 'bgm_select', 'bgm_fight1', 'bgm_fight2', 'bgm_fight3',
    'sfx_hit1', 'sfx_hit2', 'sfx_hit3', 'sfx_heavy1', 'sfx_heavy2', 'sfx_block1', 'sfx_block2',
    'sfx_land', 'sfx_down', 'sfx_throw', 'sfx_whoosh', 'sfx_whoosh2', 'sfx_gc',
    'ui_move', 'ui_ok', 'ui_back',
    'vo_r1', 'vo_r2', 'vo_r3', 'vo_fight', 'vo_ko', 'vo_time', 'vo_perfect', 'vo_super'];
  var FIGHT_TRACKS = ['bgm_fight1', 'bgm_fight2', 'bgm_fight3'];

  function vol(k) { return FG.save ? FG.save.data[k] : 0.7; }

  function context() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
      if (ac) {
        master = ac.createGain(); master.connect(ac.destination);
        bgmBus = ac.createGain(); bgmBus.connect(master);
        sfxBus = ac.createGain(); sfxBus.connect(master);
        applyVolume();
        NAMES.forEach(load);
      }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  function applyVolume() {
    if (!ac) return;
    // 平方曲线更接近人耳感受
    var b = vol('bgm'), s = vol('sfx');
    bgmBus.gain.setTargetAtTime(b * b * 0.8, ac.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(s * s, ac.currentTime, 0.02);
  }

  function b64ToBuf(uri) {
    var b64 = uri.slice(uri.indexOf(',') + 1);
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function load(name) {
    if (buffers[name] || loading[name] || !ac) return;
    loading[name] = true;
    var inline = window.__FG_ASSETS__ && window.__FG_ASSETS__[name];
    var got;
    if (inline) got = Promise.resolve(b64ToBuf(inline));
    else if (location.protocol === 'file:') return;   // 源码版直接双击打开时浏览器禁止读取本地文件，用合成音
    else got = fetch('assets/audio/' + name + '.mp3').then(function (r) { return r.arrayBuffer(); });
    got.then(function (ab) {
      return new Promise(function (ok, bad) { ac.decodeAudioData(ab, ok, bad); });
    }).then(function (buf) {
      buffers[name] = buf;
      if (name === want && !cur) startBgm(name);   // 等待中的音乐到了就开播
    }, function () { /* 解码失败：保留合成音回退 */ });
  }

  function sample(name, gain, rate) {
    var a = context(), buf = buffers[name];
    if (!a || !buf) return false;
    var src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate || 1;
    g.gain.value = gain === undefined ? 1 : gain;
    src.connect(g); g.connect(sfxBus);
    src.start();
    return true;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function jitter(k) { return 1 + (Math.random() * 2 - 1) * (k || 0.06); }   // 轻微变调，避免机械重复

  // ---------------- 背景音乐 ----------------
  var cur = null, curName = null, want = null, duck = 1;

  function startBgm(name) {
    var a = ac, buf = buffers[name];
    if (!a || !buf) return;
    var src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf; src.loop = true;
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(duck, a.currentTime + 1.2);
    src.connect(g); g.connect(bgmBus);
    src.start();
    cur = { src: src, g: g };
    curName = name;
  }

  function stopBgm(fade) {
    if (!cur || !ac) { cur = null; curName = null; return; }
    var c = cur, t = ac.currentTime;
    c.g.gain.cancelScheduledValues(t);
    c.g.gain.setValueAtTime(c.g.gain.value, t);
    c.g.gain.linearRampToValueAtTime(0, t + (fade === undefined ? 0.8 : fade));
    try { c.src.stop(t + (fade === undefined ? 0.8 : fade) + 0.05); } catch (e) { /* 已停止 */ }
    cur = null; curName = null;
  }

  // 切换音乐：同名不重启；'fight' 会随机挑一首对战曲；null 停止
  function music(name) {
    if (name === 'fight') name = pick(FIGHT_TRACKS);
    if (name && name === want && cur) return;
    want = name;
    if (!ac) return;              // 还没有用户交互，等解锁后再开
    stopBgm();
    if (name && buffers[name]) startBgm(name);
  }

  function setDuck(v) {
    duck = v;
    if (cur && ac) cur.g.gain.setTargetAtTime(v, ac.currentTime, 0.15);
  }

  // ---------------- 合成音回退 ----------------
  function tone(f, dur, type, v, slide) {
    var a = context();
    if (!a) return;
    var t0 = a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  function noise(dur, v) {
    var a = context();
    if (!a) return;
    var n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf; g.gain.value = v;
    src.connect(g); g.connect(sfxBus);
    src.start();
  }

  function voice(name) {
    if (FG.save && !FG.save.data.voice) return true;
    return sample(name, 1.1);
  }

  function play(type) {
    if (!context()) return;
    switch (type) {
      case 'hit':
        if (!sample(pick(['sfx_hit1', 'sfx_hit2', 'sfx_hit3']), 0.9, jitter(0.08))) { tone(220, 0.09, 'square', 0.11, -150); noise(0.06, 0.12); }
        break;
      case 'heavy':
        if (!sample(pick(['sfx_heavy1', 'sfx_heavy2']), 1, jitter(0.05))) { tone(140, 0.18, 'square', 0.14, -90); noise(0.12, 0.2); }
        break;
      case 'block':
        if (!sample(pick(['sfx_block1', 'sfx_block2']), 0.75, jitter(0.06))) tone(520, 0.06, 'triangle', 0.1, 120);
        break;
      case 'ko':
        if (!sample('sfx_heavy1', 1.1, 0.8)) { tone(160, 0.8, 'sawtooth', 0.14, -120); noise(0.4, 0.18); }
        break;
      case 'fight':
        if (!voice('vo_fight')) { tone(523, 0.12, 'triangle', 0.1); setTimeout(function () { tone(784, 0.2, 'triangle', 0.1); }, 110); }
        break;
      case 'super':
        sample('sfx_whoosh2', 0.9, 0.85);
        if (!voice('vo_super')) { tone(300, 0.5, 'sawtooth', 0.09, 600); tone(150, 0.5, 'square', 0.06, 300); }
        break;
      case 'jump':
        if (!sample('sfx_whoosh', 0.35, jitter(0.1) * 1.3)) tone(330, 0.08, 'sine', 0.06, 200);
        break;
      case 'land':
        if (!sample('sfx_land', 0.45, jitter(0.1))) noise(0.05, 0.06);
        break;
      case 'down':
        sample('sfx_down', 0.9, jitter(0.05));
        break;
      case 'dash': case 'bdash':
        if (!sample('sfx_whoosh', 0.55, jitter(0.08))) noise(0.08, 0.07);
        break;
      case 'tech':
        if (!sample('sfx_whoosh2', 0.5, 1.4)) tone(660, 0.08, 'triangle', 0.08, -200);
        break;
      case 'gc':
        if (!sample('sfx_gc', 0.9)) { tone(880, 0.12, 'triangle', 0.1, -400); noise(0.08, 0.1); }
        break;
      case 'throw':
        if (!sample('sfx_throw', 1, jitter(0.04))) { tone(120, 0.22, 'square', 0.13, -60); noise(0.15, 0.18); }
        break;
      case 'throwbreak':
        if (!sample('sfx_block1', 0.9, 1.25)) tone(1040, 0.1, 'square', 0.08, -300);
        break;
      case 'ui_move':
        if (!sample('ui_move', 0.6)) tone(880, 0.03, 'triangle', 0.05);
        break;
      case 'ui_ok':
        if (!sample('ui_ok', 0.8)) tone(660, 0.08, 'triangle', 0.08, 200);
        break;
      case 'ui_back':
        if (!sample('ui_back', 0.7)) tone(440, 0.08, 'triangle', 0.07, -150);
        break;
      default:
        break;
    }
  }

  // 回合播报：第 1 / 2 / 最终回合
  function roundCall(round, final) { voice(final ? 'vo_r3' : (round === 1 ? 'vo_r1' : 'vo_r2')); }
  function koCall(timeUp, perfect) {
    voice(timeUp ? 'vo_time' : 'vo_ko');
    if (perfect) setTimeout(function () { voice('vo_perfect'); }, 900);
  }

  FG.sfx = {
    unlock: function () { context(); if (want && !cur && buffers[want]) startBgm(want); },
    play: play,
    music: music,
    duck: setDuck,
    applyVolume: applyVolume,
    roundCall: roundCall,
    koCall: koCall,
    ready: function (name) { return !!buffers[name]; },
    state: function () { return { ctx: ac ? ac.state : 'none', loaded: Object.keys(buffers).length, total: NAMES.length, bgm: curName }; }
  };
})();
