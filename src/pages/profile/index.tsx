import { Avatar, Badge, Cell, CellGroup } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'

import CategoryIcon from '@/components/CategoryIcon'
import { ArrowRight, Heart, List, Setting } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP, PRICE_RANGE_MAP, THEME } from '@/constants'
import { useAvatarPicker } from '@/hooks/useAvatarPicker'
import { itemService, swipeService } from '@/services'
import { useUserStore } from '@/store/userStore'
import type { CardItem, Item, ItemStatus } from '@/types'
import { formatDistance } from '@/utils/geo'

import './index.scss'

const STATUS_LABEL: Record<ItemStatus, string> = {
  active: '在架',
  swapped: '已换出',
  off: '已下架',
}

/** 展开中的列表，null 表示都收起 */
type Section = 'items' | 'wanted' | null

/**
 * 行尾数字角标。
 *
 * Badge 默认把数字甩到锚点外的右上角（`translateX(100%)`），
 * 这里当「一行的末尾计数」用，所以在 scss 里把位移关掉、给个占位盒。
 */
function CountBadge({ value }: { value: number }) {
  return (
    <Badge className='entry__badge' value={value} max={99} color={THEME.primary} top={0} right={0}>
      <View className='entry__badge-box' />
    </Badge>
  )
}

/**
 * 「我的」。
 *
 * 只负责两件事：展示自己是谁 + 进入各个功能。
 * 资料编辑（昵称 / 头像 / 城市）全部搬到独立的「设置」页 ——
 * 以前把表单嵌在展开的列表项里，展开一片、收起一片，很容易点错。
 */
export default function Profile() {
  const user = useUserStore((s) => s.user)
  const changeAvatar = useAvatarPicker()

  const [section, setSection] = useState<Section>('items')
  const [items, setItems] = useState<Item[]>([])
  const [wanted, setWanted] = useState<CardItem[]>([])

  const load = async () => {
    try {
      const [mine, likes] = await Promise.all([
        itemService.getMyItems(),
        swipeService.getWantedItems(),
      ])
      setItems(mine)
      setWanted(likes)
    } catch {
      // 拉取失败保持现状，用户切回来会重试；不要弹错误打扰
    }
  }

  // 设置页改完资料、或者下架物品后回到这里，都要刷新
  useDidShow(() => {
    void load()
  })

  const toggle = (next: Section) => setSection((cur) => (cur === next ? null : next))

  const openSettings = () => {
    void Taro.navigateTo({ url: '/pages/settings/index' })
  }

  const toggleStatus = async (item: Item) => {
    if (item.status === 'swapped') return
    const next: ItemStatus = item.status === 'off' ? 'active' : 'off'
    await itemService.updateItemStatus(item._id, next)
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status: next } : i)))
    void Taro.showToast({ title: next === 'active' ? '已重新上架' : '已下架', icon: 'none' })
  }

  const activeCount = items.filter((i) => i.status === 'active').length
  const initial = (user?.nickname || '换').slice(0, 1)

  return (
    <View className='page profile'>
      <ScrollView className='profile__body' scrollY>
        <View className='profile__inner'>
          {/* ---------------------------------------------------- 用户信息 */}
          <View className='profile__card'>
            <View className='profile__avatar' onClick={() => void changeAvatar()}>
              {user?.avatarUrl ? (
                <ItemImage src={user.avatarUrl} emoji='🙂' className='profile__avatar-img' />
              ) : (
                <Avatar size='56' background={THEME.primarySoft} color={THEME.primary}>
                  {initial}
                </Avatar>
              )}
            </View>

            <View className='profile__who'>
              <Text className='profile__name ellipsis'>{user?.nickname || '未登录'}</Text>
              <Text className='profile__meta'>
                {user?.city ? user.city : '未设置城市'} · 在架 {activeCount} 件
              </Text>
            </View>
          </View>

          {/* ---------------------------------------------------- 功能入口 */}
          <CellGroup divider>
            <Cell
              clickable
              title={
                <View className='entry__main'>
                  <List size={16} color={THEME.sage} />
                  <Text className='entry__label'>我的发布</Text>
                </View>
              }
              extra={<CountBadge value={items.length} />}
              onClick={() => toggle('items')}
            />
            {section === 'items' && (
              <View className='entry__panel'>
                {items.length ? (
                  items.map((item) => (
                    <View key={item._id} className='row-card'>
                      <View className='row-card__thumb'>
                        <ItemImage
                          src={item.images[0]}
                          emoji={CATEGORY_MAP[item.category]?.emoji ?? '📦'}
                        />
                      </View>
                      <View className='row-card__main'>
                        <Text className='row-card__title ellipsis'>{item.title}</Text>
                        <View className='row-card__tags'>
                          <View className='tag'>
                            <CategoryIcon category={item.category} size={11} color={THEME.sageDeep} />
                            <Text className='tag__text'>{item.category}</Text>
                          </View>
                          <View className='tag tag-plain'>
                            <Text>{item.condition}</Text>
                          </View>
                          <View className='tag tag-plain'>
                            <Text className='num'>¥{PRICE_RANGE_MAP[item.priceRange]?.label}</Text>
                          </View>
                        </View>
                      </View>
                      <View className='row-card__side'>
                        <Text className={`row-card__status row-card__status--${item.status}`}>
                          {STATUS_LABEL[item.status]}
                        </Text>
                        {item.status !== 'swapped' && (
                          <View className='row-card__action' onClick={() => void toggleStatus(item)}>
                            <Text>{item.status === 'off' ? '重新上架' : '下架'}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View className='profile__empty'>
                    <Text className='profile__empty-text'>还没有发布过物品</Text>
                  </View>
                )}
              </View>
            )}

            <Cell
              clickable
              title={
                <View className='entry__main'>
                  <Heart size={16} color={THEME.sage} />
                  <Text className='entry__label'>我的想要</Text>
                </View>
              }
              extra={<CountBadge value={wanted.length} />}
              onClick={() => toggle('wanted')}
            />
            {section === 'wanted' && (
              <View className='entry__panel'>
                {wanted.length ? (
                  wanted.map((card) => (
                    <View key={card._id} className='row-card'>
                      <View className='row-card__thumb'>
                        <ItemImage
                          src={card.images[0]}
                          emoji={CATEGORY_MAP[card.category]?.emoji ?? '📦'}
                        />
                      </View>
                      <View className='row-card__main'>
                        <Text className='row-card__title ellipsis'>{card.title}</Text>
                        <View className='row-card__tags'>
                          <View className='tag'>
                            <CategoryIcon category={card.category} size={11} color={THEME.sageDeep} />
                            <Text className='tag__text'>{card.category}</Text>
                          </View>
                          <View className='tag tag-plain'>
                            <Text>{formatDistance(card.distanceKm, card.owner.city)}</Text>
                          </View>
                        </View>
                      </View>
                      <View className='row-card__side'>
                        <Text className='row-card__status row-card__status--liked'>已想要</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className='profile__empty'>
                    <Text className='profile__empty-text'>还没有想要过别人的物品</Text>
                  </View>
                )}
              </View>
            )}

            <Cell
              clickable
              title={
                <View className='entry__main'>
                  <Setting size={16} color={THEME.sage} />
                  <Text className='entry__label'>设置</Text>
                </View>
              }
              extra={<ArrowRight size={14} color={THEME.textWeak} />}
              onClick={openSettings}
            />
          </CellGroup>

          <View className='profile__safe-area' />
        </View>
      </ScrollView>
    </View>
  )
}
