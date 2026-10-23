/**
 * search/aliases.js — 中文查询词到英文语料的映射（零 DSH API）
 *
 * 离线目录的标题与描述是英文，而用户常用中文提需求。这里只做“词级扩展”，
 * 不做语义检索：命中中文概念后追加对应英文词，再参与关键词打分。
 * 词表保持短而准，宁可漏扩展也不要把查询带到错误类别。
 */

/** 中文概念 → 英文检索词（同类词一起给，靠打分自然排序）。 */
export const ZH_ALIASES = Object.freeze({
  定价: ['pricing'],
  价格: ['pricing'],
  价格表: ['pricing'],
  套餐: ['pricing', 'plan'],
  订阅: ['pricing', 'subscription'],
  计费: ['pricing', 'billing'],
  登录: ['login', 'auth'],
  注册: ['signup', 'register', 'auth'],
  认证: ['auth', 'login'],
  密码: ['password'],
  验证码: ['otp'],
  导航: ['navigation', 'navbar', 'nav'],
  菜单: ['menu', 'dropdown'],
  侧边栏: ['sidebar'],
  页脚: ['footer'],
  页头: ['header', 'navbar'],
  首屏: ['hero'],
  横幅: ['announcement', 'banner'],
  按钮: ['button'],
  卡片: ['card'],
  表格: ['table'],
  数据表: ['data-table', 'table'],
  列表: ['list'],
  弹窗: ['dialog', 'modal'],
  对话框: ['dialog'],
  模态: ['modal', 'dialog'],
  抽屉: ['sheet', 'drawer'],
  提示: ['tooltip'],
  气泡: ['popover', 'tooltip'],
  通知: ['notification', 'sonner', 'toast'],
  消息: ['notification', 'toast'],
  表单: ['form'],
  输入: ['input'],
  文本域: ['textarea'],
  选择: ['select'],
  下拉: ['dropdown', 'select'],
  复选框: ['checkbox'],
  单选: ['radio'],
  开关: ['switch', 'toggle'],
  滑块: ['slider'],
  步骤: ['stepper'],
  分页: ['pagination'],
  日历: ['calendar'],
  日期: ['date-picker', 'calendar'],
  头像: ['avatar'],
  徽章: ['badge'],
  面包屑: ['breadcrumb'],
  标签页: ['tabs'],
  标签: ['badge', 'tabs'],
  折叠: ['accordion', 'collapsible'],
  手风琴: ['accordion'],
  轮播: ['carousel'],
  搜索: ['search'],
  命令面板: ['command'],
  上传: ['upload'],
  文件: ['file'],
  图表: ['chart'],
  看板: ['dashboard'],
  仪表盘: ['dashboard'],
  后台: ['dashboard', 'admin'],
  落地页: ['landing'],
  官网: ['landing', 'marketing'],
  营销: ['marketing'],
  模板: ['template'],
  区块: ['block'],
  组件: ['component'],
  动画: ['animated', 'motion'],
  微交互: ['micro-interaction'],
  英雄区: ['hero'],
  评价: ['testimonials'],
  常见问题: ['faq'],
  团队: ['team'],
  博客: ['blog'],
  招聘: ['career'],
  联系: ['contact'],
  邮件: ['newsletter', 'email'],
  集成: ['integrations'],
  错误: ['error'],
  骨架: ['skeleton'],
  加载: ['skeleton'],
  进度: ['progress'],
  空状态: ['empty'],
  排序: ['sort'],
  筛选: ['filter'],
  颜色: ['color'],
  深色: ['dark'],
})

/**
 * 把查询拆成检索词：英文/数字按词切分，中文概念按词表扩展。
 * @param {string} query
 * @returns {string[]}
 */
export function expandQuery(query) {
  const text = String(query ?? '').toLowerCase()
  if (!text.trim()) return []
  const tokens = new Set()
  for (const token of text.split(/[^a-z0-9]+/)) {
    // 太短的英文 token 噪声太大（'no'、'a'），中文概念靠下面的词表扩展。
    if (token.length >= 3) tokens.add(token)
  }
  for (const [zh, english] of Object.entries(ZH_ALIASES)) {
    if (!text.includes(zh)) continue
    for (const token of english) tokens.add(token)
  }
  return [...tokens]
}
