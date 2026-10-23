/**
 * tools/schema.js — SchemaSpec 方言的构造助手
 *
 * 这些助手只产出普通对象，不 import DSH API。方言要点：
 *   - 根层属性用属性级 `required: true`
 *   - items / oneOf 内的嵌套对象不允许 `required`
 *   - 不支持 type 数组（可空用 oneOf 表达）
 *   - 不支持 numeric bounds（在 execute 内钳制）
 */

/**
 * 字符串属性。
 * @param {string} description
 * @param {boolean} [required]
 */
export function text(description, required = false) {
  return { type: 'string', ...(required ? { required: true } : {}), description }
}

/**
 * 整数属性。
 * @param {string} description
 * @param {boolean} [required]
 */
export function integer(description, required = false) {
  return { type: 'integer', ...(required ? { required: true } : {}), description }
}

/**
 * 字符串枚举属性。
 * @param {readonly string[]} values
 * @param {string} description
 * @param {boolean} [required]
 */
export function stringEnum(values, description, required = false) {
  return {
    type: 'string',
    enum: values,
    ...(required ? { required: true } : {}),
    description,
  }
}

/**
 * 数组属性。
 * @param {object} items - 元素 schema
 * @param {string} [description]
 * @param {boolean} [required]
 */
export function array(items, description = '', required = false) {
  return {
    type: 'array',
    items,
    ...(required ? { required: true } : {}),
    ...(description ? { description } : {}),
  }
}

/**
 * 对象属性。
 * @param {object} [properties]
 * @param {{additionalProperties?: boolean, description?: string, required?: boolean}} [options]
 */
export function object(properties = {}, options = {}) {
  const { additionalProperties = true, description = '', required = false } = options
  return {
    type: 'object',
    ...(Object.keys(properties).length ? { properties } : {}),
    additionalProperties,
    ...(required ? { required: true } : {}),
    ...(description ? { description } : {}),
  }
}
