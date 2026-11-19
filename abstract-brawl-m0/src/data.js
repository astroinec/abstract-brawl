/* 角色与招式数据（占位数值，全部可调）。单位：px、帧。
 * 新增角色：在 FIGHTERS 加一条数据，并在 art.js 的 PAL 与 drawCreature 里加一套造型。
 */
(function () {
  'use strict';
  var FG = window.FG;
  var px = FG.px;

  function boxS(b) { return [px(b[0]), px(b[1]), px(b[2]), px(b[3])]; }
  // 招式判定框按精灵尺寸统一放大（数据表仍以旧尺寸书写，便于对照）
  var BOX_K = 1.3;
  function boxK(b) { return [px(b[0] * BOX_K), px(b[1] * BOX_K), px(b[2] * BOX_K), px(b[3] * BOX_K)]; }

  FG.MOTIONS = { '236': [2, 3, 6], '623': [6, 2, 3], '214': [2, 1, 4] };

  // 普通技（两名角色共用）。判定框为相对脚底中心、朝向前方为正的 px 坐标。
  var BASE = {
    '5A': { name: '轻拳', stance: 'stand', frames: 14,
      hits: [{ f: [5, 6], box: [24, 72, 84, 112], level: 'mid', dmg: 40, hitstun: 12, blockstun: 9, hitstop: 6, push: 6 }],
      cancels: ['5A', '5B', '236A', '214B', '214D', '236C', '623B'] },
    '5B': { name: '重拳', stance: 'stand', frames: 26, lunge: { f: [9, 11], vx: 2 },
      hits: [{ f: [9, 11], box: [28, 56, 100, 104], level: 'mid', dmg: 80, hitstun: 16, blockstun: 12, hitstop: 9, push: 14 }],
      cancels: ['236A', '214B', '214D', '236C', '623B'] },
    '5C': { name: '轻脚', stance: 'stand', frames: 16,
      hits: [{ f: [6, 8], box: [20, 14, 94, 52], level: 'mid', dmg: 45, hitstun: 13, blockstun: 10, hitstop: 6, push: 8 }],
      cancels: ['5C', '236A', '214B', '214D', '236C'] },
    '5D': { name: '重脚', stance: 'stand', frames: 34,
      hits: [{ f: [13, 16], box: [28, 36, 118, 100], level: 'mid', dmg: 110, hitstun: 22, blockstun: 14, hitstop: 10, push: 22, kd: true }],
      cancels: ['236A', '214B', '214D', '236C'] },
    '2A': { name: '蹲轻拳', stance: 'crouch', frames: 12,
      hits: [{ f: [4, 5], box: [18, 28, 68, 60], level: 'mid', dmg: 35, hitstun: 11, blockstun: 8, hitstop: 5, push: 6 }],
      cancels: ['2A', '2B', '236A', '214B', '214D', '236C'] },
    '2B': { name: '蹲重拳', stance: 'crouch', frames: 22,
      hits: [{ f: [8, 10], box: [28, 30, 92, 66], level: 'mid', dmg: 70, hitstun: 16, blockstun: 12, hitstop: 8, push: 10 }],
      cancels: ['236A', '214B', '214D', '236C'] },
    '2C': { name: '蹲轻脚', stance: 'crouch', frames: 13,
      hits: [{ f: [5, 6], box: [14, 0, 80, 22], level: 'low', dmg: 40, hitstun: 12, blockstun: 9, hitstop: 5, push: 8 }],
      cancels: ['2C', '236A', '214B', '214D', '236C'] },
    '2D': { name: '扫腿', stance: 'crouch', frames: 36,
      hits: [{ f: [15, 17], box: [-10, 0, 108, 18], level: 'low', dmg: 90, hitstun: 28, blockstun: 16, hitstop: 10, push: 18, kd: true }],
      cancels: [] },
    'jA': { name: '空中拳', stance: 'air', airOnly: true, frames: 22,
      hits: [{ f: [5, 10], box: [8, 44, 68, 100], level: 'mid', dmg: 50, hitstun: 14, blockstun: 10, hitstop: 6, push: 8 }],
      cancels: [] },
    'jC': { name: '空中脚', stance: 'air', airOnly: true, frames: 24,
      hits: [{ f: [6, 12], box: [4, 18, 74, 66], level: 'mid', dmg: 60, hitstun: 16, blockstun: 12, hitstop: 7, push: 10 }],
      cancels: [] },
    // 投技：近身同按 B+D。第 3 帧判定距离，抓空则有较长后摇；不可防御，可被拆
    'TH': { name: '投技', stance: 'stand', frames: 30, thr: { f: 3, range: 82, dmg: 120 }, cancels: [] },
    // 防御反击：防御硬直中同按 C+D，消耗半格能量；前段无敌，打中击倒但伤害很低
    'GC': { name: '防御反击', caption: '防御反击！', stance: 'stand', frames: 32, cost: 50, invul: [1, 12],
      hits: [{ f: [7, 10], box: [6, 20, 96, 140], level: 'mid', dmg: 30, hitstun: 22, blockstun: 16, hitstop: 8, push: 30, kd: true }],
      cancels: [] }
  };

  // 两个抽象生物角色。招式表中的 specials 为角色专属（236 / 623 / 236C）。
  FG.FIGHTERS = {
    frog: {
      name: '奶蛙', tag: '捧腹大笑 · 舌鞭远攻', color: '#9be15d', accent: '#4fd17a',
      quote: '恭喜你刷到了罕见的奶蛙', winQuote: '齁齁齁齁齁！', throwName: '奶蛙熊抱',
      stats: { atk: 3, spd: 5, hp: 3, reach: 4 },
      walkF: 2.7, walkB: 2.1, jumpV: 15, jumpFwd: 3.0, jumpBack: 2.6,
      dmgMul: 1.0, health: 950,
      hurt: { stand: [-42, 0, 42, 150], crouch: [-44, 0, 44, 104], air: [-40, 0, 40, 140] },
      specials: {
        '236A': { name: '舌鞭', caption: '齁齁齁！', frames: 30,
          proj: { f: 10, ox: 52, oy: 118, w: 40, h: 28, speed: 8.5, life: 120, dmg: 70, hitstun: 16, blockstun: 11, hitstop: 7, push: 5, level: 'mid' } },
        '623B': { name: '大笑弹跳', caption: '一起大笑！', frames: 40, invul: [1, 6], vel: { f: 1, vy: 13 },
          hits: [{ f: [4, 12], box: [-6, 30, 60, 120], level: 'mid', dmg: 110, hitstun: 24, blockstun: 16, hitstop: 10, push: 10, kd: true }] },
        '214B': { name: '肚皮压顶', caption: '奶蛙压顶！', frames: 40, vel: { f: 4, vy: 9 }, lunge: { f: [4, 24], vx: 4 },
          hits: [{ f: [14, 26], box: [-10, -10, 80, 90], level: 'high', dmg: 100, hitstun: 22, blockstun: 14, hitstop: 10, push: 12, kd: true }] },
        '214D': { name: '躺平滑铲', caption: '我直接躺平', stance: 'crouch', frames: 40, lunge: { f: [5, 20], vx: 7 },
          hits: [{ f: [8, 20], box: [0, 0, 90, 30], level: 'low', dmg: 80, hitstun: 26, blockstun: 14, hitstop: 8, push: 14, kd: true }] },
        '236C': { name: '齁齁齁连打', caption: '恭喜你刷到了罕见的奶蛙', frames: 58, cost: 100, superFx: true,
          hits: [
            { f: [18, 20], box: [-10, 20, 80, 110], level: 'mid', dmg: 50, hitstun: 14, blockstun: 12, hitstop: 7, push: 6 },
            { f: [24, 26], box: [-10, 20, 80, 110], level: 'mid', dmg: 50, hitstun: 14, blockstun: 12, hitstop: 7, push: 6 },
            { f: [32, 36], box: [-16, 10, 90, 120], level: 'mid', dmg: 110, hitstun: 28, blockstun: 18, hitstop: 12, push: 24, kd: true }
          ] }
      }
    },
    roo: {
      name: '美团袋鼠', tag: '胆子肥嘟嘟 · 手铐重拳', color: '#ffc21a', accent: '#ff8a00',
      quote: '你胆子真是肥嘟嘟的', winQuote: '不打听打听我是谁？', throwName: '肥嘟嘟过肩摔',
      stats: { atk: 5, spd: 3, hp: 5, reach: 3 },
      walkF: 2.4, walkB: 2.0, jumpV: 13, jumpFwd: 2.6, jumpBack: 2.2,
      dmgMul: 1.1, health: 1050,
      hurt: { stand: [-40, 0, 40, 172], crouch: [-42, 0, 42, 120], air: [-38, 0, 38, 150] },
      specials: {
        '236A': { name: '手铐飞扣', caption: '车被交警扣了', frames: 36,
          proj: { f: 14, ox: 58, oy: 100, w: 44, h: 38, speed: 5, life: 200, dmg: 100, hitstun: 22, blockstun: 15, hitstop: 9, push: 10, level: 'mid' } },
        '623B': { name: '胆大上勾', caption: '抢生意抢到我头上了', frames: 44, invul: [1, 8], vel: { f: 1, vy: 12 },
          hits: [{ f: [5, 13], box: [0, 40, 70, 150], level: 'mid', dmg: 130, hitstun: 26, blockstun: 18, hitstop: 10, push: 10, kd: true }] },
        '214B': { name: '尾巴扫街', caption: '这条街我罩的', stance: 'crouch', frames: 38,
          hits: [{ f: [11, 15], box: [-50, 0, 110, 30], level: 'low', dmg: 95, hitstun: 28, blockstun: 15, hitstop: 9, push: 16, kd: true }] },
        '214D': { name: '准时飞踹', caption: '外卖准时送达', frames: 42, vel: { f: 4, vy: 8 }, lunge: { f: [4, 22], vx: 5 },
          hits: [
            { f: [10, 13], box: [10, 20, 90, 100], level: 'mid', dmg: 60, hitstun: 16, blockstun: 12, hitstop: 7, push: 6 },
            { f: [17, 21], box: [10, 10, 96, 100], level: 'mid', dmg: 80, hitstun: 24, blockstun: 14, hitstop: 10, push: 18, kd: true }
          ] },
        '236C': { name: '胆子真是肥嘟嘟的', caption: '你胆子真是肥嘟嘟的', frames: 62, cost: 100, superFx: true, lunge: { f: [14, 30], vx: 3 },
          hits: [
            { f: [16, 18], box: [10, 20, 92, 110], level: 'mid', dmg: 60, hitstun: 15, blockstun: 12, hitstop: 7, push: 6 },
            { f: [22, 24], box: [10, 20, 92, 110], level: 'mid', dmg: 60, hitstun: 15, blockstun: 12, hitstop: 7, push: 6 },
            { f: [31, 35], box: [0, 10, 100, 130], level: 'mid', dmg: 130, hitstun: 30, blockstun: 20, hitstop: 12, push: 26, kd: true }
          ] }
      }
    }
  };

  function buildMove(id, d) {
    var mv = {
      id: id, name: d.name, caption: d.caption || '', stance: d.stance || 'stand', frames: d.frames,
      airOnly: !!d.airOnly, cost: d.cost || 0, superFx: !!d.superFx, cancels: d.cancels || [],
      thr: d.thr ? { f: d.thr.f, range: px(d.thr.range), dmg: d.thr.dmg } : null,
      invul: d.invul ? [d.invul[0], d.invul[1]] : null,
      vel: d.vel ? { f: d.vel.f, vy: px(d.vel.vy) } : null,
      lunge: d.lunge ? { f1: d.lunge.f[0], f2: d.lunge.f[1], vx: px(d.lunge.vx) } : null,
      hits: [], proj: null
    };
    (d.hits || []).forEach(function (h) {
      mv.hits.push({
        f1: h.f[0], f2: h.f[1], box: boxK(h.box), level: h.level, dmg: h.dmg,
        hitstun: h.hitstun, blockstun: h.blockstun, hitstop: h.hitstop, push: px(h.push), kd: !!h.kd
      });
    });
    if (d.proj) {
      var q = d.proj;
      mv.proj = {
        f: q.f, ox: px(q.ox), oy: px(q.oy), w: px(q.w), h: px(q.h), speed: px(q.speed), life: q.life,
        dmg: q.dmg, hitstun: q.hitstun, blockstun: q.blockstun, hitstop: q.hitstop, push: px(q.push), level: q.level
      };
    }
    // 派生帧数据（标准口径：优势 = 硬直 - 攻击方出招后剩余帧）
    var first = 0, last = 0;
    if (mv.hits.length) {
      first = mv.hits[0].f1;
      mv.hits.forEach(function (h) { first = Math.min(first, h.f1); last = Math.max(last, h.f2); });
    } else if (mv.proj) {
      first = last = mv.proj.f;
    } else if (mv.thr) {
      first = last = mv.thr.f;
    }
    mv.startup = first;   // 与常见帧数据表一致：第一判定帧的序号
    mv.active = last - first + 1;
    mv.recovery = mv.frames - last;
    if (mv.hits.length) {
      var h0 = mv.hits[0];
      mv.advHit = h0.hitstun - (mv.frames - h0.f1);
      mv.advBlock = h0.blockstun - (mv.frames - h0.f1);
    } else {
      mv.advHit = null;
      mv.advBlock = null;
    }
    if (mv.airOnly) { mv.advHit = null; mv.advBlock = null; }
    return mv;
  }

  function buildMoveset(fid) {
    var f = FG.FIGHTERS[fid], set = {};
    Object.keys(BASE).forEach(function (id) { set[id] = buildMove(id, BASE[id]); });
    Object.keys(f.specials).forEach(function (id) { set[id] = buildMove(id, f.specials[id]); });
    if (f.throwName) set.TH.name = f.throwName;
    return set;
  }

  FG.MOVESETS = {};
  Object.keys(FG.FIGHTERS).forEach(function (fid) {
    var f = FG.FIGHTERS[fid];
    f.hurtS = { stand: boxS(f.hurt.stand), crouch: boxS(f.hurt.crouch), air: boxS(f.hurt.air) };
    FG.MOVESETS[fid] = buildMoveset(fid);
  });
})();
