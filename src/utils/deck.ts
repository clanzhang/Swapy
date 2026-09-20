/**
 * 首页牌堆「该显示什么」的纯函数判定。
 *
 * 为什么值得抽出来：这一步判错的表现特别难归因 ——
 * 卡片还在、或者下一页还在路上，却先弹出了「附近的物品都看过了」，
 * 用户既不能滑也不能点，只能退出去重进。而且它不报错、不崩溃。
 *
 * 规则（对应产品规格的「空状态显示条件」）：
 * - 空状态**必须同时满足**：牌堆为空 且 hasMore=false
 * - 牌堆为空、但 hasMore=true：那是「还没拉回来」，显示 loading；
 *   拉失败过就显示可重试的失败态，而不是空状态
 * - 牌堆还有卡：永远显示卡片，续拉的进度只在底部给一条小提示
 *
 * 注意这里**不看 loading**：牌堆空 + 还有下一页 时，不管是「正在拉」还是
 * 「刚滑空还没发起」，页面都该显示加载态并去把那一页拉回来。
 */
export type DeckView = 'quota' | 'empty' | 'loading' | 'retrying' | 'cards'

export interface DeckViewInput {
  /** 今日额度用完 —— 优先级最高，牌堆里还有卡也不让继续滑 */
  outOfQuota: boolean
  cardCount: number
  hasMore: boolean
  /** 上一次续拉失败了（网络/服务端）：要能退回「重新加载」，不能一直转圈 */
  loadFailed: boolean
}

export function deckView({
  outOfQuota,
  cardCount,
  hasMore,
  loadFailed,
}: DeckViewInput): DeckView {
  if (outOfQuota) return 'quota'
  if (cardCount > 0) return 'cards'
  if (!hasMore) return 'empty'
  if (loadFailed) return 'retrying'
  return 'loading'
}
