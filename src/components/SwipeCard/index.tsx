import { Image, MovableArea, MovableView, Text, View } from '@tarojs/components'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { CATEGORY_MAP, CONDITION_MAP, PRICE_RANGE_MAP } from '@/constants'
import type { CardItem, SwipeDirection } from '@/types'
import { fromNow } from '@/utils'
import { formatDistance } from '@/utils/geo'

import ItemImagePager from '../ItemImagePager'

import './index.scss'

export interface SwipeCardHandle {
  /** 供底部按钮调用，等价于用户手动滑出去 */
  trigger: (direction: SwipeDirection) => void
}

interface Props {
  card: CardItem
  /** 只有牌堆最上面的卡片可拖动 */
  active: boolean
  cardWidth: number
  onDecide: (direction: SwipeDirection) => void
  onDetail: () => void
}

/** 触发「想要/跳过」的横向位移阈值（占卡片宽度比例） */
const SWIPE_RATIO = 0.26
/** 触发「查看详情」的纵向位移阈值 */
const DETAIL_THRESHOLD = 76
/** 飞出 / 归位动画时长，要和 scss 里的观感对齐 */
const ANIM_MS = 320

interface MoveEvent {
  detail: { x: number; y: number; source?: string }
}

export default forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { card, active, cardWidth, onDecide, onDetail },
  ref,
) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [anim, setAnim] = useState(false)
  const [flying, setFlying] = useState<SwipeDirection | null>(null)

  // 拖拽期间位置要同步读，用 ref 避免闭包拿到旧 state
  const posRef = useRef({ x: 0, y: 0 })
  /** 程序化动画进行中：屏蔽 onChange，否则动画会被自己的回写打断 */
  const lockRef = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const onDecideRef = useRef(onDecide)
  onDecideRef.current = onDecide
  const onDetailRef = useRef(onDetail)
  onDetailRef.current = onDetail

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    },
    [],
  )

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }

  const flyOut = useCallback(
    (direction: SwipeDirection) => {
      if (lockRef.current) return
      lockRef.current = true
      setFlying(direction)
      setAnim(true)
      const targetX = (direction === 'right' ? 1 : -1) * cardWidth * 1.9
      const targetY = posRef.current.y + 70
      posRef.current = { x: targetX, y: targetY }
      setPos({ x: targetX, y: targetY })
      later(() => onDecideRef.current(direction), ANIM_MS)
    },
    [cardWidth],
  )

  useImperativeHandle(ref, () => ({ trigger: flyOut }), [flyOut])

  const reset = useCallback(() => {
    posRef.current = { x: 0, y: 0 }
    setAnim(true)
    setPos({ x: 0, y: 0 })
    later(() => setAnim(false), ANIM_MS + 60)
  }, [])

  const handleChange = (e: MoveEvent) => {
    if (lockRef.current) return
    const { x, y, source } = e.detail
    // source 为空表示位置变化来自属性回写而非手指，忽略掉
    if (source && source !== 'touch') return
    posRef.current = { x, y }
    setPos({ x, y })
  }

  const handleTouchStart = () => {
    // 上一轮归位动画还没跑完就再次拖动，立刻交还控制权
    if (!lockRef.current) setAnim(false)
  }

  const handleTouchEnd = () => {
    if (lockRef.current) return
    const { x, y } = posRef.current
    const thX = cardWidth * SWIPE_RATIO

    if (Math.abs(x) > thX && Math.abs(x) >= Math.abs(y)) {
      flyOut(x > 0 ? 'right' : 'left')
      return
    }
    if (y < -DETAIL_THRESHOLD && Math.abs(y) > Math.abs(x)) {
      reset()
      later(() => onDetailRef.current(), 40)
      return
    }
    reset()
  }

  const body = <CardBody card={card} showHint={active && !flying} />

  if (!active) {
    return (
      <View className='swipe-card swipe-card--static'>
        {body}
      </View>
    )
  }

  // 横向位移映射成旋转角：最多 ±13°，和位移一起构成「物理感」
  const ratio = Math.max(-1, Math.min(1, pos.x / (cardWidth * 0.55)))
  const rotate = ratio * 13
  const likeOpacity = Math.max(0, Math.min(1, pos.x / (cardWidth * SWIPE_RATIO)))
  const nopeOpacity = Math.max(0, Math.min(1, -pos.x / (cardWidth * SWIPE_RATIO)))
  const upOpacity = Math.max(0, Math.min(1, -pos.y / DETAIL_THRESHOLD))

  return (
    <MovableArea
      className='swipe-card__area'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <MovableView
        className='swipe-card__mover'
        direction='all'
        // 卡片和可移动区域等大，只有允许越界才能拖得动；
        // 越界后的自动回弹被「受控 x/y 同步」抵消掉了，落点不会跳。
        outOfBounds
        damping={30}
        friction={2}
        inertia={false}
        animation={anim}
        x={pos.x}
        y={pos.y}
        onChange={handleChange}
      >
        <View className='swipe-card' style={{ transform: `rotate(${rotate}deg)` }}>
          {body}
          <View
            className='swipe-card__stamp swipe-card__stamp--like'
            style={{ opacity: likeOpacity }}
          >
            <Text>想要</Text>
          </View>
          <View
            className='swipe-card__stamp swipe-card__stamp--nope'
            style={{ opacity: nopeOpacity }}
          >
            <Text>跳过</Text>
          </View>
          <View
            className='swipe-card__stamp swipe-card__stamp--up'
            style={{ opacity: upOpacity }}
          >
            <Text>详情</Text>
          </View>
        </View>
      </MovableView>
    </MovableArea>
  )
})

function CardBody({ card, showHint }: { card: CardItem; showHint: boolean }) {
  const category = CATEGORY_MAP[card.category]
  const condition = CONDITION_MAP[card.condition]
  const range = PRICE_RANGE_MAP[card.priceRange]

  return (
    <View className='swipe-card__inner'>
      <View className='swipe-card__media'>
        <ItemImagePager images={card.images} emoji={category?.emoji ?? '📦'} />
      </View>

      <View className='swipe-card__info'>
        <Text className='swipe-card__title ellipsis'>{card.title}</Text>

        <View className='swipe-card__tags'>
          <View className='tag'>
            <Text>
              {category?.emoji} {category?.label}
            </Text>
          </View>
          <View className='tag tag-plain'>
            <Text>{condition?.label}</Text>
          </View>
          <View className='tag tag-plain'>
            <Text>估值 ¥{range?.label}</Text>
          </View>
        </View>

        {!!card.description && (
          <Text className='swipe-card__desc ellipsis-2'>{card.description}</Text>
        )}

        <View className='swipe-card__owner'>
          <View className='swipe-card__avatar'>
            {card.owner.avatarUrl ? (
              <Image className='swipe-card__avatar-img' src={card.owner.avatarUrl} mode='aspectFill' />
            ) : (
              <Text className='swipe-card__avatar-text'>
                {card.owner.nickname.slice(0, 1)}
              </Text>
            )}
          </View>
          <Text className='swipe-card__name ellipsis'>{card.owner.nickname}</Text>
          <Text className='swipe-card__meta'>
            {formatDistance(card.distanceKm)} · {fromNow(card.createdAt)}
          </Text>
        </View>
      </View>

      {showHint && (
        <View className='swipe-card__hint'>
          <Text>↑ 上滑看详情</Text>
        </View>
      )}
    </View>
  )
}
