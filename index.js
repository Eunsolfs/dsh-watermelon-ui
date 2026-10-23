/**
 * dsh-watermelon-ui — Watermelon UI 插件（薄入口）
 *
 * 只负责重导出；实现分层在 lib/ 下：
 *   plugin/        宿主适配（apply / 技能注册 / SchemaSpec 方言守卫）
 *   tools/         两个模型工具（watermelon_catalog_search / watermelon_install_plan）
 *   search/        离线目录的检索与中英词表
 *   repo/          内置 catalog 快照的读取与能力数字
 *   presentation/  工具结果的 Markdown 渲染
 *
 * 数据来自 Watermelon UI 公开 catalog API 的离线索引（data/catalog.json），
 * 不含组件源码；源码请用托管 MCP 的 get_component 或 registry JSON 获取。
 *
 * @module dsh-watermelon-ui
 */

export { name, inject } from './lib/plugin/meta.js'
export { Config } from './lib/plugin/config.js'
export { apply, buildTools } from './lib/plugin/index.js'
export { SKILL_NAME } from './lib/plugin/skill.js'
