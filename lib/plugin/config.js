/**
 * plugin/config.js — 插件配置面（零 DSH API / 零第三方依赖）
 *
 * 只暴露两个低风险字段：
 *   - defaultResults: 工具未显式传 limit/maxResults 时的默认条数（1–8）
 *   - skill:          是否注册内置 watermelon-ui 技能
 *
 * 同时导出 Standard Schema 形状的 `Config`，让 Cordis 的 resolveConfig()
 * 在加载期校验；apply() 内会再 normalize 一次，保证直接调用也安全。
 */

export const DEFAULT_CONFIG = Object.freeze({
  defaultResults: 5,
  skill: true,
})

const MIN_RESULTS = 1
const MAX_RESULTS = 8

/**
 * 校验并规范化配置。未知字段被忽略；类型错误直接抛 TypeError。
 * @param {unknown} raw
 */
export function normalizeConfig(raw = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('config 必须是对象')
  }
  const value = { ...DEFAULT_CONFIG, ...raw }
  const { defaultResults, skill } = value
  if (!Number.isInteger(defaultResults) || defaultResults < MIN_RESULTS || defaultResults > MAX_RESULTS) {
    throw new TypeError(`defaultResults 必须是 ${MIN_RESULTS}-${MAX_RESULTS} 的整数`)
  }
  if (typeof skill !== 'boolean') throw new TypeError('skill 必须是布尔值')
  return Object.freeze({ defaultResults, skill })
}

/**
 * 给工具 spec 注入配置默认值。用户显式传入的参数优先。
 * 目前只有 watermelon_catalog_search 有“默认条数”语义。
 * @param {object} spec
 * @param {{defaultResults:number}} config
 */
export function applyToolDefaults(spec, config) {
  if (spec.name !== 'watermelon_catalog_search') return spec
  return {
    ...spec,
    async execute(args = {}, exec) {
      return spec.execute({ limit: config.defaultResults, ...args }, exec)
    },
  }
}

/**
 * Standard Schema 适配层。Cordis 4.x 的 resolveConfig() 读取
 * `Config['~standard'].validate(config)`。
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-watermelon-ui',
    validate(value = {}) {
      try {
        return { value: normalizeConfig(value) }
      } catch (error) {
        return { issues: [{ message: error.message, path: [] }] }
      }
    },
  },
}
