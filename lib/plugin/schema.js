/**
 * plugin/schema.js — 工具级 SchemaSpec 方言守卫
 *
 * 把方言约束固化成注册期断言：写错 schema 时在 apply() 里立刻 fail fast，
 * 而不是等模型调用才发现宿主拒绝。
 */

import { walkSchemaNode } from './dialect.js'

export { validateSpecValue } from './dialect.js'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 校验一个工具的 SchemaSpec 方言合规性。
 * @param {{name?:string, description?:string, timeoutMs?:number, parameters?:object, output?:object, execute?:Function}} tool
 * @returns {string[]} 违规项（空数组 = 合规）
 */
export function toolSchemaViolations(tool) {
  const violations = []
  if (!tool || typeof tool !== 'object') return ['工具定义必须是对象']
  const name = tool.name || '<unnamed>'
  if (typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(tool.name)) {
    violations.push(`${name}.name 必须是 snake_case 工具名`)
  }
  if (typeof tool.description !== 'string' || tool.description.trim().length === 0) {
    violations.push(`${name}.description 不能为空`)
  }
  if (!Number.isFinite(tool.timeoutMs) || tool.timeoutMs <= 0) {
    violations.push(`${name}.timeoutMs 必须是正数`)
  }
  if (!isPlainObject(tool.parameters)) {
    violations.push(`${name}.parameters 必须是属性 schema 映射`)
  } else {
    for (const [key, spec] of Object.entries(tool.parameters)) {
      walkSchemaNode(spec, `${name}.parameters.${key}`, { allowRequired: true, insideItems: false }, violations)
    }
  }
  if (!tool.output || !isPlainObject(tool.output.schema)) {
    violations.push(`${name}.output.schema 必须存在`)
  } else {
    walkSchemaNode(tool.output.schema, `${name}.output.schema`, { allowRequired: false, insideItems: false }, violations)
  }
  if (!tool.output || typeof tool.output.render !== 'function') {
    violations.push(`${name}.output.render 必须是函数`)
  }
  if (typeof tool.execute !== 'function') {
    violations.push(`${name}.execute 必须是函数`)
  }
  if (tool.output && Object.hasOwn(tool.output, 'presentationMeta') && typeof tool.output.presentationMeta !== 'function') {
    violations.push(`${name}.output.presentationMeta 必须是函数`)
  }
  if (Object.hasOwn(tool, 'presentCall') && typeof tool.presentCall !== 'function') {
    violations.push(`${name}.presentCall 必须是函数`)
  }
  if (Object.hasOwn(tool, 'presentResult') && typeof tool.presentResult !== 'function') {
    violations.push(`${name}.presentResult 必须是函数`)
  }
  return violations
}

/**
 * 断言工具 SchemaSpec 方言合规；不合规即抛错（注册期 fail fast）。
 * @param {object} tool
 */
export function assertToolSchemaDialect(tool) {
  const violations = toolSchemaViolations(tool)
  if (violations.length > 0) {
    throw new Error(`SchemaSpec 方言违规（${tool?.name || '<unnamed>'}）:\n- ${violations.join('\n- ')}`)
  }
}
