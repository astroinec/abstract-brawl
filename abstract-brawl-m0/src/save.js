/* 存档：设置与进度，存在浏览器 localStorage（便携版、单文件版、源码版各自独立保存）。
 * 不可用时（隐私模式等）退回内存，不影响游戏。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var KEY = 'abstract-brawl.save.v1';
  var DEFAULTS = {
    bgm: 0.6,          // 音乐音量 0~1
    sfx: 0.85,         // 音效音量 0~1
    voice: true,       // 播报语音
    shake: 2,          // 震屏强度：0 关 / 1 弱 / 2 标准
    diff: 2,           // 对战电脑默认难度
    cleared: {}        // 闯关通关记录：{ fid: 次数 }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var data = clone(DEFAULTS);
  try {
    var raw = window.localStorage && window.localStorage.getItem(KEY);
    if (raw) {
      var got = JSON.parse(raw);
      Object.keys(DEFAULTS).forEach(function (k) { if (got[k] !== undefined) data[k] = got[k]; });
    }
  } catch (e) { /* 读取失败用默认值 */ }

  function save() {
    try { window.localStorage && window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  }

  function reset() {
    data = clone(DEFAULTS);
    FG.save.data = data;
    save();
  }

  FG.save = { data: data, save: save, reset: reset, DEFAULTS: DEFAULTS, KEY: KEY };
})();
