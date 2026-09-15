import { View } from '@tarojs/components'
import type { Ref } from 'react'

import type { CardItem, SwipeDirection } from '@/types'

import SwipeCard, { type SwipeCardHandle } from '../SwipeCard'

import './index.scss'

interface Props {
  cards: CardItem[]
  topRef: Ref<SwipeCardHandle>
  cardWidth: number
  onDecide: (direction: SwipeDirection) => void
  onDetail: () => void
}

/** 最多同时渲染三张，够撑起「牌堆」的层次感，又不浪费渲染 */
const MAX_VISIBLE = 3

export default function CardStack({ cards, topRef, cardWidth, onDecide, onDetail }: Props) {
  const visible = cards.slice(0, MAX_VISIBLE)

  return (
    <View className='card-stack'>
      {visible.map((card, depth) => (
        <View
          key={card._id}
          className='card-stack__slot'
          // 最上面那张不能带 transform：祖先节点的 transform 会让
          // 微信 movable-view 触摸坐标错位
          style={
            depth === 0
              ? { zIndex: 30 }
              : {
                  zIndex: 30 - depth * 10,
                  opacity: depth === 2 ? 0.55 : 1,
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.045})`,
                }
          }
        >
          <SwipeCard
            ref={depth === 0 ? topRef : undefined}
            card={card}
            active={depth === 0}
            cardWidth={cardWidth}
            onDecide={onDecide}
            onDetail={onDetail}
          />
        </View>
      ))}
    </View>
  )
}
