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
const PREFETCH_REMAINING = 5

/**
 * 连续多少次「空页」就不再往下翻了。
 *
 * 服务端偶尔会回一页空卡却还说 hasMore=true（分页下标漂移、或其他数据
 * 查询的限制）。不设上限的话，首页会一遍遍地拉下一页 —— 用户看到的是
 * 一直转圈，接口被白白打满。
 */
const MAX_EMPTY_PAGES = 3

interface DeckState {
  cards: CardItem[]
  /** 下一页页码（从 1 开始） */
  page: number
  hasMore: boolean
  loading: boolean
  /** 上一次续拉失败了，页面据此显示可重试的失败态而不是一直转圈 */
  loadFailed: boolean
  /** 连续空页数，到 MAX_EMPTY_PAGES 就停止翻页 */
  emptyPages: number
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
  loadFailed: false,
  emptyPages: 0,
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
      loadFailed: false,
      emptyPages: 0,
      epoch: get().epoch + 1,
    })
    await get().loadMore()
  },

  async loadMore() {
    const { loading, hasMore, page, categories, epoch, emptyPages } = get()
    if (loading || !hasMore) return
    // 额度用完就别再拉卡了，服务端也不会给
    if (get().quota && get().quota!.remaining <= 0) return

    // loadFailed 在这里清掉：手动点「重新加载」时，页面上的失败态要立刻变成加载态
    set({ loading: true, loadFailed: false })
    try {
      const res = await itemService.getCards({
        page,
        pageSize: CARD_PAGE_SIZE,
        categories,
      })

      // 期间用户切了品类或重新加载过，这份响应已经过期
      if (get().epoch !== epoch) return

      // 空页但服务端说还有：有卡片的那一页才算真的拉到了东西
      const streak = res.cards.length ? 0 : emptyPages + 1

      set({
        cards: [...get().cards, ...res.cards],
        page: page + 1,
        emptyPages: streak,
        // 额度耗尽、或连续空页太多时都不再往下翻了
        hasMore: res.hasMore && (res.quota?.remaining ?? 1) > 0 && streak < MAX_EMPTY_PAGES,
        quota: res.quota ?? get().quota,
      })
    } catch {
      // 拉取失败保持现状（牌堆没动），但要记下失败，
      // 否则牌堆刚好空了的话，页面会一直显示加载中
      if (get().epoch === epoch) set({ loadFailed: true })
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

    // 剩余不足 5 张就悄悄拉下一批：新卡追加到末尾，不打断当前这张
    if (get().cards.length < PREFETCH_REMAINING) {
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

    // swipe 只回 matchId，弹窗要展示双方物品，所以再取一次完整记录。
    // 这一步失败不能影响滑动本身已经成功的事实 —— 匹配记录已经建了，
    // 用户去「匹配」页也能看到，只是少了这次弹窗。
    if (res.matched && res.matchId) {
      try {
        const match = await matchService.getMatch(res.matchId)
        if (match) set({ matchResult: match })
      } catch {
        void Taro.showToast({ title: '匹配成功，去「匹配」页看看', icon: 'none' })
      }
    }

    // 最后一滴额度用完了，把牌堆清空，让首页直接进入引导态
    if ((res.quota?.remaining ?? 1) <= 0) {
      set({ cards: [], page: 1, hasMore: false, loadFailed: false })
    }
  },

  clearMatch() {
    set({ matchResult: null })
  },
}))
