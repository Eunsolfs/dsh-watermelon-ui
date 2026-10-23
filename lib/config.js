/**
 * config.js — 运行时常量（不 import DSH API）
 *
 * 时间上限只用于工具声明的 timeoutMs（宿主据此给调用方一个协作式上限）；
 * 两个工具都是本地内存计算，正常耗时在毫秒级。
 */

export const TIMEOUTS = Object.freeze({
  catalogSearch: 5000,
  installPlan: 5000,
})

export const LIMITS = Object.freeze({
  minResults: 1,
  maxResults: 8,
})
