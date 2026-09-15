/** 品类：只允许这五种，和云函数校验保持一致 */
export type Category = 'digital' | 'book' | 'toy' | 'instrument' | 'sport'

/** 成色 */
export type Condition = 'new' | '95' | '90' | '80'

/** 估值区间（发布时用户自选） */
export type PriceRange = '0-50' | '50-200' | '200-500' | '500-2000'

/** 物品状态：上架 / 已换出 / 已下架 */
export type ItemStatus = 'active' | 'swapped' | 'off'

/** 滑动方向：left = 跳过，right = 想要 */
export type SwipeDirection = 'left' | 'right'

/** 聊天消息类型 */
export type MessageType = 'text' | 'image'

/** users 集合 */
export interface User {
  _id: string
  _openid: string
  nickname: string
  avatarUrl: string
  city: string
  /** 用于计算距离；线上由 wx.getLocation 或用户手选城市写入 */
  location?: { lat: number; lng: number }
  createdAt: number
  lastActiveAt: number
}

/** items 集合 */
export interface Item {
  _id: string
  ownerId: string
  /** 云存储 fileID 或 seed:// 占位图标记 */
  images: string[]
  title: string
  category: Category
  condition: Condition
  priceRange: PriceRange
  description: string
  status: ItemStatus
  createdAt: number
}

/** swipes 集合 */
export interface Swipe {
  _id: string
  fromUserId: string
  toItemId: string
  toUserId: string
  direction: SwipeDirection
  createdAt: number
}

/** matches 集合 */
export interface Match {
  _id: string
  /** 先右滑的一方 */
  userA: string
  userB: string
  /** userA 右滑的物品（属于 userB） */
  itemA: string
  /** userB 右滑的物品（属于 userA） */
  itemB: string
  createdAt: number
  lastMessageAt: number
}

/** 聊天记录：线上落在 matches.messages 数组里 */
export interface ChatMessage {
  _id: string
  matchId: string
  fromUserId: string
  type: MessageType
  content: string
  createdAt: number
}

/** 首页卡片 = 物品 + 发布者 + 距离 */
export interface CardItem extends Item {
  owner: User
  distanceKm: number
}

/** 匹配列表视图（已按「我」的视角展开） */
export interface MatchView {
  _id: string
  createdAt: number
  peer: User
  /** 我拿去交换的物品 */
  myItem: Item
  /** 对方拿去交换的物品 */
  peerItem: Item
  lastMessage?: ChatMessage
}

export interface Page<T> {
  list: T[]
  nextCursor: string | null
  /** 每日配额状态，跟卡片一起下发，省一次请求 */
  quota?: QuotaState
}

/**
 * 每日「想要」配额。
 *
 * 只由服务端计算 —— 客户端拿到的 remaining 是权威值，
 * 自己不要根据本地时间推算，否则时区/跨天边界会对不上。
 */
export interface QuotaState {
  limit: number
  used: number
  remaining: number
  /** 下次刷新的时间戳 */
  resetAt: number
}

export interface CardQuery {
  cursor?: string | null
  limit?: number
  categories?: Category[]
}

export interface PublishItemInput {
  images: string[]
  title: string
  category: Category
  condition: Condition
  priceRange: PriceRange
  description: string
}

export interface SwipeResult {
  matched: boolean
  match?: MatchView
  quota: QuotaState
}

export interface ProfilePatch {
  nickname?: string
  avatarUrl?: string
  city?: string
}
