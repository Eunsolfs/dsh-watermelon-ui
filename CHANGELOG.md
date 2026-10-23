# Changelog

## 0.2.0 — 2026-10-23

### 新增

- `scripts/snapshot.mjs`：用公开 catalog API 重新生成 `data/catalog.json` / `data/summary.json`。带指数退避重试、4 路并发、稳定排序（kind → category → slug），以及与 summary 计数核对——**不完整就不写盘**。
- `npm test` / `npm run verify`（等价 `node scripts/verify.mjs`）与 `npm run snapshot` 入口。
- GitHub Actions `verify` 工作流：Node 22 / 24，安装前静态 + 运行时自检。
- `README.en.md`（英文说明）与中文 README 的语言切换。
- `.gitattributes`：统一 LF；把 `data/*.json` 标记为生成物。
- `lib/repo/catalog.js` 改为按文件 mtime 缓存：跑完 `npm run snapshot` 覆盖快照后，下一次工具调用自动读到新数据，不需要重启 Harness。

### 修复

- 上游有两条条目的安装命令是坏的：`card-15` 写成 `npx shadcn@latest add Card`，`command-search` 少了 `/r/` 段。快照生成时按 registry 固定规则 `r/<slug>.json` 修正（两者实测 registry 都存在），而不是把坏命令原样发给模型。
- 多词检索（如「定价 卡片」）原先只按字段权重排序，结果会被数量占优的单概念条目淹没（94 个 Card 压掉全部 pricing 区块）。`watermelon_catalog_search` 改为**先按命中词数、再按字段权重**排序。
- `scripts/verify.mjs` 增加快照一致性检查：各 kind 计数、重复条目、安装命令与 slug 是否对应、是否按 kind→category→slug 稳定排序、`summary.json` 与 `catalog.json` 是否自洽。

### 变更

- README：修正 MCP 行 entryId（`include:watermelon-mcp`）与技能名（`watermelon-ui`）；补 `git clone` 安装路径、`remove_bundle` 回滚与快照刷新说明。
- `package.json`：增加 `repository` / `homepage` / `bugs` 与 `scripts` 字段，加入 `LICENSE` 到发布文件白名单。

## 0.1.0 — 2026-10-23

首次发布。

- 内置技能 `watermelon-ui`：技术栈门禁、检索流程、安装四步、MIT 署名要求、常见坑。
- `watermelon_catalog_search`：离线目录词面检索（中英词表映射），返回预览、依赖与 shadcn 安装命令。
- `watermelon_install_plan`：单个 slug 的安装计划（命令、依赖、门禁、装后核对、署名）。
- 可选 `watermelon-mcp` 行：接入官方托管 MCP（`https://mcp.watermelon.sh/mcp`，默认关闭）。
- 离线快照 `data/catalog.json`：849 条（516 组件 / 131 动画组件 / 189 区块 / 12 仪表盘 / 1 模板），不含组件源码。
