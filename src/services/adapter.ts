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

/**
 * 数据访问层。
 *
 * 页面和 store 只依赖这个接口，不认识「云开发」还是「Mock」。
 * 从 Mock 切到真实云开发，只需要换 services/index.ts 里的一行实现。
 */
export interface SwapyApi {
  /** 登录 / 初始化：拿到当前用户 */
  init(): Promise<User>
  /** 本地缓存的用户，用于首屏免闪 */
  getCachedUser(): User | null
  updateProfile(patch: ProfilePatch): Promise<User>

  /** 匹配池分页拉取 */
  getCards(query: CardQuery): Promise<Page<CardItem>>
  /** 记录一次滑动，并返回是否匹配成功 */
  swipe(toItemId: string, direction: SwipeDirection): Promise<SwipeResult>

  publishItem(input: PublishItemInput): Promise<Item>
  getMyItems(): Promise<Item[]>
  /** 我右滑过的物品 */
  getWantedItems(): Promise<CardItem[]>
  updateItemStatus(itemId: string, status: ItemStatus): Promise<void>

  getMatches(): Promise<MatchView[]>
  getMatch(matchId: string): Promise<MatchView | null>

  getChatHistory(matchId: string): Promise<ChatMessage[]>
  sendMessage(matchId: string, type: MessageType, content: string): Promise<ChatMessage>
  /** 订阅某个会话的新消息，返回取消订阅函数 */
  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void

  /** 图片上传，返回可直接渲染的地址（云存储 fileID 或本地临时路径） */
  uploadImage(filePath: string): Promise<string>
}
