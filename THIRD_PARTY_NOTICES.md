# THIRD_PARTY_NOTICES

## Watermelon UI

- 项目：Watermelon UI — https://ui.watermelon.sh
- 本插件包含的数据：`data/catalog.json`、`data/summary.json`
- 数据来源：Watermelon UI 公开 catalog API
  - `GET https://ui.watermelon.sh/api/v1/catalog/summary`
  - `GET https://ui.watermelon.sh/api/v1/catalog/entries?kind=<kind>&category=<category>&limit=50`
- 数据内容仅限目录索引字段（kind / slug / title / description / category / previewUrl / registryUrl / installCommand / dependencies），
  按类别分页抓取后合并去重；**不包含组件源码**。
- 快照日期：见 `data/catalog.json` 顶层的 `fetchedAt`。
- 上游许可：Watermelon UI 以 MIT 许可发布（其 https://ui.watermelon.sh/llms.txt 明确声明）。
  复制其组件源码进项目时，请保留版权与许可声明；条款以其 https://ui.watermelon.sh/copyright 为准。

## 托管 MCP

`cordis.patch.yml` 里的 `watermelon-mcp` 行使用 Harness 自带的
`@deepseek-ai/dsh-mcp-client` 连接 Watermelon 官方托管 MCP `https://mcp.watermelon.sh/mcp`。
本仓库不分发该客户端的任何代码，也不缓存其响应。
