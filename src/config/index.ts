/**
 * 运行模式开关。
 *
 * - 没有配置云环境 ID 时，自动走本地 Mock（内存 + Storage 持久化），
 *   整个小程序可以离线跑通「滑动 → 匹配 → 聊天」全流程。
 * - 配置 TARO_APP_CLOUD_ENV 后走真实云开发，业务代码零改动。
 */
export const CLOUD_ENV = process.env.TARO_APP_CLOUD_ENV || ''

export const USE_MOCK = !CLOUD_ENV || CLOUD_ENV === 'mock'

/** 云数据库集合名 */
export const COLLECTIONS = {
  users: 'users',
  items: 'items',
  swipes: 'swipes',
  matches: 'matches',
  /** 聊天记录独立成集合，不嵌在 matches 里 —— 方便分页查询 */
  messages: 'messages',
} as const

export const DEFAULT_LOCATION = { lat: 31.2304, lng: 121.4737 }

/** 匹配成功订阅消息模板 ID，留空则跳过订阅 */
export const MATCH_TEMPLATE_ID = ''
