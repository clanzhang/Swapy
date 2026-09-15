import Taro from '@tarojs/taro'

import { CLOUD_ENV, COLLECTIONS, DEFAULT_CITY, DEFAULT_LOCATION } from '@/config'
import type {
  CardItem,
  CardQuery,
  ChatMessage,
  Item,
  ItemStatus,
  MatchView,
  MessageType,
  Page,
  ProfilePatch,
  PublishItemInput,
  SwipeDirection,
  SwipeResult,
  User,
} from '@/types'

import type { SwapyApi } from './adapter'

const USER_KEY = 'swapy:user:v1'

/**
 * 云开发实现。
 *
 * 所有「需要可信判断」的逻辑（尤其是匹配判定）都放在云函数里，
 * 客户端不直接写 swipes / matches，防止被篡改。
 * 只有聊天走数据库实时推送（watch），因为那是最低延迟的路径。
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
    // 给所有请求带上最新活跃时间，方便云函数更新 lastActiveAt
    await this.init()
  }

  async init(): Promise<User> {
    if (!this.inited) {
      cloud().init({ env: CLOUD_ENV, traceUser: true })
      this.inited = true
    }
    const user = await call<User>('login', {
      city: this.getCachedUser()?.city || DEFAULT_CITY,
      location: DEFAULT_LOCATION,
    })
    this.user = user
    try {
      Taro.setStorageSync(USER_KEY, JSON.stringify(user))
    } catch {
      // ignore
    }
    return user
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

  async updateProfile(patch: ProfilePatch): Promise<User> {
    const user = await call<User>('login', { ...patch })
    this.user = user
    try {
      Taro.setStorageSync(USER_KEY, JSON.stringify(user))
    } catch {
      // ignore
    }
    return user
  }

  async getCards(query: CardQuery): Promise<Page<CardItem>> {
    await this.ensureInit()
    return call<Page<CardItem>>('getCards', { ...query })
  }

  async swipe(toItemId: string, direction: SwipeDirection): Promise<SwipeResult> {
    await this.ensureInit()
    return call<SwipeResult>('swipe', { toItemId, direction })
  }

  async publishItem(input: PublishItemInput): Promise<Item> {
    await this.ensureInit()
    // 图片先传云存储，再把 fileID 交给云函数入库
    const uploaded: string[] = []
    for (const path of input.images) {
      // eslint-disable-next-line no-await-in-loop
      uploaded.push(await this.uploadImage(path))
    }
    return call<Item>('publishItem', { ...input, images: uploaded })
  }

  async getMyItems(): Promise<Item[]> {
    await this.ensureInit()
    const res = await db()
      .collection(COLLECTIONS.items)
      .where({ _openid: '{openid}' })
      .orderBy('createdAt', 'desc')
      .get()
    return res.data as Item[]
  }

  async getWantedItems(): Promise<CardItem[]> {
    await this.ensureInit()
    return call<CardItem[]>('getCards', { scope: 'wanted' })
  }

  async updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
    await this.ensureInit()
    await call('publishItem', { action: 'updateStatus', itemId, status })
  }

  async getMatches(): Promise<MatchView[]> {
    await this.ensureInit()
    return call<MatchView[]>('getMatches')
  }

  async getMatch(matchId: string): Promise<MatchView | null> {
    await this.ensureInit()
    const list = await call<MatchView[]>('getMatches', { matchId })
    return list[0] ?? null
  }

  async getChatHistory(matchId: string): Promise<ChatMessage[]> {
    await this.ensureInit()
    return call<ChatMessage[]>('getChatHistory', { matchId })
  }

  async sendMessage(
    matchId: string,
    type: MessageType,
    content: string,
  ): Promise<ChatMessage> {
    await this.ensureInit()
    return call<ChatMessage>('sendMessage', { matchId, type, content })
  }

  /**
   * 聊天实时推送：watch 云端 matches 集合中该会话的 messages 数组。
   * 云开发实时数据推送不需要额外的长连接服务，一对一会话完全够用。
   */
  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void {
    let watcher: any = null
    try {
      watcher = db()
        .collection(COLLECTIONS.matches)
        .doc(matchId)
        .watch({
          onChange: (snapshot: any) => {
            const doc = snapshot?.docs?.[0]
            if (!doc?.messages?.length) return
            const last = doc.messages[doc.messages.length - 1] as ChatMessage
            handler(last)
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
