/**
 * repo/catalog.js — 内置离线目录的读取与派生（零 DSH API）
 *
 * data/catalog.json 是 Watermelon UI 公开 catalog API 的索引快照
 * （一次按 category 分页抓取，字段只有标题/描述/类别/预览/registry 地址/依赖，
 * 不含组件源码）。这里负责：惰性读取、结构校验、类别与变体索引。
 */

import { readFileSync } from 'node:fs'

const CATALOG_URL = new URL('../../data/catalog.json', import.meta.url)

/** 五种内容类型；与远端 catalog 的 kind 取值一致。 */
export const KIND_KEYS = Object.freeze([
  'components',
  'animated-components',
  'blocks',
  'dashboards',
  'templates',
])

/** 类型的中文标签（用于工具结果与文案）。 */
export const KIND_LABELS = Object.freeze({
  components: '基础组件',
  'animated-components': '动画组件',
  blocks: '页面区块',
  dashboards: '仪表盘',
  templates: '整页模板',
})

let _catalog = null
let _failed = false

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 一个条目必须具备的最小字段；缺字段的条目直接丢弃而不是让工具崩溃。 */
function isValidEntry(entry) {
  return (
    isPlainObject(entry) &&
    typeof entry.slug === 'string' &&
    entry.slug.length > 0 &&
    typeof entry.title === 'string' &&
    typeof entry.kind === 'string' &&
    KIND_KEYS.includes(entry.kind)
  )
}

/**
 * 读取并缓存离线目录。
 * 返回 `{ fetchedAt, totalEntries, counts, entries, byKind, families }`；
 * 数据不可读或损坏时返回 null（工具会给出明确诊断，而不是抛到宿主）。
 */
export function getCatalog() {
  if (_catalog) return _catalog
  if (_failed) return null
  try {
    const parsed = JSON.parse(readFileSync(CATALOG_URL, 'utf8'))
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : []).filter(isValidEntry)
    if (entries.length === 0) throw new Error('catalog.json 中没有可用条目')
    const byKind = {}
    for (const entry of entries) {
      byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1
    }
    // 变体索引：xxx 与 xxx-base 是同一条目的两个版本（base 为跟随项目主题的版本）。
    const families = new Map()
    for (const entry of entries) {
      const stem = entry.slug.replace(/-base$/, '')
      const key = `${entry.kind}/${stem}`
      const current = families.get(key) ?? {}
      if (/^[a-z0-9-]+$/.test(entry.slug) && entry.slug.endsWith('-base')) current.base = entry.slug
      else current.canonical = entry.slug
      families.set(key, current)
    }
    _catalog = Object.freeze({
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : '未知日期',
      totalEntries: entries.length,
      counts: Object.freeze({ ...(isPlainObject(parsed.counts) ? parsed.counts : {}), ...byKind }),
      entries: Object.freeze(entries),
      byKind: Object.freeze(byKind),
      families,
    })
    return _catalog
  } catch {
    _failed = true
    return null
  }
}

/**
 * 同一条目的 base 变体 slug（没有则 undefined）。
 * @param {{kind:string, slug:string}} entry
 */
export function baseVariantOf(entry) {
  const catalog = getCatalog()
  if (!catalog) return undefined
  const family = catalog.families.get(`${entry.kind}/${entry.slug.replace(/-base$/, '')}`)
  if (!family) return undefined
  const base = family.base
  return base && base !== entry.slug ? base : undefined
}

/** 快照日期（工具文案用；不可读时返回 null）。 */
export function snapshotDate() {
  return getCatalog()?.fetchedAt ?? null
}

/**
 * 能力摘要（工具描述插值）。离线数据不可读时退回中性文案，
 * 避免一个损坏的 data 文件在模块加载期炸掉整个插件。
 */
export function capabilitySummaryZh() {
  const catalog = getCatalog()
  if (!catalog) return '内置离线目录（快照不可读）'
  const c = catalog.counts
  const parts = []
  if (c.components) parts.push(`${c.components} 个基础组件`)
  if (c['animated-components']) parts.push(`${c['animated-components']} 个动画组件`)
  if (c.blocks) parts.push(`${c.blocks} 个页面区块`)
  if (c.dashboards) parts.push(`${c.dashboards} 个仪表盘`)
  if (c.templates) parts.push(`${c.templates} 个整页模板`)
  return `共 ${catalog.totalEntries} 个条目（${parts.join(' / ')}，快照 ${catalog.fetchedAt}）`
}
