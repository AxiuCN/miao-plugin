# miao-plugin / 喵喵插件

> 基于 [yoimiya-kokomi/miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin) 的 fork 改版，由 [AxiuCN](https://github.com/AxiuCN) 维护，接入 TRSS-Yunzai v3。

`miao-plugin` 是 `Yunzai-Bot` 的升级插件，提供原神 / 星铁角色面板查询、伤害计算、圣遗物评分等角色相关功能。本 fork 在保留上游全部能力的基础上，新增了**面板变换**、**指定面板图**、**最高分 / 最强面板**等特色功能。

具体功能可在安装插件后通过 `#喵喵帮助` 查看，设置通过 `#喵喵设置` 管理。

> 更多上游功能与完整使用说明参见 [原版 README（yoimiya-kokomi）](README_yoimiya-kokomi.md)。

## 安装

将 miao-plugin 放置在 Yunzai-Bot 的 `plugins` 目录下，重启 Yunzai-Bot 后即可使用。在 Yunzai 根目录执行下述任一命令：

```bash
# GitHub（主仓库）
git clone --depth=1 https://github.com/AxiuCN/miao-plugin.git plugins/miao-plugin
pnpm install -P

# Gitee（备份源）
git clone --depth=1 https://gitee.com/AxiuCN/miao-plugin plugins/miao-plugin
pnpm install -P

# GitCode（备份源）
git clone --depth=1 https://gitcode.com/AxiuCN/miao-plugin.git plugins/miao-plugin
pnpm install -P
```

安装完毕后，管理员发送 `#喵喵更新` 即可自动更新。

**切换源**：默认源不可用时，可在云崽目录执行换源命令：

```bash
# 换到 GitHub
git -C plugins/miao-plugin remote set-url origin https://github.com/AxiuCN/miao-plugin.git

# 换到 Gitee
git -C plugins/miao-plugin remote set-url origin https://gitee.com/AxiuCN/miao-plugin

# 换到 GitCode
git -C plugins/miao-plugin remote set-url origin https://gitcode.com/AxiuCN/miao-plugin.git
```

## 功能

### Fork 特有功能

#### 面板变换

通过 `换` / `补` / `变` / `改` 关键字对查询的面板进行变换，支持换装、属性数值变换，并在伤害旁显示变化百分比（↑/↓）。

| 指令 | 说明 |
|------|------|
| `#胡桃面板 换少女头` | 面板换装 |
| `#胡桃面板 +30暴击 -10%大攻击` | 属性数值变换（`+`/`-` 前缀；百分比仅对 atk/hp/def 按基础值计算） |
| 直接发送面板截图 | 触发 OCR 图片识别，自动解析并应用变换 |

- 支持换武器、换圣遗物、换命座、属性变换的组合叠加
- 面板变换构建"虚拟面板"，不修改已获取的真实面板数据
- 变换后面板可与原面板对比，伤害数字旁显示差异（绿色 ↑ / 红色 ↓）

#### 指定面板图

查询面板时可携带 `面板图N` 独立 token（空格分隔，可出现在命令任意位置），指定使用 [ProfileImg-Plugin](https://github.com/AxiuCN/ProfileImg-Plugin) 图库中编号为 N 的面板图：

| 指令 | 说明 |
|------|------|
| `#胡桃面板 面板图1` | 使用图库编号 1 的面板图 |
| `#胡桃面板 面板图1 换少女头` | 指定面板图 + 换装变换（顺序无关） |
| `#胡桃圣遗物 面板图3` | 圣遗物模式 + 指定面板图 |

- 编号 N 对应 ProfileImg-Plugin 主图库文件名中的序号（`角色名_n_作者_来源.ext`）
- 未指定时保持随机选图（向后兼容）；序号不存在时静默回退随机
- 依赖 ProfileImg-Plugin 主图库，未安装时忽略该 token

#### 最高分 / 最强面板

| 指令 | 说明 |
|------|------|
| `#我的胡桃最高分面板魔女4` | 回溯搜索圣遗物组合，评分最高的搭配 |
| `#我的胡桃最强面板魔女4` | 枚举散件位配置 × 坐标上升收敛，求伤害最高的搭配（需指定套装） |

- 最高分面板：mark 评分最大化，纯评分搜索
- 最强面板：同时评估伤害，结果确定可复现（非随机）

#### 圣遗物初始值 / 成长值

| 指令 | 说明 |
|------|------|
| `#胡桃圣遗物初始值` | 查看圣遗物词条初始值 |
| `#丝柯克圣遗物成长值` | 查看圣遗物词条成长值 |

### 通用功能

#### 面板查询

使用指令 `#面板帮助` 即可了解如何使用此功能。

| 指令 | 说明 |
|------|------|
| `#雷神面板` | 查询角色面板（默认随机面板图，可加 `面板图N` 指定） |
| `#更新面板` | 刷新游戏橱窗详情数据 |
| `#雷神伤害` | 伤害计算（本地计算，可指定伤害序号 `#雷神伤害3`） |
| `#雷神圣遗物` | 圣遗物模式（喵喵版评分规则） |

`#更新面板` 依赖于面板查询 API，默认由 http://enka.network/ 提供。可发送 `#喵喵设置面板服务332` 将国服&B服的面板查询切换到 `MiniGG-Api` 处理。

#### 其他功能

| 模块 | 说明 |
|------|------|
| 角色查询 | `#喵喵角色` 查看角色信息、老婆系统、原图 |
| 抽卡统计 | `#喵喵抽卡记录` / `#喵喵抽卡统计`（原神 / 星铁） |
| 深渊统计 | `#喵喵深渊统计`、幻想真境剧诗 / 幽境危战统计、角色卡 |
| 角色资料 | `#喵喵WIKI`、角色/天赋材料日历、今日素材 |
| 喵喵设置 | `#喵喵设置`、`#喵喵更新`、`#喵喵帮助` |

## 面板服务

支持多面板服务源，发送 `#喵喵设置面板服务{编号}` 切换：

| 服务 | 原神 | 星铁 |
|------|------|------|
| Enka | Enka.Network | - |
| Enka HSR | - | Enka HSR |
| MiniGG-Api | MiniGG-Api | - |
| 喵喵 API | 需 token | 喵喵 API |
| Hutao-Enka | 胡桃 API | - |
| Mihomo / Avocado | - | 星铁面板服务 |
| 米游社 | 米游社面板 | 米游社面板 |

## 配置

- **面板设置**：`#喵喵设置` 命令可视化配置（面板服务、面板替换、原图、练度统计等）
- **锅巴后台**：支持 [Guoba-Plugin](https://github.com/guoba-yunzai/Guoba-Plugin) 可视化配置
- **自定义配置**：编辑 `config/profile.js`、`config/character_default.js`（角色/别名）

## 免责声明

1. `miao-plugin` 自身的 UI 与代码均开放，无需征得特殊同意，可任意使用。能备注来源最好，但不强求
2. 以上声明仅代表 `miao-plugin` 自身的范畴，请尊重 Yunzai 本体及其他插件作者的努力，勿将 Yunzai 及其他插件用于以盈利为目的的场景
3. miao-plugin 的图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除

## 鸣谢

- [yoimiya-kokomi/miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin) — 上游原版，本 fork 的基础
- [Enka.Network](https://enka.network/) — 感谢 Enka 提供的面板服务
- [ark-plugin](https://github.com/NotIvny/ark-plugin) — 面板变换伤害差异显示与 OCR 图片识别
- [ProfileImg-Plugin](https://github.com/AxiuCN/ProfileImg-Plugin) — 面板图图库管理器，`面板图N` 指定功能的依赖