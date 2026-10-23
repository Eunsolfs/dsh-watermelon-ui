/**
 * plugin/skill.js — 内置技能注册定义（唯一认识 dsh-skill API 的文件）
 *
 * SKILL.md 路径集中在这里；能力数字从离线快照派生，避免手工漂移。
 * 正文由 skill-body.js 去掉 frontmatter 后返回——原生 `SkillDefinition.content`
 * 要求的是「去除 provider 元数据后的 Markdown 正文」。
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'
import { capabilitySummaryZh } from '../repo/catalog.js'
import { splitFrontmatter } from './skill-body.js'

export const SKILL_NAME = 'watermelon-ui'
export const SKILL_BODY_URL = new URL('../../skills/watermelon-ui/SKILL.md', import.meta.url)
export const SKILL_PATH = fileURLToPath(SKILL_BODY_URL)

export const SKILL_RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('../../skills/watermelon-ui/', import.meta.url)),
}

export const SKILL_INVOCATION = { modelInvocable: true, userInvocable: true }

export const DEFAULT_WHEN_TO_USE =
  '在 React + Tailwind 项目里要加界面区块、组件或动画；纠结某个设计该不该用 Watermelon UI；' +
  '要写 shadcn 安装命令或处理第三方组件署名时使用。'

export const SKILL_DESCRIPTION =
  'Watermelon UI 接入技能：先做技术栈与设计体系门禁（React + Tailwind + shadcn 才能用），' +
  `再用离线目录（${capabilitySummaryZh()}）或托管 MCP 找条目，给出可执行的 shadcn 安装命令、` +
  '依赖清单、装后核对项与 MIT 署名要求。'

/**
 * 用 frontmatter 数据构造候选；frontmatter 缺失时回退到模块级默认值。
 * @param {Record<string, string>} data
 */
function candidateFrom(data) {
  return {
    name: SKILL_NAME,
    description: data.description || SKILL_DESCRIPTION,
    whenToUse: data.whenToUse || DEFAULT_WHEN_TO_USE,
    invocation: SKILL_INVOCATION,
    provider: 'dsh-watermelon-ui',
    source: 'bundled',
    resourceBase: SKILL_RESOURCE_BASE,
    path: SKILL_PATH,
    rank: BUNDLED_SKILL_RANK,
    locator: SKILL_BODY_URL,
    metadata: data,
  }
}

/** 静态兜底候选（读文件失败时 `list()` 仍能返回它）。 */
export const SKILL_CANDIDATE = candidateFrom({})

/**
 * 解析候选的 locator：原生 locator 是不透明值，本项目使用文件 URL。
 * 兼容 URL 与字符串路径；缺失时回退到内置 SKILL.md。
 * @param {unknown} locator
 */
function resolveLocator(locator) {
  if (locator instanceof URL) return fileURLToPath(locator)
  if (typeof locator === 'string' && locator.length > 0) return locator
  return SKILL_PATH
}

export const skillProvider = {
  name: 'dsh-watermelon-ui',
  /**
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object[]>}
   */
  async list(options = {}) {
    if (options.signal?.aborted) return []
    try {
      const { data } = splitFrontmatter(await readFile(SKILL_BODY_URL, 'utf8'))
      return [candidateFrom(data)]
    } catch {
      // 内置文件不可读时仍返回目录候选，避免技能在目录里直接消失；
      // get() 会再次尝试读取并把错误交给宿主。
      return [SKILL_CANDIDATE]
    }
  },
  /**
   * @param {{ name?: string, locator?: unknown, description?: string, whenToUse?: string, provider?: string, source?: string }} candidate
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object|undefined>}
   */
  async get(candidate, options = {}) {
    if (options.signal?.aborted) return undefined
    const filePath = resolveLocator(candidate?.locator)
    const { data, body } = splitFrontmatter(await readFile(filePath, 'utf8'))
    return {
      name: candidate?.name || SKILL_NAME,
      description: data.description || candidate?.description || SKILL_DESCRIPTION,
      whenToUse: data.whenToUse || candidate?.whenToUse || DEFAULT_WHEN_TO_USE,
      invocation: SKILL_INVOCATION,
      provider: candidate?.provider || 'dsh-watermelon-ui',
      source: candidate?.source || 'bundled',
      resourceBase: SKILL_RESOURCE_BASE,
      path: filePath,
      metadata: data,
      content: body,
    }
  },
}
