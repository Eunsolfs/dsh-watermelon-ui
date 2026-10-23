/**
 * tools/index.js — 工具注册表
 *
 * 新增工具只改这一处（加一行）+ 新建一个工具文件。
 */

import { catalogSearchTool } from './catalog-search.js'
import { installPlanTool } from './install-plan.js'

/** 两个工具规格，按注册顺序排列。 */
export const toolSpecs = Object.freeze([
  catalogSearchTool,
  installPlanTool,
])

export const toolNames = Object.freeze(toolSpecs.map(tool => tool.name))
