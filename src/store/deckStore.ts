import { create } from 'zustand'

import { CARD_PAGE_SIZE } from '@/constants'
import { api } from '@/services'
import type { CardItem, Category, MatchView, SwipeDirection } from '@/types'

/** 剩余不足这个数就提前拉下一批，让「滑到底」这件事用户感知不到 */
const PREFETCH_THRESHOLD = 3

interface DeckState {
  cards: CardItem[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  /** 品类筛选，空数组 = 不限 */
  categories: Category[]
  /** 非空时首页弹出匹配成功动画 */
  matchResult: MatchView | null

  init(): Promise<void>
  loadMore(): Promise<void>
  setCategories(categories: Category[]): Promise<void>
  /** 卡片飞出动画播完后调用，推进牌堆 */
  commitSwipe(direction: SwipeDirection): Promise<void>
  clearMatch(): void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  cards: [],
  cursor: null,
  hasMore: true,
  loading: false,
  categories: [],
  matchResult: null,

  async init() {
    set({ cards: [], cursor: null, hasMore: true, loading: false })
    await get().loadMore()
  },

  async loadMore() {
    const { loading, hasMore, cursor, categories } = get()
    if (loading || !hasMore) return
    set({ loading: true })
    try {
      const page = await api.getCards({
        cursor,
        limit: CARD_PAGE_SIZE,
        categories,
      })
      set({
        cards: [...get().cards, ...page.list],
        cursor: page.nextCursor,
        hasMore: page.nextCursor !== null,
      })
    } finally {
      set({ loading: false })
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

    const res = await api.swipe(card._id, direction)
    if (res.matched && res.match) {
      set({ matchResult: res.match })
    }
  },

  clearMatch() {
    set({ matchResult: null })
  },
}))
