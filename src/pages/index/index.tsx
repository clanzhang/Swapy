import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Close, FaceMild, Heart } from '@/components/Icon'
import CardStack from '@/components/CardStack'
import ItemDetailSheet from '@/components/ItemDetailSheet'
import MatchModal from '@/components/MatchModal'
import ProfileGuide from '@/components/ProfileGuide'
import { QuotaBadge, QuotaLimit } from '@/components/Quota'
import type { SwipeCardHandle } from '@/components/SwipeCard'
import { THEME } from '@/constants'
import { useDeckStore } from '@/store/deckStore'
import { useUserStore } from '@/store/userStore'
import type { CardItem, SwipeDirection } from '@/types'
import { deckView } from '@/utils/deck'

import './index.scss'

/** 卡片左右各留 16px 边距，和 index.scss 里的 .deck-body padding 保持一致 */
const PAGE_PADDING = 16

export default function Index() {
  const cards = useDeckStore((s) => s.cards)
  const loading = useDeckStore((s) => s.loading)
  const hasMore = useDeckStore((s) => s.hasMore)
  const loadFailed = useDeckStore((s) => s.loadFailed)
  const matchResult = useDeckStore((s) => s.matchResult)
  const quota = useDeckStore((s) => s.quota)
  const init = useDeckStore((s) => s.init)
  const loadMore = useDeckStore((s) => s.loadMore)
  const commitSwipe = useDeckStore((s) => s.commitSwipe)
  const clearMatch = useDeckStore((s) => s.clearMatch)

  const ready = useUserStore((s) => s.ready)
  const user = useUserStore((s) => s.user)
  const needsProfile = useUserStore((s) => s.needsProfile)

  const topRef = useRef<SwipeCardHandle>(null)
  const [detailCard, setDetailCard] = useState<CardItem | null>(null)
  /** 完善资料引导：一个会话里只弹一次，不反复骚扰 */
  const [guideVisible, setGuideVisible] = useState(false)
  const guideShownRef = useRef(false)
  const guideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (guideTimerRef.current) clearTimeout(guideTimerRef.current)
    },
    [],
  )
  const [cardWidth] = useState(() => {
    // getWindowInfo 是基础库 2.20.1 才有的；老客户端要回退，
    // 否则会直接抛 not a function
    const { getWindowInfo } = Taro as unknown as {
      getWindowInfo?: () => { windowWidth?: number }
    }
    const info =
      typeof getWindowInfo === 'function' ? getWindowInfo() : Taro.getSystemInfoSync()
    return (info.windowWidth || 375) - PAGE_PADDING * 2
  })

  const bootedRef = useRef(false)
  useEffect(() => {
    if (!ready || bootedRef.current) return
    bootedRef.current = true
    void init()
  }, [ready, init])

  // 从发布页回来后，牌堆里应该能刷出自己刚发的物品，顺手重置一次
  useDidShow(() => {
    const { cards, quota: current } = useDeckStore.getState()
    // 额度用完时不要反复重试，否则会一直转
    if (bootedRef.current && !cards.length && (current?.remaining ?? 1) > 0) {
      void useDeckStore.getState().init()
    }
  })

  const handleTrigger = (direction: SwipeDirection) => {
    topRef.current?.trigger(direction)
  }

  /**
   * 卡片飞出动画播完后的落地处理。
   *
   * 完善资料的引导刻意放在这里，而不是登录后 —— 规格要求静默登录、
   * 不打断用户。等用户已经产生价值行为（第一次右滑「想要」）再问，
   * 接受度高得多，而且可以跳过。
   */
  const handleDecide = useCallback(
    async (direction: SwipeDirection) => {
      await commitSwipe(direction)

    if (
      direction === 'right' &&
      !guideShownRef.current &&
      // 同一时刻只弹一个：匹配成功了先看匹配
      !useDeckStore.getState().matchResult &&
      needsProfile()
    ) {
      guideShownRef.current = true
      // 等牌堆补位动画（300ms）跑完再弹，避免两个动画叠在一起掉帧
        guideTimerRef.current = setTimeout(() => setGuideVisible(true), 340)
      }
    },
    [commitSwipe, needsProfile],
  )

  /**
   * 上滑看详情。刻意从 store 里现取顶部的卡，而不是闭包里的 cards ——
   * 否则这个回调会随牌堆变化而变，SwipeCard 的 memo 就白加了。
   */
  const handleDetail = useCallback(() => {
    setDetailCard(useDeckStore.getState().cards[0] ?? null)
  }, [])

  const outOfQuota = (quota?.remaining ?? 1) <= 0

  /**
   * 该显示什么，交给纯函数判定（"空状态必须同时满足牌堆为空 + hasMore=false"）。
   * 判在这里而不是散在 JSX 里：以前「牌堆空了但还能续拉」会直接落到空状态，
   * 用户看到「附近的物品都看过了」就退出了。
   */
  const view = deckView({
    outOfQuota,
    cardCount: cards.length,
    hasMore,
    loadFailed,
  })

  /**
   * 兜底续拉。
   *
   * 正常路径由 commitSwipe 的预加载覆盖，但下面几种情况会漏：
   * - 一次拉回来的卡不够（或者全是已滑过的），滑完就直接空了
   * - 预加载失败过（loadFailed=true 时不再自动重试，交给用户点按）
   * 只在牌堆真的空、且还有下一页时触发，失败了也不会循环重试。
   */
  useEffect(() => {
    if (view === 'loading') void loadMore()
  }, [view, loadMore])

  return (
    <View className='page deck'>
      <View className='deck-head'>
        <View className='deck-head__left'>
          <Text className='deck-head__title'>附近好物</Text>
          <Text className='deck-head__meta'>
            {user?.city ? `${user.city} · 同城` : '全部城市'}
          </Text>
        </View>
        <QuotaBadge quota={quota} />
      </View>

      <View className='deck-body'>
        {view === 'quota' ? (
          <QuotaLimit
            resetAt={quota!.resetAt}
            onPublish={() => void Taro.switchTab({ url: '/pages/publish/index' })}
          />
        ) : view === 'empty' ? (
          <View className='empty'>
            <FaceMild size={32} color='#C8C8CE' />
            <Text className='empty-title empty-title--spaced'>附近的物品都看过了</Text>
            <Text className='empty-desc'>发布一件自己的闲置，让更多人滑到你</Text>
            <View className='deck-empty-btn' onClick={() => void init()}>
              <Text>重新加载</Text>
            </View>
          </View>
        ) : view === 'retrying' ? (
          <View className='empty'>
            <FaceMild size={32} color='#C8C8CE' />
            <Text className='empty-title empty-title--spaced'>没能拉到更多物品</Text>
            <Text className='empty-desc'>网络不太好，点一下重试</Text>
            <View className='deck-empty-btn' onClick={() => void loadMore()}>
              <Text>重新加载</Text>
            </View>
          </View>
        ) : view === 'loading' ? (
          // 首次进入、以及「牌堆空了但还有下一页」都走这里。
          // 绝不能让位给空状态 —— 那会让人以为没东西可滑了。
          <View className='deck-loading'>
            <View className='deck-loading__spinner' />
            <Text className='deck-loading__text'>正在找附近的闲置…</Text>
          </View>
        ) : (
          <CardStack
            cards={cards}
            topRef={topRef}
            cardWidth={cardWidth}
            onDecide={handleDecide}
            onDetail={handleDetail}
          />
        )}

        {/* 牌堆还有卡、只是在悄悄续拉：底部给一条小提示，不抢卡片的位置 */}
        {view === 'cards' && loading && (
          <View className='deck-more'>
            <View className='deck-more__spinner' />
            <Text className='deck-more__text'>正在加载更多…</Text>
          </View>
        )}
      </View>

      {/*
        详情面板打开时把底部按钮藏掉 —— 面板自己有跳过/想要，
        外面这两个圆钮留在下面只会和面板抢位置。
      */}
      {outOfQuota || detailCard ? (
        <View className='deck-actions-spacer' />
      ) : (
        <View className='deck-actions'>
          <View className='deck-btn deck-btn--nope' onClick={() => handleTrigger('left')}>
            <Close size={22} color={THEME.sage} />
          </View>
          <View className='deck-btn deck-btn--like' onClick={() => handleTrigger('right')}>
            <Heart size={22} color='#FEFDFC' />
          </View>
        </View>
      )}

      <ItemDetailSheet
        card={detailCard}
        onClose={() => setDetailCard(null)}
        onDecide={handleTrigger}
      />

      <ProfileGuide visible={guideVisible} onClose={() => setGuideVisible(false)} />

      <MatchModal
        match={matchResult}
        onClose={clearMatch}
        onChat={(matchId) => {
          clearMatch()
          void Taro.navigateTo({ url: `/pages/chat/index?matchId=${matchId}` })
        }}
      />
    </View>
  )
}
