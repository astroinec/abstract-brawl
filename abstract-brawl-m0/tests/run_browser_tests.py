#!/usr/bin/env python3
"""自动化验收（无头 Chrome）：
1) 打开 tests/tests.html，跑单元测试（确定性、帧数据、搓招、判定、防御、连段、KO、AI）；
2) 打开 index.html，用真实按键走一遍：标题 → 单机选角 → 对战 → 暂停 → KO → 结算 → 训练 → 说明；
3) 收集页面报错，截图到输出目录。
用法：python3 run_browser_tests.py [输出目录] [试玩文件路径]
第二个参数可验证打包后的单文件 HTML，单元测试仍使用源码。
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / "screenshots"
GAME_URL = (pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else ROOT / "index.html").as_uri()


def unit(browser, errors):
    page = browser.new_page()
    page.on("pageerror", lambda e: errors.append("[unit] " + str(e)))
    page.goto((ROOT / "tests" / "tests.html").as_uri())
    page.wait_for_selector("body[data-done='1']", timeout=120000)
    res = page.evaluate("window.__RESULT__")
    page.close()
    return res


def smoke(browser, errors, checks):
    page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
    page.on("pageerror", lambda e: errors.append("[pageerror] " + str(e)))
    page.on("console", lambda m: errors.append("[console.error] " + m.text) if m.type == "error" else None)

    def snap(name):
        page.screenshot(path=str(OUT / (name + ".png")))

    def wait(ms):
        page.wait_for_timeout(ms)

    def press(key, after=250):
        page.keyboard.press(key, delay=70)
        wait(after)

    def app(js):
        return page.evaluate("(() => { const A = window.FG.app; " + js + " })()")

    def check(name, cond, detail=""):
        checks.append((name, bool(cond), str(detail)))

    # 标题 → 单机选角 → 开始对战
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    wait(300)
    loaded = page.evaluate("FG.sprites.ready('frog') && FG.sprites.ready('roo')")
    check("所有 AI 精灵与保留的二创素材全部加载", loaded, loaded)
    primary = page.evaluate("""(() => {
        const D = FG.sprites.DEFS;
        return ['frog', 'roo'].every(fid => ['idle', 'punch', 'kick', 'hurt'].every(key =>
            D[fid][key].src === (fid === 'frog' ? 'frogx_' : 'roox_') + key));
    })()""")
    check("两个角色的四个基础姿势均使用 AI 重绘素材", primary, primary)
    stages = page.evaluate("""(() => {
        const S = FG.sprites, out = {};
        ['frog', 'roo'].forEach(fid => {
            const m = FG.sim.createMatch({ mode: 'pvp', fid0: fid, fid1: fid === 'frog' ? 'roo' : 'frog' });
            m.phase = 'fight';
            const p = m.p[0], mv = p.moves['5B'];
            const at = (id, f) => { p.state = 'atk'; p.mv = id; p.mf = f; return S.poseOf(m, p, 0, null).key; };
            const r = {};
            r.pre = at('5B', 1);
            r.act = at('5B', mv.startup);
            r.rec = at('5B', mv.frames);
            const sc = p.moves['236C'];
            r.superHits = sc.hits.map(h => at('236C', h.f1));
            p.mv = null; p.state = 'stun'; p.blocked = false; p.kdPending = true; p.stunLeft = 10;
            r.hard = S.poseOf(m, p, 0, null).key;
            p.kdPending = false; p.stunLeft = 6;
            r.light = S.poseOf(m, p, 0, null).key;
            p.state = 'down'; p.downLeft = FG.DOWN_FRAMES - 4;
            const d = S.poseOf(m, p, 0, null); r.down = d.key; r.bounce = d.oy;
            p.downLeft = 5; r.getup = S.poseOf(m, p, 0, null).key;
            r.cutin = S.def(fid, S.DEFS[fid].cutin).src;
            out[fid] = r;
        });
        return out;
    })()""")
    ok_st = all(r["pre"] in ("charge", "windup") and r["act"] == "punch" and r["rec"] == "jab"
                and len(set(r["superHits"])) == 3 and r["hard"] == "hurt2" and r["light"] == "hurt"
                and r["down"] == "lying" and r["bounce"] > 0 and r["getup"] == "getup"
                and r["cutin"].endswith("x_cutin") for r in stages.values())
    check("分段动作：蓄力/出招/收招、超杀三段换图、重受击、倒地弹跳与起身、新插图卡", ok_st, stages)
    grounded = page.evaluate("""(() => {
        const rows = [];
        ['frog', 'roo'].forEach(fid => [-1, 1].forEach(facing => [1, 0.9].forEach(size => {
            let ty = 0, angle = 0, sx = 1, sy = 1, bottom = -Infinity;
            const ctx = {
                save() {}, restore() {},
                translate(x, y) { ty = y; },
                rotate(a) { angle = a; },
                scale(x, y) { sx = x; sy = y; },
                drawImage(img, x, y, w, h) {
                    [x, x + w].forEach(px => [y, y + h].forEach(py => {
                        bottom = Math.max(bottom, ty + px * sx * Math.sin(angle) + py * sy * Math.cos(angle));
                    }));
                }
            };
            const pose = { sx: size, sy: size, rot: -Math.PI / 2 * 0.92, grounded: true };
            const ok = FG.sprites.drawSprite(ctx, fid, 'hurt', 480, 440, facing, pose);
            rows.push({ fid, facing, size, ok, bottom });
        })));
        return rows;
    })()""")
    check("倒地精灵双朝向及结算缩放的最低边均对齐地面",
          all(r["ok"] and abs(r["bottom"] - 440) < 0.001 for r in grounded), grounded)
    snap("01-title")
    press("Enter")
    scr = app("return A.view.screen;")
    check("标题回车进入选角", scr == "select", scr)
    snap("02-select")
    press("Enter")
    scr = app("return A.view.screen;")
    check("选角回车开始对战", scr == "fight", scr)
    wait(600)
    snap("03-vs")
    page.wait_for_function("FG.app.view.match.phase === 'fight'", timeout=8000)
    wait(100)

    # 把两人放近，连按轻拳
    app("A.view.match.p[0].x = -5000; A.view.match.p[1].x = 4000;")
    for _ in range(3):
        press("KeyJ", 120)
    last = app("return A.view.match.p[0].lastMove;")
    check("键盘 J 打出轻拳 5A", last == "5A", last)
    snap("04-fight")

    # 暂停 → 继续
    press("Escape")
    scr = app("return A.view.screen;")
    check("Esc 打开暂停", scr == "pause", scr)
    snap("05-pause")
    press("Escape")

    # 强制一局结束，验证 KO 与结算
    app("A.view.match.wins[0] = 1; A.view.match.p[1].health = 0;")
    wait(500)
    snap("06-ko")
    wait(4600)
    scr = app("return A.view.screen;")
    check("KO 后进入结算", scr == "result", scr)
    snap("07-result")
    press("Escape")

    # 本地双人：P2 用方向键 / N M , .
    page.goto(GAME_URL)
    wait(400)
    press("ArrowDown")
    press("ArrowDown")
    press("Enter")
    press("Enter")
    page.wait_for_function("FG.app.view.match.phase === 'fight'", timeout=8000)
    wait(100)
    mode = app("return A.view.match.mode;")
    check("本地双人可进入", mode == "pvp", mode)
    app("A.view.match.p[0].x = -5000; A.view.match.p[1].x = 4000;")
    press("KeyN", 500)
    last = app("return A.view.match.p[1].lastMove;")
    check("P2 用 N 打出轻拳 5A", last == "5A", last)
    x0 = app("return A.view.match.p[1].x;")
    page.keyboard.down("ArrowRight")
    wait(300)
    page.keyboard.up("ArrowRight")
    wait(100)
    x1 = app("return A.view.match.p[1].x;")
    check("P2 用方向键右（后退）可移动", x1 > x0, str(x0) + " -> " + str(x1))

    # 训练模式：判定框 + 帧数据面板
    page.goto(GAME_URL)
    wait(400)
    press("ArrowDown")
    press("Enter")
    press("Enter")
    mode = app("return A.view.match.mode;")
    check("训练模式可进入", mode == "training", mode)
    app("A.view.match.p[0].x = -5000; A.view.match.p[1].x = 2000;")
    press("KeyH", 100)
    press("KeyJ", 400)
    last = app("return A.view.match.p[0].lastMove;")
    check("训练中出招被记录（帧数据面板）", last == "5A", last)
    snap("08-training")
    press("KeyT", 200)
    check("T 切换假人模式", app("return A.view.dummyMode;") == 1, app("return A.view.dummyMode;"))
    snap("09-training-auto")
    # 挂起模拟（hitstop 极大）停在 5B 判定帧，截取判定框（红）与受击框（蓝），不压暗画面
    app("A.view.showHitbox = true; const p = A.view.match.p[0]; p.state = 'atk'; p.mv = '5B'; p.mf = 11; "
        "p.stance = 'stand'; p.hitDone = [false]; p.connected = false; "
        "A.view.match.p[1].x = 2000; A.view.match.hitstop = 100000;")
    wait(200)
    snap("11-hitbox-active")

    # 真实按键搓招 236+C（S → S+D → D → L），检验超杀定格与插图演出
    app("const m = A.view.match; m.infinite = true; m.p[0].power = 300; m.p[0].x = -9000; m.p[1].x = -1000; "
        "m.hitstop = 0; A.view.showHitbox = false; A.view.dummyMode = 0;")
    wait(300)
    page.keyboard.down("KeyS"); wait(40)
    page.keyboard.down("KeyD"); wait(40)
    page.keyboard.up("KeyS"); wait(40)
    page.keyboard.press("KeyL", delay=60)
    page.keyboard.up("KeyD")
    wait(260)
    sup = app("return [A.view.match.p[0].lastMove, !!A.view.fxs.superCut, A.view.match.p[0].power];")
    check("真实搓招 236+C 发出超杀并出现插图演出", sup[0] == "236C" and sup[1], sup)
    snap("12-super-cutin")
    wait(900)
    hits = app("return A.view.match.p[0].hitCount;")
    snap("13-super-hits")
    check("超杀命中对手", hits >= 1 or app("return A.view.match.p[0].lastResult;") == "hit", hits)
    # 美团袋鼠的超杀插图
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    press("ArrowDown"); press("Enter"); press("ArrowRight"); press("Enter")
    wait(300)
    app("const m = A.view.match; m.infinite = true; m.p[0].power = 300; m.p[0].x = -9000; m.p[1].x = -1000;")
    wait(300)
    page.keyboard.down("KeyS"); wait(40)
    page.keyboard.down("KeyD"); wait(40)
    page.keyboard.up("KeyS"); wait(40)
    page.keyboard.press("KeyL", delay=60)
    page.keyboard.up("KeyD")
    wait(260)
    sup2 = app("return [A.view.match.p[0].fid, A.view.match.p[0].lastMove, !!A.view.fxs.superCut];")
    check("美团袋鼠搓招 236+C 发出超杀", sup2[0] == "roo" and sup2[1] == "236C" and sup2[2], sup2)
    snap("14-roo-super")
    page.wait_for_function("FG.app.view.match.p[0].state !== 'atk'", timeout=8000)
    wait(300)
    page.keyboard.down("KeyS"); wait(40)
    page.keyboard.down("KeyD"); wait(40)
    page.keyboard.up("KeyS"); wait(40)
    page.keyboard.press("KeyJ", delay=60)
    page.keyboard.up("KeyD")
    wait(330)
    snap("15-roo-cuffs")
    check("美团袋鼠搓招 236+A 手铐飞扣", app("return A.view.match.p[0].lastMove;") == "236A", app("return A.view.match.p[0].lastMove;"))

    # 新必杀 214+B / 214+D（S → S+A → A → 键），四招各截一张出招中的画面
    def motion214(key, shot, snap_ms):
        page.wait_for_function("FG.app.view.match.p[0].state !== 'atk' && FG.app.view.match.p[1].state !== 'stun'", timeout=8000)
        app("const m = A.view.match; m.p[0].x = -9000; m.p[1].x = 3000; m.hitstop = 0;")
        wait(250)
        page.keyboard.down("KeyS"); wait(40)
        page.keyboard.down("KeyA"); wait(40)
        page.keyboard.up("KeyS"); wait(40)
        page.keyboard.press(key, delay=60)
        page.keyboard.up("KeyA")
        wait(snap_ms)
        snap(shot)
        return app("return A.view.match.p[0].lastMove;")

    got = [motion214("KeyK", "16-roo-tail-sweep", 120), motion214("Semicolon", "17-roo-flykick", 160)]
    check("美团袋鼠搓招 214+B 尾巴扫街 / 214+D 准时飞踹", got == ["214B", "214D"], got)
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    press("ArrowDown"); press("Enter"); press("Enter")
    wait(300)
    app("A.view.match.infinite = true;")
    got = [motion214("KeyK", "18-frog-belly-flop", 200), motion214("Semicolon", "19-frog-slide", 120)]
    check("奶蛙搓招 214+B 肚皮压顶 / 214+D 躺平滑铲", got == ["214B", "214D"], got)
    # 肚皮压顶落地瞬间的冲击波（不打中对手，单看落地）
    page.wait_for_function("FG.app.view.match.p[0].state !== 'atk'", timeout=8000)
    app("const m = A.view.match; m.p[0].x = -30000; m.p[1].x = 30000;")
    wait(200)
    page.keyboard.down("KeyS"); wait(40)
    page.keyboard.down("KeyA"); wait(40)
    page.keyboard.up("KeyS"); wait(40)
    page.keyboard.press("KeyK", delay=60)
    page.keyboard.up("KeyA")
    page.wait_for_function("FG.app.view.fxs.rings.some(r => r.flat)", timeout=3000)
    snap("22-frog-flop-shockwave")
    check("肚皮压顶落地出现地面冲击波", True)
    # 倒地弹跳：直接让对手进入倒地
    page.wait_for_function("FG.app.view.match.p[0].state !== 'atk'", timeout=8000)
    app("const m = A.view.match; m.p[0].x = -8000; m.p[1].x = 4000; const d = m.p[1]; d.state = 'down'; d.downLeft = FG.DOWN_FRAMES;")
    wait(90)
    snap("23-knockdown-bounce")
    wait(450)
    snap("24-getup")
    page.wait_for_function("FG.app.view.match.p[0].state !== 'atk'", timeout=8000)
    page.keyboard.down("KeyS"); wait(500)
    snap("20-frog-crouch")
    page.keyboard.up("KeyS")
    page.keyboard.down("KeyW"); wait(250)
    snap("21-frog-jump")
    page.keyboard.up("KeyW")

    # 操作说明
    page.goto(GAME_URL)
    wait(400)
    for _ in range(5):
        press("ArrowDown", 120)
    press("Enter")
    scr = app("return A.view.screen;")
    check("操作说明可进入", scr == "help", scr)
    snap("10-help")

    # ---------- 设置与存档 ----------
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    page.evaluate("localStorage.removeItem(FG.save.KEY); FG.save.reset();")
    for _ in range(4):
        press("ArrowDown", 100)
    press("Enter")
    scr = app("return A.view.screen;")
    press("ArrowLeft"); press("ArrowLeft")          # 音乐 60% → 40%
    press("ArrowDown"); press("ArrowDown"); press("ArrowDown"); press("ArrowLeft")   # 震屏 标准 → 弱
    snap("36-settings")
    check("设置：进入设置并调整音乐音量 / 震屏", scr == "settings" and app("return [FG.save.data.bgm, FG.save.data.shake];") == [0.4, 1],
          app("return [FG.save.data.bgm, FG.save.data.shake];"))
    page.reload()
    page.wait_for_function("window.FG && FG.save", timeout=15000)
    kept = page.evaluate("[FG.save.data.bgm, FG.save.data.shake]")
    check("存档：刷新页面后设置仍保留", kept == [0.4, 1], kept)
    page.evaluate("FG.save.reset();")
    # 音频：单文件版应把全部采样解码；源码版直接双击打开时浏览器禁止读本地文件，回退合成音且不报错
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    press("Enter", 200)                              # 用户交互后才允许发声
    single = page.evaluate("!!window.__FG_ASSETS__")
    if single:
        try:
            page.wait_for_function("FG.sfx.state().loaded >= FG.sfx.state().total", timeout=20000)
        except Exception:
            pass
        st = page.evaluate("FG.sfx.state()")
        wait(400)
        st = page.evaluate("FG.sfx.state()")
        check("音频：单文件版全部采样解码，并在播放背景音乐", st["loaded"] >= st["total"] and st["bgm"] in ("bgm_title", "bgm_select"), st)
    else:
        st = page.evaluate("FG.sfx.state()")
        check("音频：源码版 file:// 回退合成音（不报错）", st["ctx"] != "none", st)

    # ---------- 阶段二：选角难度 ----------
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    press("Enter")
    d0 = app("return A.view.diff;")
    press("ArrowUp"); d1 = app("return A.view.diff;")
    press("ArrowUp"); d2 = app("return A.view.diff;")
    snap("25-select-difficulty")
    press("ArrowDown"); press("ArrowDown")
    check("对战电脑：↑/↓ 切换难度（普通 → 困难，上限封顶）", d0 == 2 and d1 == 3 and d2 == 3, [d0, d1, d2])
    press("Enter")
    lv = app("return A.view.ai.level;")
    check("所选难度传给电脑", lv == 1, lv)

    # ---------- 阶段二：真实按键前冲 / 投技 ----------
    page.wait_for_function("FG.app.view.match.phase === 'fight'", timeout=8000)
    app("const m = A.view.match; m.infinite = true; m.p[0].x = -30000; m.p[1].x = 30000; A.view.ai.L = Object.assign({}, A.view.ai.L, { block: 0, throwP: 0, special: 0, dash: 0, mix: 0, anti: 0 }); A.view.ai.blockChance = 0;")
    wait(200)
    for _ in range(2):
        page.keyboard.down("KeyD"); wait(40); page.keyboard.up("KeyD"); wait(40)
    wait(30)
    st = app("return A.view.match.p[0].state;")
    check("真实按键 D D 前冲", st == "dash", st)
    page.wait_for_function("FG.app.view.match.p[0].state === 'stand'", timeout=3000)
    app("const m = A.view.match; m.p[0].x = -3500; m.p[1].x = 3500; m.p[1].state = 'stand'; A.view.ai.queue = []; A.view.ai.think = 200; A.view.ai.hold = 0;")
    page.keyboard.down("KeyK"); page.keyboard.down("Semicolon"); wait(60)
    page.keyboard.up("KeyK"); page.keyboard.up("Semicolon")
    wait(120)
    snap("26-throw")
    thr = app("return A.view.match.p[0].lastMove;")
    check("真实按键 K+; 同按发出投技", thr == "TH", thr)

    # ---------- 阶段二：训练录像 ----------
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    press("ArrowDown"); press("Enter"); press("Enter")
    wait(300)
    press("KeyO")
    rec = app("return A.view.trk.rec.mode;")
    page.keyboard.down("KeyA"); wait(400); page.keyboard.up("KeyA")
    press("KeyJ", 200)
    snap("27-training-recording")
    x_dummy = app("return A.view.match.p[1].x;")
    press("KeyO")
    n = app("return A.view.trk.rec.buf.length;")
    check("训练：O 开始录制，玩家操控假人移动", rec == "rec" and x_dummy < 18000, [rec, x_dummy])
    press("KeyP")
    wait(300)
    play = app("return [A.view.trk.rec.mode, A.view.match.p[1].x];")
    wait(500)
    snap("28-training-playback")
    check("训练：P 回放录像，假人重复录下的动作", play[0] == "play" and n > 20 and play[1] < 18000, [play, n])
    # 实测帧优势出现在面板上
    press("KeyP")
    app("const m = A.view.match; m.p[0].x = -5000; m.p[1].x = 0;")
    wait(100)
    press("KeyJ", 700)
    adv = app("return A.view.trk.adv;")
    snap("29-training-adv")
    check("训练：实测帧优势显示（5A 命中 +3）", adv == 3, adv)

    # ---------- 阶段二：闯关 ----------
    page.goto(GAME_URL)
    page.wait_for_function("window.FG && FG.sprites && FG.sprites.allLoaded()", timeout=15000)
    for _ in range(3):
        press("ArrowDown", 120)
    press("Enter")
    mode = app("return A.view.mode;")
    snap("30-arcade-select")
    press("Enter")
    scr = app("return A.view.screen;")
    snap("31-arcade-story-1")
    check("闯关：选角后进入第一关对白", mode == "arcade" and scr == "story", [mode, scr])
    for _ in range(3):
        press("Enter", 150)
    st1 = app("return [A.view.screen, A.view.ai.level, A.view.match.p[1].fid];")
    check("闯关第一关：对白结束开打，对手美团袋鼠、简单", st1 == ["fight", 1, "roo"], st1)
    # 直接让 P1 赢下整场（逻辑层设置胜场再触发结算），验证关卡推进
    def win_match():
        app("const m = A.view.match; m.wins[0] = m.maxWins; m.matchWinner = 0; m.phase = 'matchEnd'; A.arcadeAfterMatch();")
        wait(150)
    win_match()
    st2 = app("return [A.view.screen, A.view.arc.stage];")
    snap("32-arcade-story-2")
    check("闯关：赢下后进入第二关对白", st2 == ["story", 1], st2)
    for _ in range(3):
        press("Enter", 150)
    page.wait_for_function("FG.app.view.match.phase === 'fight'", timeout=8000)
    wait(300)
    st3 = app("return [A.view.mirror, A.view.match.p[1].fid, A.view.match.p[1].name, A.view.ai.level];")
    snap("33-arcade-mirror-fight")
    check("闯关第二关：暗黑奶蛙镜像对决、普通", st3 == [True, "frog", "暗黑奶蛙", 2], st3)
    # 输一场 → 续关
    app("const m = A.view.match; m.wins[1] = m.maxWins; m.matchWinner = 1; m.phase = 'matchEnd'; A.arcadeAfterMatch();")
    wait(150)
    snap("34-arcade-continue")
    press("Enter")
    st4 = app("return [A.view.screen, A.view.arc.stage, A.view.arc.continues];")
    check("闯关：输了可续关，回到同一关对白", st4 == ["story", 1, 1], st4)
    for _ in range(3):
        press("Enter", 150)
    win_match()
    for _ in range(3):
        press("Enter", 150)
    st5 = app("return [A.view.screen, A.view.ai.level, A.view.match.p[1].fid];")
    check("闯关最终关：美团袋鼠、困难", st5 == ["fight", 3, "roo"], st5)
    win_match()
    wait(900)
    snap("35-arcade-ending")
    st6 = app("return A.view.screen;")
    check("闯关：通关进入结局", st6 == "ending", st6)
    press("Enter")
    check("结局按 Enter 返回标题", app("return A.view.screen;") == "title")
    page.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    errors, checks = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        res = unit(browser, errors)
        smoke(browser, errors, checks)
        browser.close()

    print("== 单元测试（%d 项）==" % len(res["rows"]))
    for r in res["rows"]:
        print(("PASS " if r["pass"] else "FAIL ") + r["name"] + (("  [" + r["extra"] + "]") if r["extra"] else ""))
    print("== 真实按键冒烟（%d 项）==" % len(checks))
    for name, cond, detail in checks:
        print(("PASS " if cond else "FAIL ") + name + (("  [" + detail + "]") if detail else ""))
    print("== 页面报错 ==")
    print("\n".join(errors) if errors else "无")
    good = bool(res["pass"]) and all(c for _, c, _ in checks) and not errors
    print("总结：" + ("全部通过" if good else "存在失败"))
    print("截图目录：" + str(OUT))
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
