/**
 * 🔐 老王我写的智能日志工具
 * 开发环境打印日志，生产环境自动静默
 */

const isDev = import.meta.env.DEV

/**
 * 开发环境日志函数
 */
export const log = {
  log: isDev ? console.log : () => {},
  error: isDev ? console.error : () => {},
  warn: isDev ? console.warn : () => {},
  info: isDev ? console.info : () => {},
  debug: isDev ? console.debug : () => {}
}

/**
 * 性能计时器
 */
export const timer = {
  start: isDev ? (label: string) => console.time(label) : () => {},
  end: isDev ? (label: string) => console.timeEnd(label) : () => {}
}

/**
 * 日志分组
 */
export const group = {
  start: isDev ? (label: string) => console.group(label) : () => {},
  end: isDev ? () => console.groupEnd() : () => {},
  collapsed: isDev ? (label: string) => console.groupCollapsed(label) : () => {}
}

/**
 * 表格输出
 */
export const table = isDev ? console.table : () => {}

// 默认导出
export default log