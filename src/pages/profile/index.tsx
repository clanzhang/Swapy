import { Button, Input } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'

import CategoryIcon from '@/components/CategoryIcon'
import { ArrowDown, Heart, List, Setting, User } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP, PRICE_RANGE_MAP, THEME } from '@/constants'
import { USE_MOCK } from '@/config'
import { itemService, swipeService } from '@/services'
import { resetMockData } from '@/services/mock'
import { useDeckStore } from '@/store/deckStore'
import { useUserStore } from '@/store/userStore'
import type { CardItem, Item, ItemStatus } from '@/types'
import { formatDistance } from '@/utils/geo'

import './index.scss'

const STATUS_LABEL: Record<ItemStatus, string> = {
  active: '在架',
  swapped: '已换出',
  off: '已下架',
}

const CITIES = ['上海', '北京', '广州', '深圳', '杭州', '成都', '苏州', '武汉', '南京', '西安']

/** 展开中的功能区，null 表示都收起 */
type Section = 'items' | 'wanted' | 'settings' | null

export default function Profile() {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)

  const [section, setSection] = useState<Section>('items')
  const [items, setItems] = useState<Item[]>([])
  const [wanted, setWanted] = useState<CardItem[]>([])
  const [nickname, setNickname] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

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

  useDidShow(() => {
    void load()
  })

  useEffect(() => {
    // 正在编辑时不要被 store 的更新覆盖掉用户输入
    if (!user || section === 'settings') return
    setNickname(user.nickname)
    setCity(user.city)
  }, [user, section])

  const toggle = (next: Section) => setSection((cur) => (cur === next ? null : next))

  const save = async () => {
    if (!nickname.trim()) {
      void Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await updateProfile({ nickname: nickname.trim(), city })
      setSection(null)
      void Taro.showToast({ title: '已保存', icon: 'success' })
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item: Item) => {
    if (item.status === 'swapped') return
    const next: ItemStatus = item.status === 'off' ? 'active' : 'off'
    await itemService.updateItemStatus(item._id, next)
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status: next } : i)))
    void Taro.showToast({ title: next === 'active' ? '已重新上架' : '已下架', icon: 'none' })
  }

  const handleReset = () => {
    void Taro.showModal({
      title: '重置演示数据',
      content: '会清空本地的滑动记录、匹配和聊天，恢复到初始种子数据。',
      confirmText: '重置',
      confirmColor: '#3C5434',
      success: (res) => {
        if (!res.confirm || !resetMockData()) return
        void load()
        void useDeckStore.getState().init()
        void Taro.showToast({ title: '已重置', icon: 'success' })
      },
    })
  }

  const activeCount = items.filter((i) => i.status === 'active').length

  return (
    <View className='page profile'>
      <ScrollView className='profile__body' scrollY>
        <View className='profile__inner'>
          {/* ---------------------------------------------------- 用户信息 */}
          <View className='profile__head'>
            <View className='profile__avatar'>
              {user?.avatarUrl ? (
                <ItemImage src={user.avatarUrl} emoji='🙂' className='profile__avatar-img' />
              ) : (
                <User size={26} color={THEME.sage} />
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
          <View className='entries'>
            <View className='entry' onClick={() => toggle('items')}>
              <List size={16} color={THEME.sage} />
              <Text className='entry__label'>我的发布</Text>
              <Text className='entry__count num'>{items.length}</Text>
              <ArrowDown
                size={14}
                color={THEME.textSub}
                className={`entry__arrow ${section === 'items' ? 'entry__arrow--open' : ''}`}
              />
            </View>

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

            <View className='entry' onClick={() => toggle('wanted')}>
              <Heart size={16} color={THEME.sage} />
              <Text className='entry__label'>我的想要</Text>
              <Text className='entry__count num'>{wanted.length}</Text>
              <ArrowDown
                size={14}
                color={THEME.textSub}
                className={`entry__arrow ${section === 'wanted' ? 'entry__arrow--open' : ''}`}
              />
            </View>

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

            <View className='entry' onClick={() => toggle('settings')}>
              <Setting size={16} color={THEME.sage} />
              <Text className='entry__label'>设置</Text>
              <Text className='entry__count' />
              <ArrowDown
                size={14}
                color={THEME.textSub}
                className={`entry__arrow ${section === 'settings' ? 'entry__arrow--open' : ''}`}
              />
            </View>

            {section === 'settings' && (
              <View className='entry__panel'>
                <Text className='profile__editor-label'>昵称</Text>
                <Input
                  className='profile__editor-input'
                  value={nickname}
                  maxLength={12}
                  placeholder='给自己起个名字'
                  onChange={(v) => setNickname(v)}
                />

                <Text className='profile__editor-label'>城市</Text>
                <Text className='profile__editor-hint'>选了城市只推荐同城的物品</Text>
                <View className='profile__cities'>
                  {CITIES.map((c) => (
                    <View
                      key={c}
                      className={`profile__city ${city === c ? 'profile__city--on' : ''}`}
                      onClick={() => setCity(city === c ? '' : c)}
                    >
                      <Text>{c}</Text>
                    </View>
                  ))}
                </View>

                <Button
                  type='primary'
                  block
                  shape='round'
                  loading={saving}
                  onClick={() => void save()}
                >
                  保存
                </Button>

                {USE_MOCK && (
                  <View className='profile__reset' onClick={handleReset}>
                    <Text>重置演示数据</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View className='profile__safe-area' />
        </View>
      </ScrollView>
    </View>
  )
}
