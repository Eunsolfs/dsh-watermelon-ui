/**
 * tools/install-plan.js — watermelon_install_plan 工具定义
 *
 * 把「某个条目该用什么命令装、装在什么前提下、装完核对什么」一次讲清楚，
 * 全部基于离线快照 + 技能里的门禁知识，不访问网络。
 */

import { TIMEOUTS } from '../config.js'
import { formatInstallPlan } from '../presentation/index.js'
import { baseVariantOf, getCatalog, KIND_KEYS } from '../repo/catalog.js'
import { installCommandOf, registryUrlOf } from '../search/index.js'
import { array, stringEnum, text } from './schema.js'

/** 门禁：不满足这些前提时，装进去只会得到一堆跑不起来的 Tailwind class。 */
export const PREREQUISITES = Object.freeze([
  '项目用 React 写界面（.tsx/.jsx）；Vue / Svelte / Angular / React Native / 小程序不适用。',
  '项目用 Tailwind CSS：条目源码是 TSX + Tailwind class，没有 Tailwind 就只剩裸标签。',
  '项目已按 shadcn 约定初始化（存在 components.json，tsconfig 配了 @/* 别名）；没有就先跑 npx shadcn@latest init。',
  '仓库允许把第三方源码复制进 src/components/；有合规限制的仓库先走审批。',
  '同一批页面没有被 MUI / Ant Design / Chakra / Mantine 等其他自成体系的 UI 框架接管，避免两套样式体系打架。',
])

/** 装完之后必须自己核对的事，工具不会替你做。 */
export const POST_INSTALL_CHECKS = Object.freeze([
  '组件文件落在 registry 指定路径（通常 src/components/watermelon-ui/<slug>.tsx），没有覆盖 components/ui 下的 shadcn 基础件。',
  '上面列出的 npm 依赖都已安装，项目能通过类型检查和构建。',
  '组件用到的 Tailwind 语义 token（bg-background、text-muted-foreground、border 等）在项目主题里已定义。',
  '深浅色模式各看一遍：对比度、边框、阴影是否仍然成立。',
  '交互组件检查键盘可达、焦点管理和 reduced-motion；动画不是唯一的信息载体。',
])

const ATTRIBUTION =
  'Watermelon UI 以 MIT 许可发布（见 https://ui.watermelon.sh/llms.txt）：复制源码时保留版权与许可声明，' +
  '建议在 README 或文件头注明来源 https://ui.watermelon.sh 与条目链接；具体署名条款以 https://ui.watermelon.sh/copyright 为准。'

/** 解析 "kind/slug" 或单独 slug。 */
function parseSlug(input) {
  const raw = String(input ?? '').trim()
  const separated = raw.match(/^([a-z-]+)\/([a-z0-9-]+)$/i)
  if (separated && KIND_KEYS.includes(separated[1].toLowerCase())) {
    return { kind: separated[1].toLowerCase(), slug: separated[2] }
  }
  return { slug: raw }
}

export const installPlanTool = {
  name: 'watermelon_install_plan',
  description:
    '为某个 Watermelon UI 条目生成安装计划：准确的 shadcn 安装命令、npm 依赖、技术栈前置门禁、装后核对项与 MIT 署名提示。' +
    '先用 watermelon_catalog_search 拿到 slug；本工具只查离线目录，不下载源码、不改动项目。',
  timeoutMs: TIMEOUTS.installPlan,
  isConcurrencySafe: () => true,
  parameters: {
    slug: text('条目 slug，必填；也接受 "kind/slug" 形式，例如 "blocks/pricing-1"。', true),
    kind: stringEnum(
      KIND_KEYS,
      '条目类型（可选）：slug 在多个类型下重名时用来消歧；也可以直接写进 slug。',
    ),
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        found: { type: 'boolean', required: true },
        slug: { type: 'string', required: true },
        installable: { type: 'boolean' },
        kind: { type: 'string' },
        title: { type: 'string' },
        category: { type: 'string' },
        previewUrl: { type: 'string' },
        registryUrl: { type: 'string' },
        installCommand: { type: 'string' },
        dependencies: { type: 'array', items: { type: 'string' } },
        prerequisites: { type: 'array', items: { type: 'string' } },
        checks: { type: 'array', items: { type: 'string' } },
        attribution: { type: 'string' },
        baseVariant: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                slug: { type: 'string' },
                installCommand: { type: 'string' },
              },
            },
            { type: 'null' },
          ],
        },
      },
    },
    render(_args, value) {
      return [{ type: 'text', text: formatInstallPlan(value) }]
    },
    presentationMeta(_args, value) {
      return {
        found: value.found,
        slug: value.slug,
        kind: value.kind ?? null,
        title: value.title ?? null,
        command: value.installCommand ?? null,
      }
    },
  },
  async execute(args = {}) {
    const parsed = parseSlug(args.slug)
    const slug = parsed.slug
    const kind = args.kind ?? parsed.kind
    if (!slug) throw new Error('slug 不能为空：先用 watermelon_catalog_search 找到条目。')

    const catalog = getCatalog()
    if (!catalog) {
      throw new Error('内置目录快照不可读：请重新安装 dsh-watermelon-ui，或直接用 web_fetch 访问 Watermelon 公共 catalog API。')
    }

    const entry = catalog.entries.find(item => item.slug === slug && (!kind || item.kind === kind))
    if (!entry) {
      return { found: false, slug, ...(kind ? { kind } : {}), prerequisites: [...PREREQUISITES] }
    }

    // 少数条目只有预览、没有 registry 包：不伪造安装命令，明确告诉调用方只能手动实现。
    const installable = Boolean(entry.installCommand || entry.registryUrl)
    if (!installable) {
      return {
        found: true,
        slug: entry.slug,
        installable: false,
        kind: entry.kind,
        title: entry.title,
        category: entry.category || '',
        previewUrl: entry.previewUrl || '',
        prerequisites: [...PREREQUISITES],
        checks: [...POST_INSTALL_CHECKS],
        attribution: ATTRIBUTION,
        baseVariant: null,
      }
    }

    const baseSlug = baseVariantOf(entry)
    const baseEntry = baseSlug
      ? catalog.entries.find(item => item.kind === entry.kind && item.slug === baseSlug)
      : undefined

    return {
      found: true,
      slug: entry.slug,
      installable: true,
      kind: entry.kind,
      title: entry.title,
      category: entry.category || '',
      previewUrl: entry.previewUrl || '',
      registryUrl: registryUrlOf(entry),
      installCommand: installCommandOf(entry),
      dependencies: Array.isArray(entry.dependencies) ? entry.dependencies : [],
      prerequisites: [...PREREQUISITES],
      checks: [...POST_INSTALL_CHECKS],
      attribution: ATTRIBUTION,
      baseVariant: baseEntry
        ? { slug: baseEntry.slug, installCommand: installCommandOf(baseEntry) }
        : null,
    }
  },
  presentCall(args) {
    return {
      card: 'generic',
      title: `Watermelon 安装计划：${args.slug}`,
      kind: 'install',
      rawInput: args,
    }
  },
  presentResult(_args, result) {
    if (result?.isError) return undefined
    const meta = result?.meta
    if (!meta || typeof meta !== 'object') return undefined
    if (!meta.found) {
      return {
        card: 'generic',
        title: `未找到 ${meta.slug}`,
        content: [{ type: 'text', text: '先检索准确 slug 再生成安装计划。' }],
      }
    }
    return {
      card: 'generic',
      title: `安装：${meta.title ?? meta.slug}`,
      content: [{ type: 'text', text: `\`${meta.command}\`` }],
    }
  },
}
