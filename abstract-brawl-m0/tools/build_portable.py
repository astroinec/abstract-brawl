#!/usr/bin/env python3
"""便携包：把单文件试玩版打成一个可拷贝、可离线运行的文件夹 + ZIP。
用法：python3 tools/build_portable.py [版本号]
依赖：先运行 tools/build_release.py 生成同版本的单文件 HTML。
产物：../release/抽象格斗-便携版-<版本>/  以及同名 .zip
  抽象格斗.html                 游戏本体（离线、双击即玩）
  启动游戏 (Mac).command        用 Chrome / Edge 的应用窗口打开，没有地址栏；找不到时用默认浏览器
  启动游戏 (Windows).bat        同上（Edge 为 Windows 自带）
  玩法说明.txt / 素材与授权.txt
"""
import pathlib
import shutil
import stat
import sys
import time
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
REL = ROOT.parent / "release"
VER = sys.argv[1] if len(sys.argv) > 1 else "v0.8.0"
single = REL / ("abstract-brawl-m0-本地试玩-" + VER + ".html")
if not single.exists():
    sys.exit("缺少 " + single.name + "，请先运行 tools/build_release.py " + VER)

name = "抽象格斗-便携版-" + VER
out = REL / name
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
shutil.copy(single, out / "抽象格斗.html")

MAC = r'''#!/bin/bash
# 抽象格斗 · Mac 启动脚本：优先用 Chrome / Edge 的"应用窗口"打开（没有地址栏，更像游戏）
cd "$(dirname "$0")"
GAME="file://$(pwd)/抽象格斗.html"
DATA="$HOME/Library/Application Support/AbstractBrawl"
for APP in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser"; do
  if [ -d "/Applications/$APP.app" ] || [ -d "$HOME/Applications/$APP.app" ]; then
    # 独立的用户目录：存档与日常浏览器分开，也不会弹出"恢复页面"
    open -na "$APP" --args --app="$GAME" --user-data-dir="$DATA" --start-fullscreen --autoplay-policy=no-user-gesture-required
    exit 0
  fi
done
open "抽象格斗.html"
'''
WIN = '''@echo off
rem 抽象格斗 · Windows 启动脚本：优先用 Edge / Chrome 的应用窗口打开（没有地址栏）
chcp 65001 >nul
cd /d "%~dp0"
set "GAME=file:///%CD:\\=/%/抽象格斗.html"
set "DATA=%LOCALAPPDATA%\\AbstractBrawl"
set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
set "CHROME=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app="%GAME%" --user-data-dir="%DATA%" --start-fullscreen --autoplay-policy=no-user-gesture-required
  exit /b
)
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%GAME%" --user-data-dir="%DATA%" --start-fullscreen --autoplay-policy=no-user-gesture-required
  exit /b
)
start "" "抽象格斗.html"
'''
README = '''抽象格斗 · 黄色三幻神夜市乱斗  ''' + VER + '''
====================================

【怎么开始】
  Mac：双击「启动游戏 (Mac).command」。
       第一次如果提示"无法验证开发者"，请右键该文件 → 打开 → 打开。
  Windows：双击「启动游戏 (Windows).bat」。
  也可以直接双击「抽象格斗.html」，用任意浏览器打开（推荐 Chrome / Edge）。
  不需要联网，不需要安装。整个文件夹可以拷到 U 盘、发给朋友。

【全屏】
  启动脚本默认全屏；按 F11（Mac 为 Ctrl+Cmd+F）切换。

【存档】
  设置与闯关通关记录保存在浏览器里。用启动脚本打开时，存档在独立目录，
  不会和你日常用的浏览器混在一起：
    Mac：~/Library/Application Support/AbstractBrawl
    Windows：%LOCALAPPDATA%\\AbstractBrawl
  直接双击 html 打开时，存档跟随所用的浏览器。

【操作】
  P1 移动：W 跳 · S 蹲 · A 左 · D 右
  P1 攻击：J 轻拳 · K 重拳 · L 轻脚 · ; 重脚
  P2：方向键移动，N M , . 依次为四个攻击键
  手柄：左摇杆 / 十字键移动，A B X Y 为四个攻击键，Start 暂停
  Esc 暂停；标题画面「设置」可调音量、震屏、默认难度

【系统】
  66 前冲 · 44 后撤（开头无敌）
  近身同按 重拳+重脚 投技（被抓瞬间同按可拆投）
  防御中同按 轻脚+重脚 防御反击（半格能量）
  被击倒瞬间按任意键受身
  搓招方向按朝向换算（前 = 面向对手），出招表见游戏内「操作说明」

【模式】
  单机对战（三档难度）· 训练（帧数据、连段、录制回放假人）· 本地双人 · 闯关（三关 + 结局）
'''
CREDITS = '''素材与授权
==========
本作品为个人娱乐用的同人二创，非商业用途，请勿用于任何商业场合。

角色形象：奶蛙、美团袋鼠为网络流行梗的二创形象，姿势与插图由 AI 重绘。
舞台、特效、标题招牌：AI 生成。
字体：ZCOOL KuaiLe（站酷快乐体），SIL Open Font License 1.1，已裁剪为游戏用字子集。
背景音乐、风声、防御反击音效：取自《王者荣耀》客户端素材，版权归腾讯所有，仅限个人娱乐。
打击 / 界面音效：Kenney「Impact Sounds」「Interface Sounds」，CC0（www.kenney.nl）。
播报语音：macOS 语音合成「婷婷」。
'''
(out / "启动游戏 (Mac).command").write_text(MAC, encoding="utf-8")
(out / "启动游戏 (Windows).bat").write_bytes(WIN.replace("\n", "\r\n").encode("utf-8"))
(out / "玩法说明.txt").write_text(README, encoding="utf-8")
(out / "素材与授权.txt").write_text(CREDITS, encoding="utf-8")
mac = out / "启动游戏 (Mac).command"
mac.chmod(mac.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

zpath = REL / (name + ".zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.iterdir()):
        info = zipfile.ZipInfo(name + "/" + p.name, date_time=time.localtime(p.stat().st_mtime)[:6])
        info.compress_type = zipfile.ZIP_DEFLATED
        # 保留 .command 的可执行权限，解压后能直接双击
        mode = 0o755 if p.suffix == ".command" else 0o644
        info.external_attr = (stat.S_IFREG | mode) << 16
        info.flag_bits |= 0x800   # 文件名使用 UTF-8
        z.writestr(info, p.read_bytes())
print("portable:", out)
print("zip:", zpath, zpath.stat().st_size, "bytes")
