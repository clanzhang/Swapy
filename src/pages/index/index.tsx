import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Close, FaceMild, Filter, Heart } from '@/components/Icon'
import CardStack from '@/components/CardStack'
import FilterSheet from '@/components/FilterSheet'
import ItemDetailSheet from '@/components/ItemDetailSheet'
import MatchModal from '@/components/MatchModal'
import ProfileGuide from '@/components/ProfileGuide'
import { QuotaBadge, QuotaLimit } from '@/components/Quota'
import type { SwipeCardHandle } from '@/components/SwipeCard'
import { THEME } from '@/constants'
import { useDeckStore } from '@/store/deckStore'
import { useUserStore } from '@/store/userStore'
import type { CardItem, Category, SwipeDirection } from '@/types'
import { sameCategories } from '@/utils/filter'

import './index.scss'

/** 卡片左右各留 16px 边距，和 index.scss 里的 .deck-body padding 保持一致 */
const PAGE_PADDING = 16

export default function Index() {
  const cards = useDeckStore((s) => s.cards)
  const loading = useDeckStore((s) => s.loading)
  const hasMore = useDeckStore((s) => s.hasMore)
  const matchResult = useDeckStore((s) => s.matchResult)
  const quota = useDeckStore((s) => s.quota)
  const categories = useDeckStore((s) => s.categories)
  const init = useDeckStore((s) => s.init)
  const commitSwipe = useDeckStore((s) => s.commitSwipe)
  const clearMatch = useDeckStore((s) => s.clearMatch)
  const setCategories = useDeckStore((s) => s.setCategories)

  const ready = useUserStore((s) => s.ready)
  const user = useUserStore((s) => s.user)
  const needsProfile = useUserStore((s) => s.needsProfile)

  const topRef = useRef<SwipeCardHandle>(null)
  const [detailCard, setDetailCard] = useState<CardItem | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  /**
   * 筛选草稿由这里持有，弹层是受控的。
   * 每次打开都从当前生效的筛选重新种一次，取消关闭不会留下残留。
   */
  const [filterDraft, setFilterDraft] = useState<Category[]>([])
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

  return (
    <View className='page deck'>
      <View className='deck-head'>
        <View className='deck-head__left'>
          <Text className='deck-head__title'>附近好物</Text>
          <Text className='deck-head__meta'>
            {user?.city ? `${user.city} · 同城` : '全部城市'}
          </Text>
        </View>
        <View className='deck-head__right'>
          {/*
            筛选入口。选中品类时按钮变实心并显示数量 ——
            筛完如果牌堆空了，用户得有个地方看见「现在筛的是什么」并清掉，
            否则只能对着空状态猜。
          */}
          <View
            className={`deck-filter ${categories.length ? 'deck-filter--on' : ''}`}
            onClick={() => {
              setFilterDraft(categories)
              setFilterOpen(true)
            }}
          >
            <Filter size={16} color={categories.length ? THEME.bg : THEME.primary} />
            <Text className='deck-filter__text'>
              {categories.length ? `筛选 ${categories.length}` : '筛选'}
            </Text>
          </View>
          <QuotaBadge quota={quota} />
        </View>
      </View>

      <View className='deck-body'>
        {outOfQuota ? (
          <QuotaLimit
            resetAt={quota!.resetAt}
            onPublish={() => void Taro.switchTab({ url: '/pages/publish/index' })}
          />
        ) : !cards.length ? (
          // 加载中也要有东西，否则卡片区是一片空白，看起来像坏了
          loading ? (
            <View className='deck-loading'>
              <View className='deck-loading__spinner' />
              <Text className='deck-loading__text'>正在找附近的闲置…</Text>
            </View>
          ) : (
            <View className='empty'>
              <FaceMild size={32} color='#C8C8CE' />
              <Text className='empty-title empty-title--spaced'>
                {hasMore ? '这一批滑完啦' : '附近的物品都看过了'}
              </Text>
              <Text className='empty-desc'>
                {hasMore
                  ? '换个品类筛选，或者稍后再来看看'
                  : '发布一件自己的闲置，让更多人滑到你'}
              </Text>
              <View className='deck-empty-btn' onClick={() => void init()}>
                <Text>重新加载</Text>
              </View>
            </View>
          )
        ) : (
          <CardStack
            cards={cards}
            topRef={topRef}
            cardWidth={cardWidth}
            onDecide={handleDecide}
            onDetail={handleDetail}
          />
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

      <FilterSheet
        visible={filterOpen}
        value={categories}
        onClose={() => setFilterOpen(false)}
        onChange={setFilterDraft}
        onConfirm={() => {
          setFilterOpen(false)
          // 和当前一致就别重拉牌堆了，白让人等一次加载
          if (sameCategories(filterDraft, categories)) return
          void setCategories(filterDraft)
        }}
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
