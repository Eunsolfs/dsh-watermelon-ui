/**
 * tools/catalog-search.js — watermelon_catalog_search 工具定义
 */

import { TIMEOUTS } from '../config.js'
import { formatSearchResult } from '../presentation/index.js'
import { capabilitySummaryZh, KIND_KEYS } from '../repo/catalog.js'
import { searchCatalog } from '../search/index.js'
import { array, integer, stringEnum, text } from './schema.js'

const compactLabel = entry => `${entry.title}（${entry.kind}/${entry.slug}）`

export const catalogSearchTool = {
  name: 'watermelon_catalog_search',
  description:
    '在 Watermelon UI 离线目录中查找 React 组件、动画组件、页面区块、仪表盘与模板' +
    `（${capabilitySummaryZh()}）。返回条目摘要、预览链接和可直接执行的 shadcn 安装命令；` +
    '只做标题/描述/类别/slug 的词面匹配，不做语义检索，也不返回组件源码。',
  timeoutMs: TIMEOUTS.catalogSearch,
  isConcurrencySafe: () => true,
  parameters: {
    query: text('检索词，中英文均可（中文概念会映射成英文语料），例如「定价 卡片」「pricing hero」「数据表」。省略时按 kind/category 浏览目录。'),
    kind: stringEnum(
      KIND_KEYS,
      '限定内容类型（可选）：components=基础组件、animated-components=动画组件、blocks=页面区块、dashboards=仪表盘、templates=整页模板。',
    ),
    category: text('限定类别（可选，大小写不敏感），如 button、hero、pricing、micro-interaction。'),
    limit: integer('返回条数，1-8，默认 5。'),
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', required: true },
        kind: { type: 'string' },
        category: { type: 'string' },
        count: { type: 'integer', required: true },
        totalMatches: { type: 'integer', required: true },
        snapshotDate: { type: 'string' },
        hint: { type: 'string' },
        entries: array(
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string' },
              slug: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string' },
              description: { type: 'string' },
              installable: { type: 'boolean' },
              installCommand: { type: 'string' },
              previewUrl: { type: 'string' },
              registryUrl: { type: 'string' },
              dependencies: { type: 'array', items: { type: 'string' } },
              score: { type: 'number' },
              baseVariant: { type: 'string' },
            },
          },
          '按相关度排序的命中条目',
          true,
        ),
      },
    },
    render(_args, value) {
      return [{ type: 'text', text: formatSearchResult(value) }]
    },
    /** 持久化到 tool/result 的轻量摘要，供 presentResult 重放。 */
    presentationMeta(_args, value) {
      return {
        query: value.query,
        count: value.count,
        totalMatches: value.totalMatches,
        kind: value.kind ?? null,
        top: value.entries.slice(0, 3).map(entry => ({
          label: compactLabel(entry),
          slug: entry.slug,
          kind: entry.kind,
        })),
      }
    },
  },
  /** 纯内存计算；不观察 exec.signal。limit 缺省值由 applyToolDefaults 注入。 */
  async execute(args = {}) {
    return searchCatalog({
      query: args.query,
      kind: args.kind,
      category: args.category,
      limit: args.limit,
    })
  },
  presentCall(args) {
    return {
      card: 'generic',
      title: `检索 Watermelon UI：${args.query ?? '浏览目录'}`,
      kind: 'search',
      rawInput: args,
    }
  },
  presentResult(_args, result) {
    if (result?.isError) return undefined
    const meta = result?.meta
    if (!meta || typeof meta !== 'object') return undefined
    const lines = [`**命中：** ${meta.count} 条（共 ${meta.totalMatches} 条匹配）`]
    for (const item of meta.top ?? []) lines.push(`- ${item.label}`)
    return {
      card: 'generic',
      title: `检索：${meta.query || '浏览'}`,
      content: [{ type: 'text', text: lines.join('\n') }],
    }
  },
}
