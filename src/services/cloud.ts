import Taro from '@tarojs/taro'

import { CLOUD_ENV, COLLECTIONS, DEFAULT_CITY, DEFAULT_LOCATION } from '@/config'
import type {
  CardItem,
  ChatMessage,
  GetCardsParams,
  GetCardsResult,
  GetChatHistoryParams,
  GetChatHistoryResult,
  GetMatchesResult,
  Item,
  ItemStatus,
  LoginResult,
  MatchItem,
  ProfilePatch,
  PublishItemInput,
  PublishItemResult,
  SendMessageParams,
  SendMessageResult,
  SwipeParams,
  SwipeResult,
  User,
} from '@/types'

import type { SwapyApi } from './adapter'

const USER_KEY = 'swapy:user:v1'

/**
 * 云开发实现。
 *
 * 所有需要可信判断的逻辑（匹配池筛选、匹配判定、额度、内容校验）都在云函数里，
 * 客户端不直接写 swipes / matches / messages，防止被绕过。
 *
 * 聊天是唯一走客户端数据库查询的地方 —— 实时推送（watch）必须由客户端建立。
 */

// 部分平台没有 Taro.cloud，这里统一收口并给出可读的报错
function cloud(): any {
  const c = (Taro as any).cloud
  if (!c) throw new Error('当前运行环境不支持微信云开发，请改用 Mock 模式')
  return c
}

function db(): any {
  return cloud().database()
}

/** 云函数统一返回 { ok, data, message }，这里拆包 */
async function call<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const res = await cloud().callFunction({ name, data })
  const result = res?.result as { ok?: boolean; data?: T; message?: string } | undefined
  if (!result || result.ok === false) {
    throw new Error(result?.message || `云函数 ${name} 调用失败`)
  }
  return result.data as T
}

class CloudApi implements SwapyApi {
  private inited = false
  private user: User | null = null

  private async ensureInit() {
    if (this.inited) return
    cloud().init({ env: CLOUD_ENV, traceUser: true })
    this.inited = true
    await this.login()
  }

  // ------------------------------------------------------------------ login

  async login(): Promise<LoginResult> {
    if (!this.inited) {
      cloud().init({ env: CLOUD_ENV, traceUser: true })
      this.inited = true
    }
    const result = await call<LoginResult>('login', {
      city: this.getCachedUser()?.city || DEFAULT_CITY,
      location: DEFAULT_LOCATION,
    })
    this.user = result.user
    this.cacheUser(result.user)
    return result
  }

  getCachedUser(): User | null {
    if (this.user) return this.user
    try {
      const raw = Taro.getStorageSync(USER_KEY)
      if (raw) {
        this.user = JSON.parse(raw) as User
        return this.user
      }
    } catch {
      // ignore
    }
    return null
  }

  private cacheUser(user: User) {
    try {
      Taro.setStorageSync(USER_KEY, JSON.stringify(user))
    } catch {
      // ignore
    }
  }

  async updateProfile(patch: ProfilePatch): Promise<User> {
    // 复用 login 云函数：多传几个字段它就顺带更新资料
    const user = await call<User>('login', { ...patch })
    this.user = user
    this.cacheUser(user)
    return user
  }

  // --------------------------------------------------------------- getCards

  async getCards(params: GetCardsParams = {}): Promise<GetCardsResult> {
    await this.ensureInit()
    return call<GetCardsResult>('getCards', { ...params })
  }

  // ------------------------------------------------------------------ swipe

  async swipe(params: SwipeParams): Promise<SwipeResult> {
    await this.ensureInit()
    return call<SwipeResult>('swipe', { ...params })
  }

  // ------------------------------------------------------------- publishItem

  async publishItem(input: PublishItemInput): Promise<PublishItemResult> {
    await this.ensureInit()

    // 先传云存储拿 fileID，再把 fileID 交给 publishItem
    const imageFileIds: string[] = []
    for (const path of input.imageFileIds) {
      imageFileIds.push(await this.uploadImage(path))
    }

    return call<PublishItemResult>('publishItem', { ...input, imageFileIds })
  }

  // ------------------------------------------------------------- getMatches

  async getMatches(): Promise<GetMatchesResult> {
    await this.ensureInit()
    return call<GetMatchesResult>('getMatches')
  }

  async getMatch(matchId: string): Promise<MatchItem | null> {
    await this.ensureInit()
    const { matches } = await call<GetMatchesResult>('getMatches', { matchId })
    return matches[0] ?? null
  }

  // ------------------------------------------------- sendMessage / 聊天记录

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    await this.ensureInit()
    return call<SendMessageResult>('sendMessage', { ...params })
  }

  async getChatHistory(params: GetChatHistoryParams): Promise<GetChatHistoryResult> {
    await this.ensureInit()
    return call<GetChatHistoryResult>('getChatHistory', { ...params })
  }

  /**
   * 聊天实时推送：watch messages 集合里该会话的新增记录。
   * 消息独立成集合（不嵌在 matches 文档里）就是为了能这样按 matchId 过滤。
   */
  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void {
    let watcher: any = null
    try {
      watcher = db()
        .collection(COLLECTIONS.messages)
        .where({ matchId })
        .watch({
          onChange: (snapshot: any) => {
            const added = (snapshot?.docChanges ?? []).filter(
              (c: any) => c.dataType === 'add' || c.queueType === 'enqueue',
            )
            for (const change of added) {
              const doc = change.doc as ChatMessage
              if (doc) handler(doc)
            }
          },
          onError: () => {
            // 实时推送失败不影响手动刷新，静默降级
          },
        })
    } catch {
      // ignore
    }
    return () => {
      try {
        watcher?.close()
      } catch {
        // ignore
      }
    }
  }

  // ------------------------------------------------------ 规格外的补充能力

  async getMyItems(): Promise<Item[]> {
    await this.ensureInit()
    const me = this.getCachedUser()
    if (!me) return []
    // 按 ownerId 查，和 getCards / swipe 保持一致。
    // 不用 _openid：那是云数据库的保留字段，由系统维护，
    // 云函数里手动写它、客户端再拿 '{openid}' 去查，行为在不同环境并不一致。
    const res = await db()
      .collection(COLLECTIONS.items)
      .where({ ownerId: me._id })
      .orderBy('createdAt', 'desc')
      .get()
    return res.data as Item[]
  }

  async getWantedItems(): Promise<CardItem[]> {
    await this.ensureInit()
    const res = await call<{ cards: CardItem[] }>('getCards', { scope: 'wanted' })
    return res.cards ?? []
  }

  async updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
    await this.ensureInit()
    await call('publishItem', { action: 'updateStatus', itemId, status })
  }

  async uploadImage(filePath: string): Promise<string> {
    // 已经是云存储地址就直接复用
    if (filePath.startsWith('cloud://')) return filePath
    const ext = filePath.split('.').pop() || 'jpg'
    const res = await cloud().uploadFile({
      cloudPath: `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      filePath,
    })
    return res.fileID as string
  }
}

export function createCloudApi(): SwapyApi {
  return new CloudApi()
}
