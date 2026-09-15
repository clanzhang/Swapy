import { Text, View } from '@tarojs/components'
import { useMemo } from 'react'

import { HeartFill } from '@/components/Icon'
import { CATEGORY_MAP, THEME } from '@/constants'
import type { MatchItem } from '@/types'

import ItemImage from '../ItemImage'

import './index.scss'

interface Props {
  match: MatchItem | null
  onClose: () => void
  onChat: (matchId: string) => void
}

const CONFETTI_COLORS = ['#FF6B35', '#FFD166', '#06D6A0', '#4CC9F0', '#FF8FA3', '#FFF3E0']

export default function MatchModal({ match, onClose, onChat }: Props) {
  // 撒花粒子：位置/延迟/颜色都固定住，避免每次重渲染都在乱跳
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280
        const r = seed / 233280
        const r2 = ((i * 4523 + 1231) % 9973) / 9973
        return {
          id: i,
          left: Math.round(r * 100),
          delay: Math.round(r2 * 900),
          duration: 1600 + Math.round(r * 1400),
          size: 6 + Math.round(r2 * 7),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          tilt: Math.round(r * 360),
        }
      }),
    [],
  )

  if (!match) return null

  const myEmoji = CATEGORY_MAP[match.myItem.category]?.emoji ?? '📦'
  const peerEmoji = CATEGORY_MAP[match.otherItem.category]?.emoji ?? '📦'

  return (
    <View className='match-modal'>
      <View className='match-modal__mask' onClick={onClose} />

      <View className='match-modal__confetti'>
        {particles.map((p) => (
          <View
            key={p.id}
            className='match-modal__confetti-piece'
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 1.6}px`,
              background: p.color,
              transform: `rotate(${p.tilt}deg)`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
            }}
          />
        ))}
      </View>

      <View className='match-modal__content fade-up'>
        <Text className='match-modal__title'>匹配成功</Text>
        <Text className='match-modal__sub'>你们都想要对方的物品，聊聊怎么换吧</Text>

        <View className='match-modal__pair'>
          <View className='match-modal__slot'>
            <View className='match-modal__thumb'>
              <ItemImage src={match.myItem.images[0]} emoji={myEmoji} />
            </View>
            <Text className='match-modal__slot-label ellipsis'>我的 · {match.myItem.title}</Text>
          </View>

          <View className='match-modal__heart'>
            <HeartFill size={26} color={THEME.primary} />
          </View>

          <View className='match-modal__slot'>
            <View className='match-modal__thumb'>
              <ItemImage src={match.otherItem.images[0]} emoji={peerEmoji} />
            </View>
            <Text className='match-modal__slot-label ellipsis'>
              {match.otherUser.nickname} · {match.otherItem.title}
            </Text>
          </View>
        </View>

        <View className='match-modal__actions'>
          <View className='match-modal__btn match-modal__btn--primary' onClick={() => onChat(match.matchId)}>
            <Text>去聊天</Text>
          </View>
          <View className='match-modal__btn match-modal__btn--ghost' onClick={onClose}>
            <Text>继续滑</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
