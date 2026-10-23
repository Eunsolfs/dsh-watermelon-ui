/**
 * search/index.js — 离线目录的关键词检索（零 DSH API）
 *
 * 目的是“在没有网络、没有 MCP 时也能找到对的条目并给出安装命令”，
 * 因此只做确定性的词面匹配：没有向量、没有 LLM、不猜语义。
 * 想理解自然语言需求时用托管 MCP 的 search / get_inspiration。
 */

import { getCatalog, KIND_KEYS } from '../repo/catalog.js'
import { expandQuery } from './aliases.js'

const REGISTRY_BASE = 'https://registry.watermelon.sh/r'

/** 字段权重：标题 > slug > 类别 > 描述。 */
const WEIGHT = Object.freeze({ title: 6, slug: 4, category: 3, description: 1 })

/**
 * 条目的 registry 地址：优先用快照里的远端字段，缺失时按 Watermelon
 * registry 的固定规则推导（r/<slug>.json）。
 * @param {{slug:string, registryUrl?:string}} entry
 */
export function registryUrlOf(entry) {
  return entry.registryUrl || `${REGISTRY_BASE}/${entry.slug}.json`
}

/**
 * 条目的 shadcn 安装命令：优先用快照里的远端字段，缺失时按同一规则推导。
 * @param {{slug:string, installCommand?:string, registryUrl?:string}} entry
 */
export function installCommandOf(entry) {
  return entry.installCommand || `npx shadcn@latest add ${registryUrlOf(entry)}`
}

/** 检索结果里的紧凑条目（不含源码）。 */
export function compactEntry(entry, score = 0) {
  // 少数条目只有预览、没有 registry 包（例如部分 footer 区块），此时不能伪造安装命令。
  const installable = Boolean(entry.installCommand || entry.registryUrl)
  return {
    kind: entry.kind,
    slug: entry.slug,
    title: entry.title,
    category: entry.category || '',
    description: entry.description || '',
    installable,
    installCommand: installable ? installCommandOf(entry) : '',
    previewUrl: entry.previewUrl || '',
    registryUrl: installable ? registryUrlOf(entry) : '',
    dependencies: Array.isArray(entry.dependencies) ? entry.dependencies : [],
    score,
  }
}

function normalizeKind(kind) {
  if (typeof kind !== 'string') return undefined
  const value = kind.trim().toLowerCase()
  return KIND_KEYS.includes(value) ? value : undefined
}

function matchesCategory(entry, category) {
  if (!category) return true
  const wanted = category.trim().toLowerCase()
  return String(entry.category ?? '').toLowerCase() === wanted
}

/** 词首边界匹配：短词不会因为出现在长词中间而误命中（'no' 不该命中 announcement）。 */
function containsToken(field, token) {
  if (!field) return false
  let index = field.indexOf(token)
  while (index >= 0) {
    if (index === 0 || !/[a-z0-9]/.test(field[index - 1])) return true
    index = field.indexOf(token, index + 1)
  }
  return false
}

/**
 * 给条目打分。
 *
 * 同时返回 `coverage`（命中了几个不同的检索词）。多词查询里「命中两个词的
 * 一条」必须排在「只命中一个词的一百条」前面——否则「定价 卡片」会被
 * 94 个 Card 组件淹没，pricing 区块根本进不了前几条。
 * @returns {{score:number, coverage:number}}
 */
function scoreEntry(entry, tokens) {
  if (tokens.length === 0) return { score: 0, coverage: 0 }
  const title = entry.title.toLowerCase()
  const slug = entry.slug.toLowerCase()
  const category = String(entry.category ?? '').toLowerCase()
  const description = String(entry.description ?? '').toLowerCase()
  let score = 0
  let coverage = 0
  for (const token of tokens) {
    let hit = false
    if (containsToken(title, token)) { score += WEIGHT.title; hit = true }
    if (containsToken(slug, token)) { score += WEIGHT.slug; hit = true }
    if (containsToken(category, token)) { score += WEIGHT.category; hit = true }
    if (containsToken(description, token)) { score += WEIGHT.description; hit = true }
    if (hit) coverage += 1
  }
  return { score, coverage }
}

/**
 * 按“同一设计 + base 变体”归并，每个设计只出一条（base 变体作为附加字段），
 * 避免一次检索里出现 xxx 与 xxx-base 两条几乎一样的结果。
 * @param {Array<{entry: object, score: number}>} scored
 */
function collapseVariants(scored) {
  const winners = new Map()
  for (const item of scored) {
    const stem = item.entry.slug.replace(/-base$/, '')
    const key = `${item.entry.kind}/${stem}`
    const base = item.entry.slug.endsWith('-base')
    const current = winners.get(key)
    if (!current) {
      winners.set(key, { ...item, baseVariant: base ? item.entry.slug : undefined })
      continue
    }
    if (base) current.baseVariant = item.entry.slug
    // 同一设计下优先保留非 base 版本作为主结果；覆盖词数、分数更高的条目优先。
    const better =
      item.coverage > current.coverage ||
      (item.coverage === current.coverage && item.score > current.score) ||
      (item.coverage === current.coverage && item.score === current.score && !base)
    if (better) {
      winners.set(key, { ...item, baseVariant: current.baseVariant })
    }
  }
  return [...winners.values()]
}

/**
 * 在离线目录中检索。
 * @param {{query?: string, kind?: string, category?: string, limit?: number}} request
 * @returns {{
 *   query: string, kind: string|undefined, category: string|undefined,
 *   count: number, totalMatches: number, snapshotDate: string|null,
 *   entries: object[], hint?: string
 * }}
 */
export function searchCatalog(request = {}) {
  const catalog = getCatalog()
  if (!catalog) {
    throw new Error('内置目录快照不可读：请重新安装 dsh-watermelon-ui，或改用 web_fetch 直接访问 https://ui.watermelon.sh/api/v1/catalog/summary')
  }
  const query = String(request.query ?? '').trim()
  const kind = normalizeKind(request.kind)
  const category = request.category ? String(request.category).trim() : undefined
  const limit = Number.isInteger(request.limit) ? Math.max(1, Math.min(8, request.limit)) : 5
  const tokens = expandQuery(query)

  const pool = catalog.entries.filter(entry => (!kind || entry.kind === kind) && matchesCategory(entry, category))
  let scored
  if (tokens.length === 0) {
    scored = pool.map(entry => ({ entry, score: 0, coverage: 0 }))
  } else {
    scored = pool
      .map(entry => ({ entry, ...scoreEntry(entry, tokens) }))
      .filter(item => item.score > 0)
  }

  const collapsed = collapseVariants(scored)
  collapsed.sort((a, b) => {
    // 先比「命中了几个检索词」，再比字段权重得分：多词查询的精度优先。
    if (b.coverage !== a.coverage) return b.coverage - a.coverage
    if (b.score !== a.score) return b.score - a.score
    if (a.entry.kind !== b.entry.kind) return KIND_KEYS.indexOf(a.entry.kind) - KIND_KEYS.indexOf(b.entry.kind)
    return a.entry.title.localeCompare(b.entry.title)
  })

  const entries = collapsed.slice(0, limit).map(item => {
    const compact = compactEntry(item.entry, item.score)
    if (item.baseVariant) compact.baseVariant = item.baseVariant
    return compact
  })

  const result = {
    query,
    count: entries.length,
    totalMatches: collapsed.length,
    snapshotDate: catalog.fetchedAt,
    entries,
  }
  if (kind) result.kind = kind
  if (category) result.category = category
  if (entries.length === 0 && tokens.length > 0) {
    result.hint =
      '关键词没有命中（离线索引只匹配标题/描述/类别/ slug 的词面）。换更短或更通用的英文词重试，' +
      '或让 agent 用 web_fetch 访问 https://ui.watermelon.sh/api/v1/catalog/entries?kind=<kind>&query=<词>&limit=20；' +
      '自然语言搜索请启用 watermelon-mcp 行后使用 mcp__watermelon__search。'
  }
  return result
}
