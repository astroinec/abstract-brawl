# 抽象格斗 · 黄色三幻神夜市乱斗（With 工作副本）

从 WorkBuddy 工作区 `~/WorkBuddy/2026-08-07-16-57-26/output/abstract-brawl-m0` 复制而来（2026-10-20，v0.4.0），当前版本 v0.8.0。之后的修改都以这里为准。

## 目录

- `abstract-brawl-m0/`：游戏源码，入口 `index.html`（浏览器直接打开）
- `release/`：单文件试玩 HTML（可离线双击）与源码 ZIP
- `art/`：AI 姿势表原图、二创参考图、切图脚本 `split_sheet.py`、姿势总览
- `screenshots/`：自动化测试截图
- `项目日志-2026-10-20.md`：当天的开发记录

## 常用命令（在 `abstract-brawl-m0/` 下执行）

```bash
PY=~/.workbuddy/binaries/python/envs/default/bin/python
$PY tests/run_browser_tests.py            # 单元测试 + 真实按键冒烟，截图写到 ../screenshots
$PY tools/build_release.py v0.8.1         # 单文件 HTML + 源码 ZIP 到 ../release
$PY tools/build_portable.py v0.8.1        # 便携版文件夹 + ZIP（需先跑上一条）
$PY ../art/split_sheet.py ../art/xxx.png frogx_ 名1 名2 名3 名4   # 姿势表抠图切分到 assets/
```

## 招式

- 奶蛙：236+A 舌鞭 · 623+B 大笑弹跳 · 214+B 肚皮压顶 · 214+D 躺平滑铲 · 236+C 齁齁齁连打（超杀）
- 美团袋鼠：236+A 手铐飞扣 · 623+B 胆大上勾 · 214+B 尾巴扫街 · 214+D 准时飞踹 · 236+C 胆子真是肥嘟嘟的（超杀）

## 模式

- 单机 · 对战电脑：选角界面 ↑/↓ 切换难度（简单 / 普通 / 困难）
- 训练模式：H 判定框 · T 假人 · R 重置 · I 无限血 · O 录制假人（由你操控）· P 回放录像；面板实时显示帧优势和连段伤害
- 本地双人
- 闯关模式：三关（对手 → 暗黑同角色 → 对手），难度依次为简单、普通、困难，有开场对白、续关和结局

## 系统

- 66 前冲（途中可直接出招）· 44 后撤（开头 9 帧无敌）
- 近身同按 B+D 投技（不可防御；被抓瞬间同按 B+D 拆投）
- 防御硬直中同按 C+D 防御反击（消耗半格能量，开头无敌，打中击倒）
- 被击倒后 12 帧内按任意键受身（向后翻滚，快速起身）

