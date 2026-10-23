#!/usr/bin/env node
/**
 * scripts/snapshot.mjs — 重新生成离线目录快照（data/catalog.json + data/summary.json）
 *
 * 数据源是 Watermelon UI 的公开只读 API（https://ui.watermelon.sh/api/v1/…），免鉴权。
 *
 * 上游 API 的限制决定了抓取策略：
 *   - `limit` 硬上限 50，**没有 offset**；
 *   - `summary` 只给各 kind 的总数，不返回 category 列表；
 *   - `category` 是**大小写敏感**的精确匹配；
 *   - 条目按 category 聚集返回，所以「靠首页发现分类再翻页」会在一个大分类里卡住。
 *
 * 因此枚举顺序是：
 *   1. 从已提交的 data/summary.json 读分类清单（自举：第一次跑出来的结果就是后续的线索）；
 *   2. 再抓每个 kind 的首页，把新出现的 category 并进来（上游新增分类时靠这一步补）；
 *   3. 逐个 category 抓取后按 kind/slug 去重；
 *   4. 与 summary 的计数核对，不一致就失败退出，绝不静默写入残缺快照。
 *
 * 用法：
 *   node scripts/snapshot.mjs                  # 抓取并写入 data/
 *   node scripts/snapshot.mjs --dry-run        # 只抓取并打印统计，不写文件
 *   node scripts/snapshot.mjs --out <dir>      # 写到指定目录
 *   node scripts/snapshot.mjs --allow-mismatch # 计数不一致时仍然写盘（不建议）
 *
 * 退出码：0 成功；1 抓取失败、字段缺失、重复或计数不匹配。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://ui.watermelon.sh/api/v1'
const KINDS = ['components', 'animated-components', 'blocks', 'dashboards', 'templates']
const PAGE_LIMIT = 50
const CONCURRENCY = 4
const ATTEMPTS = 5

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const allowMismatch = argv.includes('--allow-mismatch')
const outFlag = argv.indexOf('--out')
const outDir = outFlag >= 0 && argv[outFlag + 1] ? resolve(argv[outFlag + 1]) : resolve(ROOT, 'data')

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** 带重试的 JSON 请求：上游偶发连接超时，重试比直接失败更有用。 */
async function fetchJson(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'dsh-watermelon-ui/snapshot' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (attempt >= ATTEMPTS) throw new Error(`${url} 连续 ${attempt} 次失败：${error.message}`)
    await sleep(400 * attempt)
    return fetchJson(url, attempt + 1)
  }
}

/** 小并发跑一批任务：对上游礼貌，也避免一次打开几十个连接。 */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  }))
  return results
}

function countBy(entries, key) {
  const out = new Map()
  for (const entry of entries) {
    const value = entry[key] ?? '(none)'
    out.set(value, (out.get(value) ?? 0) + 1)
  }
  return out
}

const REGISTRY_ITEM = /^https:\/\/registry\.watermelon\.sh\/r\/[a-z0-9-]+\.json$/
const INSTALL_PREFIX = 'npx shadcn@latest add '
const registryItemUrl = slug => `https://registry.watermelon.sh/r/${slug}.json`

/**
 * 规范化一条 catalog 条目。
 *
 * 上游偶尔会写坏字段（实测 `card-15` 的 installCommand 是 "npx shadcn@latest add Card"），
 * 这类命令直接发出去会装不上。凡是「声明了可安装但命令不合法」的条目，按 registry
 * 的固定命名规则 `r/<slug>.json` 修正；**两者都没有的条目保持“仅预览”**，不凭空造命令。
 */
function normalizeEntry(raw, kind, repairs) {
  const entry = { kind, slug: raw.slug, title: raw.title, description: raw.description ?? '' }
  if (raw.category) entry.category = raw.category

  const registryUrl = typeof raw.registryUrl === 'string' && REGISTRY_ITEM.test(raw.registryUrl)
    ? raw.registryUrl
    : undefined
  const rawCommand = typeof raw.installCommand === 'string' ? raw.installCommand.trim() : ''
  const validCommand = rawCommand.startsWith(INSTALL_PREFIX) && REGISTRY_ITEM.test(rawCommand.slice(INSTALL_PREFIX.length))
    ? rawCommand
    : undefined

  if (!validCommand && rawCommand) repairs.push(`${kind}/${raw.slug}：「${rawCommand}」`)
  // 只要上游“声明了可安装”（给了命令或 registry 地址）就按固定规则修正；
  // 两者都没有的条目保持“仅预览”，不凭空造命令。
  const installable = Boolean(validCommand || registryUrl || rawCommand)
  if (installable) {
    entry.installCommand = validCommand ?? `${INSTALL_PREFIX}${registryUrl ?? registryItemUrl(raw.slug)}`
    entry.registryUrl = registryUrl ?? registryItemUrl(raw.slug)
  }

  if (raw.previewUrl) entry.previewUrl = raw.previewUrl
  if (Array.isArray(raw.dependencies) && raw.dependencies.length > 0) entry.dependencies = raw.dependencies
  return entry
}

function pageUrl(kind, category) {
  const url = new URL(`${API}/catalog/entries`)
  url.searchParams.set('kind', kind)
  if (category) url.searchParams.set('category', category)
  url.searchParams.set('limit', String(PAGE_LIMIT))
  return url.toString()
}

/** 读取上次快照里的分类清单，作为本次抓取的枚举线索。 */
async function readCategoryHints() {
  const hints = new Map(KINDS.map(kind => [kind, new Set()]))
  try {
    const raw = await readFile(resolve(outDir, 'summary.json'), 'utf8')
    const previous = JSON.parse(raw)
    for (const item of previous.categories ?? []) {
      if (hints.has(item.kind) && item.category) hints.get(item.kind).add(item.category)
    }
    const total = [...hints.values()].reduce((sum, set) => sum + set.size, 0)
    if (total > 0) console.log(`→ 沿用上次快照的 ${total} 个 category 作为枚举线索`)
  } catch {
    console.log('→ 没有可用的上次快照，改为从首页动态发现 category（可能抓不全，首轮请核对计数）')
  }
  return hints
}

/**
 * 抓取一个 kind 的全部条目。
 * @returns {Promise<{entries: object[], incomplete: string[]}>}
 */
async function collectKind(kind, hints, failures, repairs) {
  const entries = new Map()
  const categories = new Set(hints)
  const incomplete = []

  // 首页：既拿数据，也补发现新分类。
  const firstPage = await mapLimit([undefined], 1, async () => {
    try {
      return await fetchJson(pageUrl(kind))
    } catch (error) {
      failures.push(`${kind}/(all): ${error.message}`)
      return null
    }
  })
  for (const raw of firstPage[0]?.entries ?? []) {
    if (raw?.category) categories.add(raw.category)
  }

  const targets = [...categories].filter(category => category !== undefined)
  const pages = await mapLimit(targets, CONCURRENCY, async category => {
    try {
      return { category, page: await fetchJson(pageUrl(kind, category)) }
    } catch (error) {
      failures.push(`${kind}/${category}: ${error.message}`)
      return { category, page: null }
    }
  })

  const allPages = [{ category: undefined, page: firstPage[0] }, ...pages]
  for (const { category, page } of allPages) {
    const rows = page?.entries
    if (!Array.isArray(rows)) continue
    if (category && typeof page.count === 'number' && page.count > rows.length) {
      incomplete.push(`${kind}/${category}（${rows.length}/${page.count}）`)
    }
    for (const raw of rows) {
      if (!raw?.slug) continue
      if (!entries.has(raw.slug)) entries.set(raw.slug, normalizeEntry(raw, kind, repairs))
      if (raw.category && !categories.has(raw.category)) categories.add(raw.category)
    }
  }

  return { entries: [...entries.values()], incomplete, categories }
}

async function main() {
  console.log(`→ catalog summary：${API}/catalog/summary`)
  const summary = await fetchJson(`${API}/catalog/summary`)
  const counts = summary.counts ?? {}
  console.log(`  ${summary.product}：${summary.totalEntries} 条 ${JSON.stringify(counts)}`)

  const hints = await readCategoryHints()
  const failures = []
  const incomplete = []
  const repairs = []
  const byKind = new Map()
  const categoryIndex = new Map()

  for (const kind of KINDS) {
    const { entries, incomplete: partial, categories } = await collectKind(kind, hints.get(kind) ?? new Set(), failures, repairs)
    byKind.set(kind, entries)
    categoryIndex.set(kind, [...categories].sort())
    incomplete.push(...partial)
    const expected = counts[kind]
    const mark = expected === undefined || expected === entries.length ? '✓' : '✗'
    console.log(`  ${mark} ${kind}: ${entries.length} 条 / ${categories.size} 个分类${expected === undefined ? '' : `（summary 期望 ${expected}）`}`)
  }

  const entries = KINDS.flatMap(kind => byKind.get(kind) ?? [])
  // 稳定排序：kind → category → slug。上游翻页顺序会变，固定顺序让每次快照的 diff 只反映真实变化。
  const kindOrder = new Map(KINDS.map((kind, index) => [kind, index]))
  entries.sort((a, b) =>
    kindOrder.get(a.kind) - kindOrder.get(b.kind) ||
    String(a.category ?? '').localeCompare(String(b.category ?? '')) ||
    a.slug.localeCompare(b.slug))
  const actualCounts = Object.fromEntries(KINDS.map(kind => [kind, byKind.get(kind)?.length ?? 0]))
  const mismatched = KINDS.filter(kind => counts[kind] !== undefined && counts[kind] !== actualCounts[kind])
  const invalid = entries.filter(entry => ['kind', 'slug', 'title'].some(field => typeof entry[field] !== 'string' || entry[field] === ''))
  const duplicates = entries.length - new Set(entries.map(entry => `${entry.kind}/${entry.slug}`)).size

  console.log('\n—— 结果 ——')
  console.log(`条目：${entries.length}（summary 声明 ${summary.totalEntries}）`)
  console.log(`缺字段：${invalid.length}｜重复：${duplicates}｜失败分页：${failures.length}｜超单页被截断：${incomplete.length}｜修正命令：${repairs.length}`)
  for (const repair of repairs.slice(0, 10)) console.log(`  ~ ${repair} → 按 r/<slug>.json 规则修正`)

  if (mismatched.length > 0) console.log(`与 summary 不一致的类型：${mismatched.join(', ')}（可能是上游新增了分类，或某分类超过 ${PAGE_LIMIT} 条）`)
  for (const failure of failures.slice(0, 10)) console.error(`  ✗ ${failure}`)
  for (const partial of incomplete.slice(0, 10)) console.error(`  ! ${partial} 超过单页上限，已截断`)

  const fatal = failures.length > 0 || invalid.length > 0 || duplicates > 0 || (mismatched.length > 0 && !allowMismatch)
  if (fatal) {
    console.error('\n✗ 快照不完整，未写入。检查网络后重跑；确认可接受时加 --allow-mismatch。')
    process.exitCode = 1
    return
  }

  const fetchedAt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const catalog = {
    fetchedAt,
    source: `${API}/catalog/entries`,
    product: summary.product,
    totalEntries: entries.length,
    counts: actualCounts,
    entries,
  }
  const categories = []
  for (const kind of KINDS) {
    for (const [category, count] of [...countBy(byKind.get(kind) ?? [], 'category').entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))) {
      categories.push({ kind, category, count })
    }
  }
  const summaryOut = {
    fetchedAt,
    product: summary.product,
    totalEntries: entries.length,
    counts: actualCounts,
    categories,
  }

  if (dryRun) {
    console.log(`\n（--dry-run）未写文件。目标目录：${outDir}`)
    return
  }

  await mkdir(outDir, { recursive: true })
  await writeFile(resolve(outDir, 'catalog.json'), `${JSON.stringify(catalog)}\n`, 'utf8')
  await writeFile(resolve(outDir, 'summary.json'), `${JSON.stringify(summaryOut)}\n`, 'utf8')
  console.log(`\n✓ ${resolve(outDir, 'catalog.json')}（${entries.length} 条，${fetchedAt}）`)
  console.log(`✓ ${resolve(outDir, 'summary.json')}（${categories.length} 个 category）`)
}

main().catch(error => {
  console.error(`✗ 快照失败：${error.message}`)
  process.exitCode = 1
})
