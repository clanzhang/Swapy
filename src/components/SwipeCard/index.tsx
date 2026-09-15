import { Image, Text, View } from '@tarojs/components'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { CATEGORY_MAP, CONDITION_MAP, PRICE_RANGE_MAP } from '@/constants'
import type { CardItem, SwipeDirection } from '@/types'
import { fromNow } from '@/utils'
import { formatDistance } from '@/utils/geo'

import ItemImagePager from '../ItemImagePager'

import {
  FLING_STALE_MS,
  decideOutcome,
  dragRotation,
  flyRotation,
  flyScale,
  sampleVelocity,
  stampOpacity,
} from './gesture'

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

/** 归位弹簧动画时长，要和 scss 里的 transition 对上 */
const RETURN_MS = 360
/** 飞出动画时长，要和 scss 里的 transition 对上 */
const FLY_MS = 300

type Phase = 'idle' | 'drag' | 'return' | 'fly'

interface TouchPoint {
  clientX: number
  clientY: number
}

/**
 * 可拖拽的物品卡片。
 *
 * 拖拽没有用 movable-view，而是自己接管 touch 事件：
 * movable-view 的可移动范围 = 区域尺寸 − 视图尺寸，卡片和区域等大时范围是 0，
 * 于是整段拖拽全程都算「越界」，阻尼贯穿始终，永远做不到 1:1 跟手。
 * 这里把手指位移直接映射成 transform，跟手是数学上的 1:1，不依赖任何组件物理。
 */
export default forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { card, active, cardWidth, onDecide, onDetail },
  ref,
) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [phase, setPhase] = useState<Phase>('idle')
  const [flying, setFlying] = useState<SwipeDirection | null>(null)

  const posRef = useRef({ x: 0, y: 0 })
  /** 飞出动画进行中，屏蔽一切输入 */
  const lockRef = useRef(false)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  })
  /** 上一次采样，用来算甩动速度 */
  const lastSampleRef = useRef({ x: 0, y: 0, t: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
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
    timers.current.push(setTimeout(fn, ms))
  }

  const apply = (x: number, y: number) => {
    posRef.current = { x, y }
    setPos({ x, y })
  }

  const flyOut = useCallback(
    (direction: SwipeDirection) => {
      if (lockRef.current) return
      lockRef.current = true
      dragRef.current.active = false
      setFlying(direction)
      setPhase('fly')

      // 目标点直接用屏幕宽度算，保证一定离开可视区域
      const targetX =
        (direction === 'right' ? 1 : -1) * (cardWidth + 320)
      apply(targetX, posRef.current.y + 70)
      later(() => onDecideRef.current(direction), FLY_MS)
    },
    [cardWidth],
  )

  useImperativeHandle(ref, () => ({ trigger: flyOut }), [flyOut])

  const reset = useCallback(() => {
    setPhase('return')
    apply(0, 0)
    later(() => setPhase('idle'), RETURN_MS)
  }, [])

  const handleTouchStart = (e: any) => {
    if (lockRef.current) return
    const touch: TouchPoint | undefined = e.touches?.[0]
    if (!touch) return
    dragRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      baseX: posRef.current.x,
      baseY: posRef.current.y,
    }
    const now = e.timeStamp || Date.now()
    lastSampleRef.current = { x: posRef.current.x, y: posRef.current.y, t: now }
    velocityRef.current = { x: 0, y: 0 }
    // 交给手指控制，必须先关掉 transition，否则会拖出延迟感
    setPhase('drag')
  }

  const handleTouchMove = (e: any) => {
    const drag = dragRef.current
    if (!drag.active || lockRef.current) return
    const touch: TouchPoint | undefined = e.touches?.[0]
    if (!touch) return

    const x = drag.baseX + (touch.clientX - drag.startX)
    const y = drag.baseY + (touch.clientY - drag.startY)

    // 位移没变化就不要 setData，touchmove 的重复事件比想象中多
    const prev = posRef.current
    if (Math.abs(x - prev.x) < 0.5 && Math.abs(y - prev.y) < 0.5) return

    const now = e.timeStamp || Date.now()
    velocityRef.current = sampleVelocity(lastSampleRef.current, { x, y, t: now })
    lastSampleRef.current = { x, y, t: now }
    apply(x, y)
  }

  const handleTouchEnd = (e: any) => {
    const drag = dragRef.current
    if (!drag.active || lockRef.current) return
    drag.active = false

    const { x, y } = posRef.current

    // 拖着不动再松手时，上一次采样已经很久远了，速度不该作数
    const now = e.timeStamp || Date.now()
    const fresh = now - lastSampleRef.current.t < FLING_STALE_MS
    const velocity = fresh ? velocityRef.current : { x: 0, y: 0 }

    const outcome = decideOutcome(
      { x, y, velocityX: velocity.x, velocityY: velocity.y },
      cardWidth,
    )

    if (outcome === 'detail') {
      reset()
      later(() => onDetailRef.current(), 60)
      return
    }
    if (outcome === 'reset') {
      reset()
      return
    }
    flyOut(outcome)
  }

  const handleTouchCancel = () => {
    if (!dragRef.current.active || lockRef.current) return
    dragRef.current.active = false
    reset()
  }

  const body = <CardBody card={card} showHint={active && !flying} />

  if (!active) {
    return <View className='swipe-card swipe-card--static'>{body}</View>
  }

  const rotate = flying ? flyRotation(flying) : dragRotation(pos.x, cardWidth)
  // 右滑想要：放大 + 发光，飞出去的那一刻给足正反馈
  const scale = flying ? flyScale(flying) : 1

  const { like: likeOpacity, nope: nopeOpacity, up: upOpacity } = stampOpacity(
    pos.x,
    pos.y,
    cardWidth,
  )

  return (
    <View
      className='swipe-card__area'
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <View
        className={`swipe-card__mover swipe-card__mover--${phase}`}
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        }}
      >
        <View className={`swipe-card ${flying === 'right' ? 'swipe-card--glow' : ''}`}>
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
      </View>
    </View>
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
