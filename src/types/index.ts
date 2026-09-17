/** 品类：只允许这五种，和云函数校验保持一致 */
export type Category = '数码' | '书籍' | '潮玩' | '乐器' | '运动' | '家具'

/** 成色 */
export type Condition = '全新' | '95新' | '9成新' | '8成新'

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

/** 消息的发送状态。只有本地的「乐观渲染」需要它，服务端不存这个字段。 */
export type MessageStatus = 'sending' | 'sent' | 'failed'

/** 聊天消息。存在独立的 messages 集合里，不嵌在 matches 文档中。 */
export interface ChatMessage {
  _id: string
  matchId: string
  /** 发送者用户 ID */
  senderId: string
  content: string
  type: MessageType
  createdAt: number
}

/**
 * 首页卡片 = 物品 + 发布者。
 * distanceKm 是规格外的可选字段：筛选看同城，但卡片上显示距离更友好，
 * 拿不到定位时前端回退显示 city。
 */
export interface CardItem extends Item {
  owner: User
  distanceKm?: number
}

/** 匹配列表项（已按「我」的视角展开，不需要页面知道自己是 A 还是 B） */
export interface MatchItem {
  matchId: string
  otherUser: User
  /** 我拿去交换的物品 */
  myItem: Item
  /** 对方拿去交换的物品 */
  otherItem: Item
  createdAt: number
  /** 最近一条消息，列表页做预览（规格外，可选） */
  lastMessage?: ChatMessage
}

/**
 * 每日刷卡额度。
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

// ---------------------------------------------------------------- 云函数契约
//
// 下面的请求/响应类型和 cloudfunctions/* 一一对应。
// Mock 实现走的是同一套类型，所以页面可以在离线状态下跑通全流程。

/** login */
export interface LoginResult {
  user: User
  /** 是否是本次新创建的账号 */
  isNew: boolean
}

/** getCards */
export interface GetCardsParams {
  page?: number
  pageSize?: number
  /** 规格外：首页的品类筛选 chips。不传就是全部品类 */
  categories?: Category[]
}

export interface GetCardsResult {
  cards: CardItem[]
  hasMore: boolean
  /** 规格外：每日额度，跟卡片一起下发省一次请求 */
  quota?: QuotaState
}

/** swipe */
export interface SwipeParams {
  toItemId: string
  toUserId: string
  direction: SwipeDirection
}

export interface SwipeResult {
  matched: boolean
  matchId?: string
  otherUser?: User
  /** 规格外 */
  quota?: QuotaState
}

/** publishItem */
export interface PublishItemInput {
  title: string
  category: Category
  condition: Condition
  priceRange: PriceRange
  description: string
  /** 云存储 fileID 列表 */
  imageFileIds: string[]
}

export interface PublishItemResult {
  success: boolean
  itemId?: string
  error?: string
}

/** getMatches */
export interface GetMatchesResult {
  matches: MatchItem[]
}

/** sendMessage */
export interface SendMessageParams {
  matchId: string
  content: string
  type: MessageType
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  /**
   * 规格外：回传完整消息。
   *
   * 界面是「先本地渲染、再等服务端确认」的乐观更新，拿到真实 _id 之后
   * 才能把那条临时消息替换掉 —— 否则 watch 推来的同一条消息没法按 _id 去重。
   */
  message?: ChatMessage
}

/**
 * 界面上用的消息 = 服务端字段 + 本地发送状态。
 * 发送失败的消息并没有落库，随时可能被丢弃或重试。
 */
export interface LocalMessage extends ChatMessage {
  status: MessageStatus
}

/** getChatHistory */
export interface GetChatHistoryParams {
  matchId: string
  page?: number
}

export interface GetChatHistoryResult {
  success: boolean
  messages: ChatMessage[]
}

export interface ProfilePatch {
  nickname?: string
  avatarUrl?: string
  city?: string
}
