/* 界面主题：夜市招牌语言。统一色板、字体与部件（木牌面板、手缝边、胶囊按钮、灯笼、圆角条）。
 * 纯表现层。render.js 与 fx.js 的所有界面部件都从这里取样式，保证风格一致。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var TAU = Math.PI * 2;

  // 色板：以角色的黄色、夜市的暖光为主，深色用巧克力棕而不是紫黑
  var C = {
    ink: '#2a1409',        // 最深：描边、文字底
    wood: '#3a1d0e',       // 木牌面板
    woodHi: '#5a301a',     // 木牌高光
    cream: '#fff0cc',      // 奶油：边框、文字
    paper: '#f6dca0',
    mustard: '#ffc933',    // 主色：选中、强调
    orange: '#ff8f2b',
    lantern: '#e8452c',    // 点缀：灯笼红
    teal: '#3fb6a8',       // 辅色：防御、信息
    mint: '#a7e07a',
    dim: '#c9a97a'         // 次要文字
  };

  // 标题 / 按钮 / 横幅用圆润的展示字体（内嵌子集，见 fonts.js）；正文用系统黑体，保证小字清晰
  var DISPLAY = '"KuaiLe","Yuanti SC","YouYuan","Hiragino Maru Gothic ProN","PingFang SC","Microsoft YaHei",sans-serif';
  var BODY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 手缝虚线边：沿圆角矩形内缩 inset 画一圈虚线
  function stitch(ctx, x, y, w, h, r, inset, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.55 : alpha;
    ctx.strokeStyle = color || C.cream;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.lineCap = 'round';
    rr(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(2, r - inset));
    ctx.stroke();
    ctx.restore();
  }

  // 木牌面板：厚实的深棕牌面 + 奶油外沿 + 内侧手缝线 + 柔和投影
  // opts: { r, alpha, tilt, accent(顶边色条颜色), shadow(false 关闭) }
  function panel(ctx, x, y, w, h, opts) {
    opts = opts || {};
    var r = opts.r === undefined ? 20 : opts.r;
    ctx.save();
    if (opts.tilt) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(opts.tilt);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(10,4,0,0.42)';
      rr(ctx, x + 2, y + 8, w, h, r);
      ctx.fill();
    }
    // 外沿（奶油）
    rr(ctx, x - 4, y - 4, w + 8, h + 8, r + 4);
    ctx.fillStyle = C.cream;
    ctx.fill();
    // 牌面
    rr(ctx, x, y, w, h, r);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    var a = opts.alpha === undefined ? 0.94 : opts.alpha;
    g.addColorStop(0, 'rgba(78,40,20,' + a + ')');
    g.addColorStop(1, 'rgba(46,22,10,' + a + ')');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    // 顶部亮边，像上了一层釉
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,230,180,0.08)';
    ctx.fillRect(x, y, w, h * 0.38);
    if (opts.accent) {
      ctx.fillStyle = opts.accent;
      ctx.fillRect(x, y, w, 7);
    }
    ctx.restore();
    stitch(ctx, x, y, w, h, r, 8, C.cream, 0.4);
    ctx.restore();
  }

  // 小灯笼：lit 为亮（红）或熄（暗），s 为高度
  function lantern(ctx, x, y, s, lit, swing) {
    ctx.save();
    ctx.translate(x, y);
    if (swing) ctx.rotate(swing);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.62); ctx.lineTo(0, -s * 0.46); ctx.stroke();
    // 上下盖
    ctx.fillStyle = '#7a4a1c';
    rr(ctx, -s * 0.2, -s * 0.5, s * 0.4, s * 0.12, 2); ctx.fill();
    rr(ctx, -s * 0.2, s * 0.38, s * 0.4, s * 0.12, 2); ctx.fill();
    // 灯身
    var g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
    if (lit) { g.addColorStop(0, '#c9301a'); g.addColorStop(0.45, '#ff6a3d'); g.addColorStop(1, '#c9301a'); }
    else { g.addColorStop(0, '#4a3a34'); g.addColorStop(0.5, '#6a5650'); g.addColorStop(1, '#4a3a34'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.ink; ctx.stroke();
    if (lit) {
      ctx.strokeStyle = 'rgba(255,220,120,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.12, s * 0.4, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.14, s * 0.06, s * 0.12, 0.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // 胶囊按钮：选中为芥末黄，带灯笼指示；未选中为半透明木牌
  function button(ctx, label, cx, cy, w, h, sel, t) {
    var x = cx - w / 2, y = cy - h / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(10,4,0,0.4)';
    rr(ctx, x + 1, y + 5, w, h, h / 2); ctx.fill();
    rr(ctx, x - 3, y - 3, w + 6, h + 6, h / 2 + 3);
    ctx.fillStyle = sel ? C.cream : 'rgba(255,240,204,0.42)';
    ctx.fill();
    rr(ctx, x, y, w, h, h / 2);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (sel) { g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#ffb41f'); }
    else { g.addColorStop(0, 'rgba(84,44,22,0.92)'); g.addColorStop(1, 'rgba(48,24,12,0.92)'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
    if (sel) {
      ctx.save();
      rr(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y, w, h * 0.4);
      ctx.restore();
      stitch(ctx, x, y, w, h, h / 2, 5, C.ink, 0.35);
      lantern(ctx, x + 24, cy + 1, 26, true, Math.sin(t / 14) * 0.12);
      lantern(ctx, x + w - 24, cy + 1, 26, true, Math.sin(t / 14 + 1.2) * 0.12);
    }
    ctx.restore();
    ctx.save();
    ctx.font = (sel ? '24px ' : '21px ') + DISPLAY;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (sel) {
      ctx.fillStyle = C.ink;
      ctx.fillText(label, cx, cy + 1);
    } else {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,14,6,0.7)'; ctx.strokeText(label, cx, cy + 1);
      ctx.fillStyle = C.cream;
      ctx.fillText(label, cx, cy + 1);
    }
    ctx.restore();
  }

  // 圆角小条：用于属性条与能量段
  function bar(ctx, x, y, w, h, frac, c1, c2) {
    ctx.save();
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(20,8,2,0.7)'; ctx.fill();
    if (frac > 0) {
      ctx.save();
      rr(ctx, x, y, w, h, h / 2); ctx.clip();
      var g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, Math.max(h, w * frac), h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x, y + 1, w, Math.max(1, h * 0.28));
      ctx.restore();
    }
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,240,204,0.55)';
    rr(ctx, x, y, w, h, h / 2); ctx.stroke();
    ctx.restore();
  }

  // 标签条（角色名牌、关卡名）：奶油底、棕字，像贴在牌子上的纸条
  function tag(ctx, label, cx, cy, size, color, tilt, textColor) {
    ctx.save();
    ctx.font = size + 'px ' + DISPLAY;
    var w = ctx.measureText(label).width + size * 1.6, h = size * 1.7;
    ctx.translate(cx, cy);
    ctx.rotate(tilt || 0);
    ctx.fillStyle = 'rgba(10,4,0,0.35)';
    rr(ctx, -w / 2 + 1, -h / 2 + 4, w, h, h / 2); ctx.fill();
    rr(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = color || C.mustard; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    stitch(ctx, -w / 2, -h / 2, w, h, h / 2, 4, C.ink, 0.3);
    ctx.fillStyle = textColor || C.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
    return w;
  }

  // 展示字：奶油填充 + 棕色粗描边（比白字紫边柔和，与背景暖光一致）
  function title(ctx, s, x, y, size, fill, stroke, lw, align) {
    ctx.save();
    ctx.font = size + 'px ' + DISPLAY;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw === undefined ? Math.max(4, size * 0.2) : lw;
    ctx.strokeStyle = stroke || C.ink;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill || C.cream;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  FG.ui = { C: C, DISPLAY: DISPLAY, BODY: BODY, rr: rr, stitch: stitch, panel: panel, lantern: lantern, button: button,
    bar: bar, tag: tag, title: title };
})();
