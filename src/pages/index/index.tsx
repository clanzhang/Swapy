import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import { Close, FaceMild, Heart } from '@/components/Icon'
import CardStack from '@/components/CardStack'
import CategoryFilter from '@/components/CategoryFilter'
import ItemDetailSheet from '@/components/ItemDetailSheet'
import MatchModal from '@/components/MatchModal'
import { QuotaBadge, QuotaLimit } from '@/components/Quota'
import type { SwipeCardHandle } from '@/components/SwipeCard'
import { MAX_DISTANCE_KM, THEME } from '@/constants'
import { useDeckStore } from '@/store/deckStore'
import { useUserStore } from '@/store/userStore'
import type { CardItem, SwipeDirection } from '@/types'

import './index.scss'

/** 卡片左右各留 16px 边距，和 index.scss 里的 .deck-body padding 保持一致 */
const PAGE_PADDING = 16

export default function Index() {
  const cards = useDeckStore((s) => s.cards)
  const loading = useDeckStore((s) => s.loading)
  const hasMore = useDeckStore((s) => s.hasMore)
  const categories = useDeckStore((s) => s.categories)
  const matchResult = useDeckStore((s) => s.matchResult)
  const quota = useDeckStore((s) => s.quota)
  const init = useDeckStore((s) => s.init)
  const setCategories = useDeckStore((s) => s.setCategories)
  const commitSwipe = useDeckStore((s) => s.commitSwipe)
  const clearMatch = useDeckStore((s) => s.clearMatch)

  const ready = useUserStore((s) => s.ready)
  const user = useUserStore((s) => s.user)

  const topRef = useRef<SwipeCardHandle>(null)
  const [detailCard, setDetailCard] = useState<CardItem | null>(null)
  const [cardWidth] = useState(() => {
    // getSystemInfoSync 已废弃（会在控制台报警告），用 getWindowInfo
    const info = Taro.getWindowInfo()
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

  const outOfQuota = (quota?.remaining ?? 1) <= 0

  return (
    <View className='page deck'>
      <View className='deck-head'>
        <View className='deck-head__left'>
          <Text className='deck-head__title'>附近好物</Text>
          <Text className='deck-head__meta'>
            {user?.city || '上海'} · {MAX_DISTANCE_KM}km 内
          </Text>
        </View>
        <QuotaBadge quota={quota} />
      </View>

      <CategoryFilter value={categories} onChange={(v) => void setCategories(v)} />

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
            onDecide={(d) => void commitSwipe(d)}
            onDetail={() => setDetailCard(cards[0] ?? null)}
          />
        )}
      </View>

      {outOfQuota ? (
        <View className='deck-actions-spacer' />
      ) : (
        <View className='deck-actions'>
          <View className='deck-btn deck-btn--nope' onClick={() => handleTrigger('left')}>
            <Close size={24} color='#999999' />
          </View>
          <View className='deck-btn deck-btn--like' onClick={() => handleTrigger('right')}>
            <Heart size={24} color={THEME.primary} />
          </View>
        </View>
      )}

      <ItemDetailSheet
        card={detailCard}
        onClose={() => setDetailCard(null)}
        onDecide={handleTrigger}
      />

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
