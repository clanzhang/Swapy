import { ScrollView, Text, View } from '@tarojs/components'

import CategoryIcon from '../CategoryIcon'
import { THEME } from '@/constants'
import { CATEGORY_MAP, CONDITION_MAP, PRICE_RANGE_MAP } from '@/constants'
import type { CardItem, SwipeDirection } from '@/types'
import { fromNow } from '@/utils'
import { formatDistance } from '@/utils/geo'

import ItemImagePager from '../ItemImagePager'

import './index.scss'

interface Props {
  card: CardItem | null
  onClose: () => void
  onDecide: (direction: SwipeDirection) => void
}

/** 上滑唤起的半屏详情面板 */
export default function ItemDetailSheet({ card, onClose, onDecide }: Props) {
  if (!card) return null

  const category = CATEGORY_MAP[card.category]
  const condition = CONDITION_MAP[card.condition]
  const range = PRICE_RANGE_MAP[card.priceRange]

  return (
    <View className='sheet'>
      <View className='sheet__mask' onClick={onClose} />

      <View className='sheet__panel'>
        <View className='sheet__handle' onClick={onClose}>
          <View className='sheet__handle-bar' />
        </View>

        <View className='sheet__media'>
          <ItemImagePager
            images={card.images}
            emoji={category?.emoji ?? '📦'}
            className='sheet__pager'
          />
        </View>

        <ScrollView className='sheet__body' scrollY>
        {/* scroll-view 在 webview 模式下不支持 padding，只能靠内层容器 */}
        <View className='sheet__inner'>
            <Text className='sheet__title'>{card.title}</Text>

            <View className='sheet__tags'>
              <View className='tag'>
                <CategoryIcon category={card.category} size={12} color={THEME.primary} />
                <Text className='tag__text'>{category?.label}</Text>
              </View>
              <View className='tag tag-plain'>
                <Text>{condition?.label}</Text>
              </View>
              <View className='tag tag-plain'>
                <Text>估值 ¥{range?.label}</Text>
              </View>
              <View className='tag tag-plain'>
                <Text>{formatDistance(card.distanceKm)}</Text>
              </View>
            </View>

            <View className='sheet__section'>
              <Text className='sheet__section-title'>物品描述</Text>
              <Text className='sheet__desc'>
                {card.description || '对方没有留下描述，可以匹配后在聊天里问。'}
              </Text>
            </View>

            <View className='sheet__section'>
              <Text className='sheet__section-title'>发布者</Text>
              <View className='sheet__owner'>
                <View className='sheet__avatar'>
                  <Text>{card.owner.nickname.slice(0, 1)}</Text>
                </View>
                <View className='sheet__owner-main'>
                  <Text className='sheet__owner-name'>{card.owner.nickname}</Text>
                  <Text className='sheet__owner-meta'>
                    {card.owner.city} · 发布于 {fromNow(card.createdAt)}
                  </Text>
                </View>
              </View>
            </View>

            <View className='sheet__safe-area' />
        </View>
      </ScrollView>

        <View className='sheet__actions'>
          <View
            className='sheet__btn sheet__btn--nope'
            onClick={() => {
              onClose()
              onDecide('left')
            }}
          >
            <Text>跳过</Text>
          </View>
          <View
            className='sheet__btn sheet__btn--like'
            onClick={() => {
              onClose()
              onDecide('right')
            }}
          >
            <Text>想要</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
