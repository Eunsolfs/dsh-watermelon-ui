/**
 * presentation/markdown.js — Markdown 渲染的小工具（零依赖）
 */

/**
 * 截断长文本，保留完整词边界优先。
 * @param {string} text
 * @param {number} [max]
 */
export function truncateText(text, max = 180) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).trim()}…`
}

/**
 * 把 shell 命令渲染成一段可复制代码块。
 * @param {string} command
 */
export function codeBlock(command) {
  return ['```bash', command, '```']
}

/**
 * 生成 `- [ ] 文本` 形式的中文检查项。
 * @param {string[]} items
 */
export function checklist(items) {
  return items.map(item => `- [ ] ${item}`)
}
