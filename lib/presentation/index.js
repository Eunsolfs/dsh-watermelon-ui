/**
 * presentation/index.js — 两个工具的 Markdown 结果渲染
 *
 * 渲染只负责“让人和模型都能一眼读懂”，结构化数据仍走 output.schema。
 */

import { KIND_LABELS } from '../repo/catalog.js'
import { checklist, codeBlock, truncateText } from './markdown.js'

/**
 * 检索结果 → 中文 Markdown。
 * @param {object} value
 */
export function formatSearchResult(value) {
  const lines = []
  const scope = value.kind ? KIND_LABELS[value.kind] || value.kind : '全部'
  lines.push(`## Watermelon UI 目录：${value.query ? `「${value.query}」` : '浏览'}`)
  lines.push(`**类型：** ${scope}${value.category ? ` ｜ **类别：** ${value.category}` : ''} ｜ **命中：** ${value.count} 条（共 ${value.totalMatches} 条匹配）`)
  if (value.snapshotDate) {
    lines.push(`> 离线快照 ${value.snapshotDate}：只按标题/描述/类别/slug 做词面匹配，不含组件源码。需要语义搜索或源码时使用 \`mcp__watermelon__search\` / \`mcp__watermelon__get_component\`（需先启用 watermelon-mcp 行）。`)
  }
  lines.push('')

  value.entries.forEach((entry, index) => {
    lines.push(`### ${index + 1}. ${entry.title} · \`${entry.kind}/${entry.slug}\``)
    if (entry.category) lines.push(`**类别：** ${entry.category}`)
    if (entry.description) lines.push(truncateText(entry.description, 200))
    if (entry.installable && entry.installCommand) {
      lines.push(...codeBlock(entry.installCommand))
      if (entry.dependencies?.length) lines.push(`**依赖：** ${entry.dependencies.join('、')}`)
    } else {
      lines.push('> 该条目只有预览，没有 shadcn registry 包，无法用 CLI 安装；需要就按预览自己实现。')
    }
    if (entry.previewUrl) lines.push(`**预览：** ${entry.previewUrl}`)
    if (entry.baseVariant) lines.push(`**主题适配版：** \`${entry.baseVariant}\`（去掉渐变/固定色，跟随项目主题）`)
    lines.push('')
  })

  if (value.entries.length === 0) {
    lines.push('没有命中条目。')
    if (value.hint) lines.push(`> ${value.hint}`)
  }
  return lines.join('\n').trimEnd()
}

/**
 * 安装计划 → 中文 Markdown。
 * @param {object} value
 */
export function formatInstallPlan(value) {
  if (!value.found) {
    return [
      `## 未找到条目：\`${value.slug}\``,
      '',
      '先用 `watermelon_catalog_search` 找到准确 slug；也可以直接查远端目录：',
      '',
      '```',
      `https://ui.watermelon.sh/api/v1/catalog/entries?kind=${value.kind || '<kind>'}&query=${encodeURIComponent(value.slug)}&limit=20`,
      '```',
    ].join('\n')
  }

  const lines = []
  lines.push(`## 安装计划：${value.title} · \`${value.kind}/${value.slug}\``)
  if (value.category) lines.push(`**类别：** ${value.category}`)
  if (value.previewUrl) lines.push(`**预览：** ${value.previewUrl}`)
  lines.push('')

  if (value.installable === false) {
    lines.push('### 没有可用的安装包')
    lines.push('这个条目在 Watermelon 目录里只有预览，没有对应的 shadcn registry 包，**不要自己拼 registry URL**。')
    lines.push('要么按预览自己实现，要么换一个可比条目（先用 `watermelon_catalog_search` 检索同类）。')
    lines.push('')
  } else {
    lines.push('### 1. 前置检查（不满足就先别装）')
    lines.push(...checklist(value.prerequisites))
    lines.push('')

    lines.push('### 2. 安装')
    lines.push(...codeBlock(value.installCommand))
    if (value.baseVariant) {
      lines.push('需要跟随项目主题时改用 theme-ready 版本：')
      lines.push(...codeBlock(value.baseVariant.installCommand))
    }
    lines.push('')

    lines.push('### 3. 装后核对')
    lines.push(...checklist(value.checks))
    lines.push('')

    if (value.dependencies?.length) {
      lines.push(`**npm 依赖：** ${value.dependencies.join('、')}`)
      lines.push('> shadcn CLI 会按 registry 条目自动安装这些依赖；出现版本冲突时再手动处理。')
      lines.push('')
    }
  }
  if (value.attribution) lines.push(`> ${value.attribution}`)
  return lines.join('\n').trimEnd()
}
