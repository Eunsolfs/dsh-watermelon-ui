// 静态校验（不安装、不联网）：
//   node scripts/verify.mjs
//
// 覆盖：JSON 解析、快照字段、工具 SchemaSpec 方言、两个工具的真实执行与输出契约、
// Markdown 渲染、技能 frontmatter、patch 形状。安装前的最后一道自检。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)
const path = file => fileURLToPath(new URL(file, ROOT))
const errors = []
const notes = []
const check = (condition, message) => { if (!condition) errors.push(message) }
const read = file => readFileSync(path(file), 'utf8')

// 1) 清单与显示元数据
const pkg = JSON.parse(read('package.json'))
check(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'package.json 缺少 dsh.bundle.patch')
check(pkg.type === 'module', 'package.json type 必须是 module')
check(pkg.exports?.['.'] === './index.js', 'package.json exports["."] 必须是 ./index.js')
check(Boolean(pkg.exports?.['./icon']), 'package.json 缺少 ./icon 导出')
for (const file of ['index.js', 'cordis.patch.yml', 'icon.svg', 'package.json', 'skills', 'data', 'lib']) {
  check(pkg.files?.some(entry => entry === file || entry.startsWith(`${file}/`)), `files 缺少 ${file}`)
}
for (const locale of ['en', 'zh']) {
  const meta = JSON.parse(read(`locale/${locale}.json`))
  check(typeof meta.meta?.title === 'string' && meta.meta.title.length > 3, `${locale}.json meta.title 缺失`)
  check(typeof meta.meta?.description === 'string' && meta.meta.description.length > 20, `${locale}.json meta.description 太短`)
  notes.push(`locale ${locale}: ${meta.meta.title}`)
}

// 2) 离线快照
const catalog = JSON.parse(read('data/catalog.json'))
check(Array.isArray(catalog.entries) && catalog.entries.length > 0, 'catalog.json 没有条目')
check(/^\d{4}-\d{2}-\d{2}$/.test(catalog.fetchedAt), 'fetchedAt 不是 YYYY-MM-DD')
check(new Set(catalog.entries.map(entry => entry.kind)).size === 5, '快照应含 5 种 kind')
const badEntry = catalog.entries.find(entry => !entry.slug || !entry.title || !entry.kind)
check(!badEntry, `快照存在缺字段条目: ${JSON.stringify(badEntry)?.slice(0, 120)}`)
const previewOnly = catalog.entries.filter(entry => !entry.installCommand && !entry.registryUrl)
notes.push(`snapshot ${catalog.fetchedAt}: ${catalog.entries.length} entries / preview-only ${previewOnly.length}`)

// 3) 工具定义与执行
const { toolSpecs } = await import(new URL('lib/tools/index.js', ROOT))
const { toolSchemaViolations, validateSpecValue } = await import(new URL('lib/plugin/schema.js', ROOT))
for (const spec of toolSpecs) {
  const violations = toolSchemaViolations(spec)
  check(violations.length === 0, `${spec.name} SchemaSpec 违规: ${violations.join('; ')}`)
}

async function runTool(tool, args) {
  const value = await tool.execute(args)
  const violations = validateSpecValue(tool.output.schema, value)
  check(violations.length === 0, `${tool.name} 输出不符合 schema: ${violations.join('; ')}`)
  const text = tool.output.render(args, value).map(block => block.text).join('\n')
  check(text.length > 50, `${tool.name} 渲染结果过短`)
  return { value, text }
}

const [searchTool, planTool] = toolSpecs
for (const [label, args] of [
  ['中文查询', { query: '定价 卡片' }],
  ['英文查询', { query: 'pricing' }],
  ['按类型浏览', { kind: 'blocks', limit: 3 }],
]) {
  const { value } = await runTool(searchTool, args)
  notes.push(`search[${label}] -> ${value.count}/${value.totalMatches} 条，首条 ${value.entries[0]?.kind ?? '-'}/${value.entries[0]?.slug ?? '-'}`)
}

const { value: plan } = await runTool(planTool, { slug: 'pricing-1', kind: 'blocks' })
check(plan.found === true, 'install_plan 应找到 blocks/pricing-1')
check(/^npx shadcn@latest add https:\/\/registry\.watermelon\.sh\/r\/.+\.json$/.test(plan.installCommand ?? ''), '安装命令格式不符合预期')
check((await runTool(planTool, { slug: 'announcement-1' })).value.found === true, '应接受不带 kind 的 slug')
check((await runTool(planTool, { slug: 'blocks/hero-1' })).value.found === true, '应解析 kind/slug 复合形式')
check((await runTool(planTool, { slug: 'no-such-component-xyz' })).value.found === false, '不存在的 slug 应返回 found=false')
if (previewOnly.length > 0) {
  const { value, text } = await runTool(planTool, { slug: previewOnly[0].slug })
  check(value.found === true && value.installable === false, '仅预览条目应返回 installable=false')
  check(!value.installCommand, '仅预览条目不应给出安装命令')
  check(text.includes('不要自己拼'), '仅预览条目的渲染应提示不要伪造 registry URL')
}

// 4) 技能
const { splitFrontmatter } = await import(new URL('lib/plugin/skill-body.js', ROOT))
const { data, body } = splitFrontmatter(read('skills/watermelon-ui/SKILL.md'))
check(data.name === 'watermelon-ui', 'SKILL.md frontmatter name 缺失')
check((data.description ?? '').length > 30, 'SKILL.md frontmatter description 太短')
check((data.whenToUse ?? '').length > 10, 'SKILL.md frontmatter whenToUse 太短')
check(body.trimStart().startsWith('# '), 'SKILL.md 正文缺少标题')
check(body.includes('registry.watermelon.sh'), 'SKILL.md 缺少 registry 安装命令')
check(body.includes('MIT'), 'SKILL.md 缺少许可说明')
notes.push(`skill: ${body.length} chars body`)

// 5) patch 形状（无 YAML 解析器，只做结构检查）
const patch = read('cordis.patch.yml')
const patchBody = patch.split(/\r?\n/).filter(line => !line.trimStart().startsWith('#')).join('\n').trimStart()
check(patchBody.startsWith('- insert:'), 'patch 正文必须以 "- insert:" 开头')
check(!patch.includes('\t'), 'patch 不能含 tab')
for (const token of ['id: watermelon-ui', 'name: dsh-watermelon-ui', 'id: watermelon-mcp', 'disabled: true', 'https://mcp.watermelon.sh/mcp']) {
  check(patch.includes(token), `patch 缺少 ${token}`)
}

console.log('--- notes ---')
for (const note of notes) console.log('·', note)
if (errors.length > 0) {
  console.error('\n--- FAILED ---')
  for (const error of errors) console.error('✖', error)
  process.exitCode = 1
} else {
  console.log('\n--- ALL CHECKS PASSED ---')
}
