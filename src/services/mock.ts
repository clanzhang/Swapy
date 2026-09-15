import Taro from '@tarojs/taro'

import { DEFAULT_LOCATION } from '@/config'
import { MAX_DISTANCE_KM, PRICE_RANGE_MAP } from '@/constants'
import { SEED_ITEMS, SEED_ME, SEED_SWIPES, SEED_USERS, SEED_VERSION } from '@/constants/seed'
import type {
  CardItem,
  CardQuery,
  ChatMessage,
  Item,
  ItemStatus,
  Match,
  MatchView,
  MessageType,
  Page,
  ProfilePatch,
  PublishItemInput,
  QuotaState,
  Swipe,
  SwipeDirection,
  SwipeResult,
  User,
} from '@/types'
import { haversine } from '@/utils/geo'
import { describeHits, moderateItem } from '@/utils/moderation'
import { DAILY_QUOTA, nextResetAt, quotaDayKey } from '@/utils/quota'
import { uid } from '@/utils'

import type { SwapyApi } from './adapter'

const DB_KEY = 'swapy:mock-db:v1'
const USER_KEY = 'swapy:mock-user:v1'

interface MockDb {
  users: User[]
  items: Item[]
  swipes: Swipe[]
  matches: Match[]
  messages: ChatMessage[]
  meId: string
  /** 每日「想要」配额。dayKey 决定什么时候重置。 */
  quota: { dayKey: string; used: number }
  /** 存档对应的种子版本，对不上就重新播种 */
  seedVersion: number
}

function seedDb(): MockDb {
  return {
    users: SEED_USERS.map((u) => ({ ...u })),
    items: SEED_ITEMS.map((i) => ({ ...i })),
    swipes: SEED_SWIPES.map((s) => ({ ...s })),
    matches: [],
    messages: [],
    meId: SEED_ME._id,
    quota: { dayKey: quotaDayKey(Date.now()), used: 0 },
    seedVersion: SEED_VERSION,
  }
}

/**
 * 内容不合规就抛错，把具体原因带在 message 里让页面直接展示。
 * 客户端能被绕过，所以真正的门在这里（云函数侧同样有一道）。
 */
function assertPublishable(title: string, description: string) {
  const result = moderateItem({ title, description })
  if (!result.ok) {
    throw new Error(describeHits(result.hits))
  }
}

/**
 * Mock 实现：全部数据放在内存，并持久化到 Storage。
 * 目的是让「发布 → 滑动 → 匹配 → 聊天」这条链路可以完全离线跑通，
 * 也让 UI 开发不被云环境阻塞。
 */
class MockApi implements SwapyApi {
  private db: MockDb
  private listeners = new Map<string, Set<(msg: ChatMessage) => void>>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.db = this.load()
  }

  // ---------------------------------------------------------------- 基础设施

  private load(): MockDb {
    try {
      const raw = Taro.getStorageSync(DB_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb
        // 种子数据改过就别用旧存档了，否则老设备上永远是旧牌堆，
        // 而且表现成「怎么点都不匹配」这类很难查的问题
        if (parsed?.items?.length && parsed.seedVersion === SEED_VERSION) {
          // 兼容旧版本的存档：补上后来才加的字段
          if (!parsed.quota) {
            parsed.quota = { dayKey: quotaDayKey(Date.now()), used: 0 }
          }
          return parsed
        }
      }
    } catch {
      // 读坏了就重新播种，不让脏数据卡死整个 App
    }
    const fresh = seedDb()
    this.persist(fresh)
    return fresh
  }

  private persist(db: MockDb = this.db) {
    // 写操作很频繁（每次滑动），做个 200ms 合并再落盘
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      try {
        Taro.setStorageSync(DB_KEY, JSON.stringify(db))
      } catch {
        // 超过 Storage 上限时静默降级为纯内存，不影响本次会话
      }
    }, 200)
  }

  private get me(): User {
    const found = this.db.users.find((u) => u._id === this.db.meId)
    if (found) return found
    const fresh: User = { ...SEED_ME, createdAt: Date.now(), lastActiveAt: Date.now() }
    this.db.users.push(fresh)
    return fresh
  }

  private userById(id: string): User | undefined {
    return this.db.users.find((u) => u._id === id)
  }

  private itemById(id: string): Item | undefined {
    return this.db.items.find((i) => i._id === id)
  }

  private distanceTo(user: User): number {
    const from = this.me.location || DEFAULT_LOCATION
    const to = user.location || DEFAULT_LOCATION
    return haversine(from, to)
  }

  private toCard(item: Item): CardItem {
    const owner = this.userById(item.ownerId)!
    return { ...item, owner, distanceKm: this.distanceTo(owner) }
  }

  // ---------------------------------------------------------------- 每日配额

  /**
   * 读配额。跨过刷新点（每天 12:00）会自动归零。
   * dayKey 用北京时间算，不依赖设备时区 —— 否则出国或者改系统时间就能白嫖。
   */
  private readQuota(): QuotaState {
    const now = Date.now()
    const key = quotaDayKey(now)
    if (this.db.quota.dayKey !== key) {
      this.db.quota = { dayKey: key, used: 0 }
      this.persist()
    }
    const used = this.db.quota.used
    return {
      limit: DAILY_QUOTA,
      used,
      remaining: Math.max(0, DAILY_QUOTA - used),
      resetAt: nextResetAt(now),
    }
  }

  // -------------------------------------------------------------------- 用户

  async init(): Promise<User> {
    const cached = this.getCachedUser()
    if (cached) {
      // 沿用缓存身份，但把最新的种子数据合并进来（方便反复调试）
      Object.assign(this.me, cached, { lastActiveAt: Date.now() })
    } else {
      this.me.lastActiveAt = Date.now()
    }
    this.persist()
    return this.me
  }

  getCachedUser(): User | null {
    try {
      const raw = Taro.getStorageSync(USER_KEY)
      if (raw) return JSON.parse(raw) as User
    } catch {
      // ignore
    }
    return null
  }

  async updateProfile(patch: ProfilePatch): Promise<User> {
    const me = this.me
    Object.assign(me, patch, { lastActiveAt: Date.now() })
    try {
      Taro.setStorageSync(USER_KEY, JSON.stringify(me))
    } catch {
      // ignore
    }
    this.persist()
    return { ...me }
  }

  // ---------------------------------------------------------------- 匹配池

  async getCards(query: CardQuery): Promise<Page<CardItem>> {
    const me = this.me
    const offset = Number(query.cursor || 0) || 0
    const limit = query.limit ?? 10

    // 额度用完就不再发卡。这是唯一的下发口径，
    // 页面不用自己拼「没卡了」和「额度没了」两种状态
    const quota = this.readQuota()
    if (quota.remaining <= 0) {
      return { list: [], nextCursor: null, quota }
    }

    const swipedIds = new Set(
      this.db.swipes.filter((s) => s.fromUserId === me._id).map((s) => s.toItemId),
    )

    // 我的物品的估值区间，用来做「有交集」筛选
    const myRanges = this.db.items
      .filter((i) => i.ownerId === me._id && i.status === 'active')
      .map((i) => PRICE_RANGE_MAP[i.priceRange])
      .filter(Boolean)

    const pool = this.db.items
      .filter((item) => {
        if (item.status !== 'active') return false
        if (item.ownerId === me._id) return false
        if (swipedIds.has(item._id)) return false
        if (query.categories?.length && !query.categories.includes(item.category)) return false

        const owner = this.userById(item.ownerId)
        if (!owner) return false
        if (this.distanceTo(owner) > MAX_DISTANCE_KM) return false

        // 估值区间有交集（我没有在架物品时不筛，避免新用户无卡可滑）
        if (myRanges.length) {
          const range = PRICE_RANGE_MAP[item.priceRange]
          const overlap = myRanges.some((r) => r.min <= range.max && range.min <= r.max)
          if (!overlap) return false
        }
        return true
      })
      .map((item) => this.toCard(item))
      .sort((a, b) => a.distanceKm - b.distanceKm || b.createdAt - a.createdAt)

    return {
      list: pool.slice(offset, offset + limit),
      nextCursor: offset + limit < pool.length ? String(offset + limit) : null,
      quota,
    }
  }

  // -------------------------------------------------------------------- 滑动

  async swipe(toItemId: string, direction: SwipeDirection): Promise<SwipeResult> {
    const me = this.me
    const target = this.itemById(toItemId)
    if (!target) return { matched: false, quota: this.readQuota() }

    // 左滑跳过和右滑想要都消耗额度：额度就是「每天能看多少张卡」
    const before = this.readQuota()
    // 额度用完就整条不记录：否则用户明天回来会发现物品被「偷偷」跳过了，
    // 而他并没有真的做过选择
    if (before.remaining <= 0) {
      return { matched: false, quota: before }
    }
    this.db.quota.used += 1

    const existed = this.db.swipes.find(
      (s) => s.fromUserId === me._id && s.toItemId === toItemId,
    )
    if (!existed) {
      this.db.swipes.push({
        _id: uid('sw'),
        fromUserId: me._id,
        toItemId,
        toUserId: target.ownerId,
        direction,
        createdAt: Date.now(),
      })
    }

    if (direction === 'left') {
      this.persist()
      return { matched: false, quota: this.readQuota() }
    }

    // 对方是否右滑过我的任一物品
    const myItemIds = new Set(
      this.db.items.filter((i) => i.ownerId === me._id).map((i) => i._id),
    )
    const reciprocal = this.db.swipes.find(
      (s) =>
        s.fromUserId === target.ownerId &&
        myItemIds.has(s.toItemId) &&
        s.direction === 'right',
    )

    if (!reciprocal) {
      this.persist()
      return { matched: false, quota: this.readQuota() }
    }

    const already = this.db.matches.find(
      (m) =>
        (m.userA === me._id && m.userB === target.ownerId) ||
        (m.userA === target.ownerId && m.userB === me._id),
    )

    const match: Match =
      already ??
      {
        _id: uid('mt'),
        userA: me._id,
        userB: target.ownerId,
        itemA: toItemId,
        itemB: reciprocal.toItemId,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      }

    if (!already) {
      this.db.matches.push(match)
      this.seedGreeting(match)
    }

    this.persist()
    return { matched: true, match: this.toMatchView(match)!, quota: this.readQuota() }
  }

  /** 匹配成功后塞一句对方打招呼的话，让聊天页不是空的 */
  private seedGreeting(match: Match) {
    const peerId = match.userA === this.db.meId ? match.userB : match.userA
    const peer = this.userById(peerId)
    if (!peer) return
    const peerItem = this.itemById(peerId === match.userA ? match.itemA : match.itemB)
    this.db.messages.push({
      _id: uid('msg'),
      matchId: match._id,
      fromUserId: peerId,
      type: 'text',
      content: `哈喽，看到你的物品了～ 我这边是「${peerItem?.title ?? '闲置'}」，可以聊聊怎么换吗？`,
      createdAt: Date.now(),
    })
  }

  // -------------------------------------------------------------------- 物品

  async publishItem(input: PublishItemInput): Promise<Item> {
    // 内容校验。客户端也会跑一遍做即时提示，但判定以服务端为准。
    // Mock 就是「服务端」，和云函数行为一致。
    assertPublishable(input.title, input.description)

    const item: Item = {
      _id: uid('it'),
      ownerId: this.me._id,
      images: input.images,
      title: input.title,
      category: input.category,
      condition: input.condition,
      priceRange: input.priceRange,
      description: input.description,
      status: 'active',
      createdAt: Date.now(),
    }
    this.db.items.unshift(item)
    this.persist()
    return item
  }

  async getMyItems(): Promise<Item[]> {
    return this.db.items
      .filter((i) => i.ownerId === this.me._id)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async getWantedItems(): Promise<CardItem[]> {
    const swipes = this.db.swipes
      .filter((s) => s.fromUserId === this.me._id && s.direction === 'right')
      .sort((a, b) => b.createdAt - a.createdAt)
    return swipes
      .map((s) => this.itemById(s.toItemId))
      .filter((i): i is Item => Boolean(i))
      .map((i) => this.toCard(i))
  }

  async updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
    const item = this.itemById(itemId)
    if (item && item.ownerId === this.me._id) {
      item.status = status
      this.persist()
    }
  }

  // -------------------------------------------------------------------- 匹配

  private toMatchView(match: Match): MatchView | null {
    const meId = this.me._id
    const isA = match.userA === meId
    const peerId = isA ? match.userB : match.userA
    const peer = this.userById(peerId)
    const myItem = this.itemById(isA ? match.itemB : match.itemA)
    const peerItem = this.itemById(isA ? match.itemA : match.itemB)
    if (!peer || !myItem || !peerItem) return null

    const msgs = this.db.messages
      .filter((m) => m.matchId === match._id)
      .sort((a, b) => a.createdAt - b.createdAt)

    return {
      _id: match._id,
      createdAt: match.createdAt,
      peer,
      myItem,
      peerItem,
      lastMessage: msgs[msgs.length - 1],
    }
  }

  async getMatches(): Promise<MatchView[]> {
    return this.db.matches
      .map((m) => this.toMatchView(m))
      .filter((m): m is MatchView => Boolean(m))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async getMatch(matchId: string): Promise<MatchView | null> {
    const match = this.db.matches.find((m) => m._id === matchId)
    return match ? this.toMatchView(match) : null
  }

  // -------------------------------------------------------------------- 聊天

  async getChatHistory(matchId: string): Promise<ChatMessage[]> {
    return this.db.messages
      .filter((m) => m.matchId === matchId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async sendMessage(
    matchId: string,
    type: MessageType,
    content: string,
  ): Promise<ChatMessage> {
    const msg: ChatMessage = {
      _id: uid('msg'),
      matchId,
      fromUserId: this.me._id,
      type,
      content,
      createdAt: Date.now(),
    }
    this.db.messages.push(msg)
    const match = this.db.matches.find((m) => m._id === matchId)
    if (match) match.lastMessageAt = msg.createdAt
    this.persist()
    this.emit(msg)
    this.maybeAutoReply(matchId)
    return msg
  }

  private emit(msg: ChatMessage) {
    this.listeners.get(msg.matchId)?.forEach((fn) => fn(msg))
  }

  /**
   * Mock 专属：对方隔一会儿回一句，方便验证「收到消息」的 UI 表现。
   * 真实环境里这一步由云开发数据库推送完成。
   */
  private maybeAutoReply(matchId: string) {
    const match = this.db.matches.find((m) => m._id === matchId)
    if (!match) return
    const replied = this.db.messages.filter(
      (m) => m.matchId === matchId && m.fromUserId !== this.db.meId,
    ).length
    if (replied >= 2) return

    const peerId = match.userA === this.db.meId ? match.userB : match.userA
    const replies = ['可以的，你方便什么时候换？', '好呀，我在上海，周末都行～', '这个还在的，随时可以约']
    setTimeout(() => {
      const msg: ChatMessage = {
        _id: uid('msg'),
        matchId,
        fromUserId: peerId,
        type: 'text',
        content: replies[Math.min(replied, replies.length - 1)],
        createdAt: Date.now(),
      }
      this.db.messages.push(msg)
      match.lastMessageAt = msg.createdAt
      this.persist()
      this.emit(msg)
    }, 1200)
  }

  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void {
    if (!this.listeners.has(matchId)) this.listeners.set(matchId, new Set())
    this.listeners.get(matchId)!.add(handler)
    return () => {
      this.listeners.get(matchId)?.delete(handler)
    }
  }

  // -------------------------------------------------------------------- 上传

  async uploadImage(filePath: string): Promise<string> {
    // Mock 下直接用本地临时路径渲染，不出网
    return filePath
  }

  // -------------------------------------------------------------------- 重置

  /** 把数据恢复到初始种子状态（开发阶段清掉自己制造的一地鸡毛） */
  resetToSeed() {
    this.db = seedDb()
    this.persist(this.db)
    try {
      Taro.setStorageSync(USER_KEY, JSON.stringify(this.me))
    } catch {
      // ignore
    }
  }
}

/**
 * 当前实例的引用。
 *
 * 重置必须作用在同一个实例上（store 里持有的是它的引用），
 * 而不是简单地清 Storage 后重建 —— 那样内存里的旧数据还在。
 */
let current: MockApi | null = null

export function createMockApi(): SwapyApi {
  current = new MockApi()
  return current
}

/** 开发用：把 Mock 数据恢复到种子状态。非 Mock 模式下返回 false。 */
export function resetMockData(): boolean {
  if (!current) return false
  current.resetToSeed()
  return true
}
