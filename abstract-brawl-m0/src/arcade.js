/* 单人闯关：三关（街口 → 镜中对决 → 外卖站决战），每关开场对白，通关结局。 */
(function () {
  'use strict';
  var FG = window.FG;

  var DARK = { frog: '暗黑奶蛙', roo: '暗黑袋鼠' };

  // opp: 'rival' = 另一名角色，'mirror' = 同角色的暗黑版本
  var STAGES = [
    { opp: 'rival', level: 1, title: '第一关 · 夜市街口' },
    { opp: 'mirror', level: 2, title: '第二关 · 镜中对决' },
    { opp: 'rival', level: 3, title: '最终关 · 外卖站决战' }
  ];

  // s: 0 = 玩家角色，1 = 对手
  var LINES = {
    frog: [
      [{ s: 1, t: '这条街的外卖都归我送，你一只蛙来凑什么热闹？' },
       { s: 0, t: '齁齁齁……我只是路过买杯奶茶。' },
       { s: 1, t: '买奶茶不点外卖？你胆子真是肥嘟嘟的！' }],
      [{ s: 1, t: '刷到罕见奶蛙的人会有好运。刷到我的……就难说了。' },
       { s: 0, t: '你怎么长得跟我一模一样？' },
       { s: 1, t: '笑得最大声的那个，才是本尊。' }],
      [{ s: 1, t: '我把全城的骑手兄弟都叫来了，今晚夜市必须清场！' },
       { s: 0, t: '那就……大家一起大笑吧！' },
       { s: 1, t: '不打听打听我是谁？' }]
    ],
    roo: [
      [{ s: 1, t: '齁齁齁！你送的奶茶洒了一半！' },
       { s: 0, t: '洒了我赔，差评可不认！' },
       { s: 1, t: '那就用拳头来评价吧！' }],
      [{ s: 1, t: '超时的单，统统都要被我扣下。' },
       { s: 0, t: '连我自己都要扣？' },
       { s: 1, t: '车被交警扣了，你也跑不掉。' }],
      [{ s: 1, t: '整条街都在笑你，袋鼠先生。' },
       { s: 0, t: '抢生意抢到我头上了？' },
       { s: 1, t: '恭喜你刷到了罕见的奶蛙——最后一次！' }]
    ]
  };

  var ENDINGS = {
    frog: ['奶蛙赢下了「夜市之王」的称号。',
      '从此，每个刷到它的人都会获得好运，',
      '以及一整晚停不下来的笑声。',
      '齁齁齁齁齁！'],
    roo: ['美团袋鼠守住了夜市的每一单。',
      '车没再被扣，差评一个也没有。',
      '它给自己点了一杯奶茶犒劳——',
      '准时送达。']
  };

  function other(fid) { return fid === 'frog' ? 'roo' : 'frog'; }

  // 生成某一关的对局参数
  function stageMatch(fid, idx) {
    var st = STAGES[idx];
    var mirror = st.opp === 'mirror';
    return {
      fid0: fid,
      fid1: mirror ? fid : other(fid),
      name1: mirror ? DARK[fid] : undefined,
      level: st.level,
      mirror: mirror,
      title: st.title
    };
  }

  FG.arcade = {
    STAGES: STAGES,
    LINES: LINES,
    ENDINGS: ENDINGS,
    DARK: DARK,
    stageMatch: stageMatch,
    other: other
  };
})();
