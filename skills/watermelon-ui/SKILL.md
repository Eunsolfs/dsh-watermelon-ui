---
name: watermelon-ui
description: Watermelon UI 接入技能：先做技术栈与设计体系门禁（React + Tailwind + shadcn 才能用），再用托管 MCP 的语义检索/源码工具或本插件离线目录找到条目，给出可执行的 shadcn 安装命令、依赖清单、装后核对项与 MIT 署名要求。
whenToUse: 在 React + Tailwind 项目里要加界面区块、组件或动画；判断某个设计该不该用 Watermelon UI；要写 shadcn 安装命令、或处理第三方组件署名与许可时使用。
---

# Watermelon UI 接入（watermelon-ui）

Watermelon UI 是一个 MIT 许可的开源 React UI 目录：基础组件、动画组件、页面区块、仪表盘、整页模板。它跟 shadcn/ui 一样是**复制源码进项目**的模式，**不是 npm 包**——所以「什么时候可以用」比「能搜到什么」更重要。本技能管三件事：**门禁**（能不能用）、**检索**（用哪个）、**落地**（怎么装、怎么署名）。

## 一、先过门禁，再动手

| 检查项 | 可以 | 不可以 / 要停 | 怎么快速确认 |
|---|---|---|---|
| 框架 | React（Next.js App Router、Vite+React 等都行） | Vue / Svelte / Angular / Solid / React Native / 小程序 / 纯 HTML | `package.json` 有 `react`，界面文件是 `.tsx`/`.jsx` |
| 样式体系 | Tailwind CSS | CSS Modules、styled-components、纯 CSS 项目 | `tailwind.config.*`，或 Tailwind v4 的 `@import "tailwindcss"` |
| shadcn 约定 | 已有 `components.json` 与 `@/*` 路径别名 | 还没初始化 | 项目根 `components.json`；没有就先 `npx shadcn@latest init` |
| 设计体系冲突 | 空项目，或本来就用 shadcn/ui | 同一批页面已被 MUI / Ant Design / Chakra / Mantine 接管 | 看 `package.json` 依赖 |
| 合规 | 仓库允许复制第三方源码；MIT 保留署名即可 | 禁止引入外部源码的仓库 | 问人；不要替用户做合规决定 |

判定规则（照做，不要跳）：
- 任一项「不可以」→ **不要装**。直接说明原因，给替代方案（自研组件 / 换库 / 先让用户决定）。
- 任一项是「要停」→ 先把冲突点讲清楚并等用户选择，不要默认继续。
- 全部通过 → 进入检索。

## 二、检索：按可用性选一种，不要三种都调

**1) 托管 MCP（最全：能语义搜索、能取源码）。** 只有工具表里出现 `mcp__watermelon__*` 时才用，说明 `watermelon-mcp` 行已启用；没出现就不要凭名字硬编，它默认是关闭的（见本 bundle 的 `cordis.patch.yml`）。

| MCP 工具 | 用途 |
|---|---|
| `mcp__watermelon__search` | 自然语言找条目：`query`、`kinds`、`category`、`limit` |
| `mcp__watermelon__get_inspiration` | 先看 3–6 个方向再定实现 |
| `mcp__watermelon__get_component` | 拿某条的预览图、依赖、安装命令与源码文件 |
| `mcp__watermelon__compose_page` | 多区块页面编排计划（首屏/特性/定价/页脚等） |
| `mcp__watermelon__list_categories`、`catalog_summary` | 摸清目录规模与类别计数 |

**2) 本地离线目录工具（不需要网络，但只到条目级，不给源码）。**

- `watermelon_catalog_search`：中英文词面检索，返回标题/类别/预览/依赖/安装命令。
- `watermelon_install_plan`：给某个 slug 出完整安装计划（命令 + 依赖 + 门禁 + 装后核对项 + 署名提示）。

离线索引是公开 catalog API 的分页快照，只有标题、描述、类别、预览与 registry 地址，**没有组件源码**；中文查询会映射成英文关键词后再匹配。

**3) HTTP 兜底（没有本插件工具、或要自己核实时）。** 全部只读、无需 API Key：

```
GET https://ui.watermelon.sh/api/v1/catalog/summary
GET https://ui.watermelon.sh/api/v1/catalog/entries?kind=blocks&query=pricing&limit=20
GET https://ui.watermelon.sh/api/v1/catalog/entries/{kind}/{slug}
GET https://registry.watermelon.sh/r/{slug}.json          # 源码在这里：files[].content
```

`kind` 取值：`components` / `animated-components` / `blocks` / `dashboards` / `templates`。`limit` 上限 50，要全量就按 `category` 分页。

选择规则：能语义检索就走 MCP；断网或没启用 MCP 就用本地工具；两者都没有再走 HTTP。**不要凭记忆编造 slug、预览链接或安装命令**——命令里的 slug 必须来自检索结果或 registry JSON。

## 三、落地：装组件的标准四步

1. **确认 shadcn 已初始化**：项目根有 `components.json`；没有先 `npx shadcn@latest init`（否则 CLI 没有写入位置）。
2. **执行安装**：

   ```bash
   npx shadcn@latest add https://registry.watermelon.sh/r/<slug>.json
   ```

   CLI 会把源码写到 registry 指定的路径（通常是 `src/components/watermelon-ui/<slug>.tsx`），并按 registry 条目安装 npm 依赖、补齐 `registryDependencies`（例如 `badge`、`button`）。
3. **接进页面**：组件通常是默认导出，直接 import；改文案和数据就改组件内部的 props / 常量，**不要去改 `components/ui/*` 下的 shadcn 基础件**。
4. **自检**：见第五节。

**选原版还是 `-base` 版**：
- `<slug>`：原版，视觉更完整，常用于营销页、独立落地页。
- `<slug>-base`：theme-ready 版本，去掉固定色/渐变，跟随项目主题 token。要融进既有设计系统时优先它。

**有些条目没有安装包**：少数区块（例如部分 footer）在目录里只有预览，没有对应的 shadcn registry 包。工具结果里 `installable: false` 就是这个意思——**不要自己拼 registry URL**，按预览自己实现，或换一个同类条目。

**装不上时先查这几条**：
- `components.json` 里 `aliases` / tsconfig 的 `@/*` 没配 → CLI 找不到写入路径。
- Tailwind 主版本不匹配（v3 项目遇到 v4 语法，或反之）→ 按报错调整配置，不要硬抄。
- 依赖版本冲突（`motion`、`lucide-react`）→ 交给 CLI 安装，必要时手动对齐。
- 装完是透明块/黑块 → 缺 shadcn 的 CSS 变量（`--background`、`--muted-foreground` 等），先补主题 token。

## 四、署名与许可，别省

- Watermelon UI 以 **MIT** 许可发布（其 `llms.txt` 明确声明）。MIT 要求保留版权声明与许可文本。
- 复制源码后，在仓库 README 或组件文件头注明「来源 Watermelon UI（https://ui.watermelon.sh），MIT License」，并附上具体条目链接；原始 LICENSE 的版权行不要删。
- 具体条款以 https://ui.watermelon.sh/copyright 为准；拿不准就保守保留署名，不要反过来声称「可以省略」。
- 改过源码仍然要署名；不要把它包装成官方版本或自有原创。

## 五、交付前自检

- [ ] 门禁五项都过（React / Tailwind / shadcn / 无冲突框架 / 允许引入）
- [ ] 安装命令来自工具结果或 registry JSON，不是手写猜的
- [ ] 依赖装齐，类型检查或 build 通过
- [ ] 深浅色模式分别看：对比度、边框、阴影是否成立
- [ ] 交互组件键盘可达、焦点管理正确、尊重 `prefers-reduced-motion`
- [ ] 保留 MIT 署名，README 有来源链接
- [ ] 没有覆盖 `components/ui/*` 基础件

## 六、什么时候不要用 Watermelon

- 需要稳定 npm 包与可控升级策略：copy-in 源码意味着升级要手动 diff。
- 需要企业级复杂表格、图表、日期组件，且已深度定制：用对应的专业库更稳。
- 只缺三五个基础控件：shadcn/ui 本身够了。
- 非 React 技术栈。
