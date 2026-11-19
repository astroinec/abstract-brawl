/* 内嵌展示字体（ZCOOL KuaiLe 子集，OFL）。单文件版从 window.__FG_ASSETS__ 读 data URI，源码版读 assets/fonts/。
 * 加载失败时静默回退到系统圆体 / 黑体，不影响玩法。FG.fontState: 'loading' | 'ok' | 'fail'
 */
(function () {
  'use strict';
  var FG = window.FG;
  FG.fontState = 'loading';
  try {
    var inline = window.__FG_ASSETS__ && window.__FG_ASSETS__['kuaile-subset'];
    var url = inline || 'assets/fonts/kuaile-subset.woff2';
    var face = new FontFace('KuaiLe', 'url("' + url + '")');
    face.load().then(function (f) {
      document.fonts.add(f);
      FG.fontState = 'ok';
    }, function () { FG.fontState = 'fail'; });
  } catch (e) { FG.fontState = 'fail'; }
})();
