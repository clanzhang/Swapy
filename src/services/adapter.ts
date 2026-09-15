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

/**
 * 数据访问层。
 *
 * 页面只依赖这个接口，不认识「云开发」还是「Mock」。
 * 请求/响应的形状和 cloudfunctions/* 一一对应（见各方法注释）。
 *
 * 有几项是规格外的补充能力（getMyItems / getWantedItems / updateItemStatus /
 * uploadImage / subscribe / getMatch），「我的」页和聊天实时推送要用；
 * 它们不影响规格里定义的契约。
 */
export interface SwapyApi {
  // ------------------------------------------------------------------ login

  /** 静默登录：拿到当前用户，首次会创建账号 */
  login(): Promise<LoginResult>
  /** 本地缓存的用户，用于首屏免闪 */
  getCachedUser(): User | null
  /** 更新资料。云函数侧复用 login（多传几个字段而已） */
  updateProfile(patch: ProfilePatch): Promise<User>

  // --------------------------------------------------------------- getCards

  /** 首页匹配池分页 */
  getCards(params?: GetCardsParams): Promise<GetCardsResult>

  // ------------------------------------------------------------------ swipe

  /** 记录滑动，右滑时由服务端判断是否双向匹配 */
  swipe(params: SwipeParams): Promise<SwipeResult>

  // ------------------------------------------------------------- publishItem

  publishItem(input: PublishItemInput): Promise<PublishItemResult>

  // ------------------------------------------------------------- getMatches

  getMatches(): Promise<GetMatchesResult>
  /** 单个匹配（规格外，聊天页取双方物品用） */
  getMatch(matchId: string): Promise<MatchItem | null>

  // ------------------------------------------------- sendMessage / 聊天记录

  sendMessage(params: SendMessageParams): Promise<SendMessageResult>
  getChatHistory(params: GetChatHistoryParams): Promise<GetChatHistoryResult>
  /** 订阅某个会话的新消息，返回取消订阅函数 */
  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void

  // ------------------------------------------------------ 规格外的补充能力

  getMyItems(): Promise<Item[]>
  /** 我右滑过的物品 */
  getWantedItems(): Promise<CardItem[]>
  updateItemStatus(itemId: string, status: ItemStatus): Promise<void>
  /** 图片上传，返回可直接渲染的地址（云存储 fileID 或本地临时路径） */
  uploadImage(filePath: string): Promise<string>
}
