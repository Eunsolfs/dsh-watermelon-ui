# dsh-watermelon-ui

简体中文 | [English](README.en.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

把 [Watermelon UI](https://ui.watermelon.sh) 接进 DeepSeek Harness：一个内置技能 + 两个离线目录工具，外加官方托管 MCP 的可选接入。安装后 agent 会先判断「这个项目到底适不适合用 Watermelon」，再给出准确的 shadcn 安装命令，而不是凭记忆编 slug。

## 能力

| 组成 | 作用 |
|---|---|
| 技能 `watermelon-ui` | 技术栈门禁（React + Tailwind + shadcn 才能用）、检索流程、安装四步、MIT 署名要求、常见坑 |
| `watermelon_catalog_search` | 在离线目录里检索条目（中英文词面匹配），返回预览、依赖与安装命令 |
| `watermelon_install_plan` | 给某个 slug 出安装计划：命令、依赖、前置门禁、装后核对项、署名提示 |
| `watermelon-mcp`（默认关闭） | 接官方托管 MCP `https://mcp.watermelon.sh/mcp`：语义检索、取组件源码、页面编排计划 |

离线目录来自 Watermelon 公开 catalog API 的索引快照（当前快照日期见 `data/catalog.json` 的 `fetchedAt`），**不含组件源码**；源码请用 MCP 的 `get_component` 或 `https://registry.watermelon.sh/r/<slug>.json`。

## 安装

```bash
git clone https://github.com/Eunsolfs/dsh-watermelon-ui.git
```

然后在 Harness 里用 `plugin_manager`，把 `target` 指向克隆下来的目录：

```json
{ "action": "install_bundle", "target": "C:\\path\\to\\dsh-watermelon-ui" }
```

安装后立即生效：新会话能看到 `watermelon-ui` 技能与两个工具。`watermelon-mcp` 行默认 `disabled: true`，需要语义检索/源码时启用它（注意 entryId 是 `include:watermelon-mcp`，不是 `watermelon-mcp`）：

```json
{ "action": "set_plugin", "target": "include:watermelon-mcp", "enabled": true }
```

启用代价：启动时多一次网络握手（网络不通会等到 SDK 超时），模型工具表里多 8 个 `mcp__watermelon__*` 工具。不需要就保持关闭——本地工具已经能给出安装命令。

回滚：

```json
{ "action": "remove_bundle", "target": "dsh-watermelon-ui" }
```

## 本地校验（安装前）

```bash
npm test        # 等价 node scripts/verify.mjs
```

不联网、不安装，检查：JSON/快照字段、工具 SchemaSpec 方言、两个工具的真实执行与输出契约、Markdown 渲染、技能 frontmatter、patch 形状。全部打印 `ALL CHECKS PASSED` 才算可安装。CI（GitHub Actions）在 Node 22 / 24 上跑同一套检查。

## 刷新目录快照

Watermelon 上游随时会加条目，`data/catalog.json` 是某一时刻的快照（日期见 `fetchedAt`）。要更新：

```bash
npm run snapshot            # 抓取并写入 data/
npm run snapshot -- --dry-run   # 只看统计，不写文件
```

脚本只读公开 API、免鉴权。上游限制是 `limit≤50`、无 offset、`summary` 不返回分类，所以它**沿用 `data/summary.json` 里的分类清单做枚举线索**，再补上首页新出现的分类；最后与 summary 计数核对，**不一致就退出码 1 且不写盘**，避免把残缺快照提交上去。刷新后请重跑 `npm test`。

## 配置

`cordis.patch.yml` 里 `watermelon-ui` 行支持两个字段：

| 字段 | 默认 | 含义 |
|---|---|---|
| `defaultResults` | `5` | `watermelon_catalog_search` 未显式传 `limit` 时的默认条数（1–8） |
| `skill` | `true` | 是否注册内置 `watermelon-ui` 技能（`false` 时两个工具照常可用） |

## 结构

```
index.js               薄入口（重导出）
cordis.patch.yml       bundle patch：本插件行 + 可选的 MCP 行
icon.svg / locale/     显示元数据（中英文）与原创图标
skills/watermelon-ui/  内置技能正文（SKILL.md）
data/catalog.json      离线目录快照（849 条，无源码）
scripts/verify.mjs     安装前自检（离线）
scripts/snapshot.mjs   重新生成目录快照（联网，只读公开 API）
lib/plugin/            宿主适配：apply、技能注册、SchemaSpec 方言守卫
lib/tools/             两个模型工具
lib/search/            检索打分与中英词表
lib/repo/              快照读取与派生
lib/presentation/      Markdown 渲染
```

## 许可

本插件代码 MIT。Watermelon UI 的组件源码同样以 MIT 发布；复制组件时请保留其版权与许可声明，并注明来源与条目链接（条款以 [Watermelon 版权页](https://ui.watermelon.sh/copyright) 为准）。目录快照数据来自 Watermelon 公开 catalog API。
