import { create } from 'zustand'
import Taro from '@tarojs/taro'

import { CARD_PAGE_SIZE } from '@/constants'
import { itemService, matchService, swipeService } from '@/services'
import type {
  CardItem,
  Category,
  MatchItem,
  QuotaState,
  SwipeDirection,
  SwipeResult,
} from '@/types'

/** 剩余不足这个数就提前拉下一批，让「滑到底」这件事用户感知不到 */
const PREFETCH_THRESHOLD = 3

interface DeckState {
  cards: CardItem[]
  /** 下一页页码（从 1 开始） */
  page: number
  hasMore: boolean
  loading: boolean
  /** 品类筛选，空数组 = 不限 */
  categories: Category[]
  /** 非空时首页弹出匹配成功动画 */
  matchResult: MatchItem | null
  /** 每日刷卡额度，由服务端下发 */
  quota: QuotaState | null
  /**
   * 请求代。每次重置（切品类 / 重新加载）自增。
   * 分页响应回来时如果代已变，说明这份结果已经过期，必须丢掉 ——
   * 否则会把上一个筛选条件的卡片追加进新牌堆。
   */
  epoch: number

  init(): Promise<void>
  loadMore(): Promise<void>
  setCategories(categories: Category[]): Promise<void>
  /** 卡片飞出动画播完后调用，推进牌堆 */
  commitSwipe(direction: SwipeDirection): Promise<void>
  clearMatch(): void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  cards: [],
  page: 1,
  hasMore: true,
  loading: false,
  categories: [],
  matchResult: null,
  quota: null,
  epoch: 0,

  async init() {
    set({
      cards: [],
      page: 1,
      hasMore: true,
      loading: false,
      epoch: get().epoch + 1,
    })
    await get().loadMore()
  },

  async loadMore() {
    const { loading, hasMore, page, categories, epoch } = get()
    if (loading || !hasMore) return
    // 额度用完就别再拉卡了，服务端也不会给
    if (get().quota && get().quota!.remaining <= 0) return

    set({ loading: true })
    try {
      const res = await itemService.getCards({
        page,
        pageSize: CARD_PAGE_SIZE,
        categories,
      })

      // 期间用户切了品类或重新加载过，这份响应已经过期
      if (get().epoch !== epoch) return

      set({
        cards: [...get().cards, ...res.cards],
        page: page + 1,
        // 额度耗尽时无论还有没有下一页都不再翻了
        hasMore: res.hasMore && (res.quota?.remaining ?? 1) > 0,
        quota: res.quota ?? get().quota,
      })
    } catch {
      // 拉取失败保持现状，下次滑动会再试
    } finally {
      // 只清理自己那一代的 loading；过期请求不能去动新一代的状态
      if (get().epoch === epoch) set({ loading: false })
    }
  },

  async setCategories(categories) {
    set({ categories })
    await get().init()
  },

  async commitSwipe(direction) {
    const card = get().cards[0]
    if (!card) return

    // 飞出动画已经播完，这里可以放心把卡片摘掉
    set({ cards: get().cards.slice(1) })

    if (get().cards.length <= PREFETCH_THRESHOLD) {
      void get().loadMore()
    }

    // 卡片先推掉了（动画已经播完），但滑动还没落库。
    // 这一步失败必须把卡片放回去 —— 否则用户以为滑过了，
    // 而服务端根本没记录，那张卡会「莫名其妙又出现」，更糟。
    let res: SwipeResult
    try {
      res = await swipeService.swipe({
        toItemId: card._id,
        toUserId: card.ownerId,
        direction,
      })
    } catch {
      set({ cards: [card, ...get().cards] })
      void Taro.showToast({ title: '网络不太好，再试一次', icon: 'none' })
      return
    }

    if (res.quota) set({ quota: res.quota })

    // swipe 只回 matchId，弹窗要展示双方物品，所以再取一次完整记录
    if (res.matched && res.matchId) {
      const match = await matchService.getMatch(res.matchId)
      if (match) set({ matchResult: match })
    }

    // 最后一滴额度用完了，把牌堆清空，让首页直接进入引导态
    if ((res.quota?.remaining ?? 1) <= 0) {
      set({ cards: [], page: 1, hasMore: false })
    }
  },

  clearMatch() {
    set({ matchResult: null })
  },
}))
