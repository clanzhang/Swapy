import { Button, Input } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'

import CategoryIcon from '@/components/CategoryIcon'
import { Heart, List, Setting, User } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP, CONDITION_MAP, PRICE_RANGE_MAP, THEME } from '@/constants'
import { api } from '@/services'
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

export default function Profile() {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)

  const [tab, setTab] = useState<'items' | 'wanted'>('items')
  const [items, setItems] = useState<Item[]>([])
  const [wanted, setWanted] = useState<CardItem[]>([])
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [mine, likes] = await Promise.all([api.getMyItems(), api.getWantedItems()])
    setItems(mine)
    setWanted(likes)
  }

  useDidShow(() => {
    void load()
  })

  useEffect(() => {
    // 正在编辑时不要被 store 的更新覆盖掉用户输入
    if (!user || editing) return
    setNickname(user.nickname)
    setCity(user.city)
  }, [user, editing])

  const save = async () => {
    if (!nickname.trim()) {
      void Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await updateProfile({ nickname: nickname.trim(), city })
      setEditing(false)
      void Taro.showToast({ title: '已保存', icon: 'success' })
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item: Item) => {
    if (item.status === 'swapped') return
    const next: ItemStatus = item.status === 'off' ? 'active' : 'off'
    await api.updateItemStatus(item._id, next)
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, status: next } : i)))
    void Taro.showToast({ title: next === 'active' ? '已重新上架' : '已下架', icon: 'none' })
  }

  const activeCount = items.filter((i) => i.status === 'active').length

  return (
    <View className='page profile'>
      <ScrollView className='profile__body' scrollY>
        {/* scroll-view 在 webview 模式下不支持 padding，只能靠内层容器 */}
        <View className='profile__inner'>
          <View className='profile__card'>
            <View className='profile__head'>
              <View className='profile__avatar'>
                <User size={26} color='#FFFFFF' />
              </View>
              <View className='profile__who'>
                <Text className='profile__name'>{user?.nickname || '未登录'}</Text>
                <Text className='profile__meta'>
                  {user?.city || '上海'} · 在架 {activeCount} 件
                </Text>
              </View>
              <View className='profile__edit' onClick={() => setEditing((v) => !v)}>
                <Setting size={13} color='#FFFFFF' />
                <Text className='profile__edit-text'>{editing ? '收起' : '编辑资料'}</Text>
              </View>
            </View>

            {editing && (
              <View className='profile__editor'>
                <Text className='profile__editor-label'>昵称</Text>
                <Input
                  className='profile__editor-input'
                  value={nickname}
                  maxLength={12}
                  placeholder='给自己起个名字'
                  onChange={(v) => setNickname(v)}
                />

                <Text className='profile__editor-label'>城市</Text>
                <View className='profile__cities'>
                  {CITIES.map((c) => (
                    <View
                      key={c}
                      className={`profile__city ${city === c ? 'profile__city--on' : ''}`}
                      onClick={() => setCity(c)}
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
              </View>
            )}
          </View>

          <View className='profile__tabs'>
            <View
              className={`profile__tab ${tab === 'items' ? 'profile__tab--on' : ''}`}
              onClick={() => setTab('items')}
            >
              <List size={14} color={tab === 'items' ? THEME.primaryDeep : THEME.textSub} />
              <Text className='profile__tab-text'>我的发布 {items.length}</Text>
            </View>
            <View
              className={`profile__tab ${tab === 'wanted' ? 'profile__tab--on' : ''}`}
              onClick={() => setTab('wanted')}
            >
              <Heart size={14} color={tab === 'wanted' ? THEME.primaryDeep : THEME.textSub} />
              <Text className='profile__tab-text'>我的想要 {wanted.length}</Text>
            </View>
          </View>

          {tab === 'items' ? (
            items.length ? (
              items.map((item) => {
                const category = CATEGORY_MAP[item.category]
                return (
                  <View key={item._id} className='row-card'>
                    <View className='row-card__thumb'>
                      <ItemImage src={item.images[0]} emoji={category?.emoji ?? '📦'} />
                    </View>
                    <View className='row-card__main'>
                      <Text className='row-card__title ellipsis'>{item.title}</Text>
                      <View className='row-card__tags'>
                        <View className='tag'>
                          <CategoryIcon category={item.category} size={11} color={THEME.primary} />
                          <Text className='tag__text'>{category?.label}</Text>
                        </View>
                        <View className='tag tag-plain'>
                          <Text>{CONDITION_MAP[item.condition]?.label}</Text>
                        </View>
                        <View className='tag tag-plain'>
                          <Text>¥{PRICE_RANGE_MAP[item.priceRange]?.label}</Text>
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
                )
              })
            ) : (
              <View className='profile__empty'>
                <Text className='profile__empty-emoji'>📦</Text>
                <Text className='profile__empty-text'>还没有发布过物品</Text>
              </View>
            )
          ) : wanted.length ? (
            wanted.map((card) => {
              const category = CATEGORY_MAP[card.category]
              return (
                <View key={card._id} className='row-card'>
                  <View className='row-card__thumb'>
                    <ItemImage src={card.images[0]} emoji={category?.emoji ?? '📦'} />
                  </View>
                  <View className='row-card__main'>
                    <Text className='row-card__title ellipsis'>{card.title}</Text>
                    <View className='row-card__tags'>
                      <View className='tag'>
                        <CategoryIcon category={card.category} size={11} color={THEME.primary} />
                        <Text className='tag__text'>{category?.label}</Text>
                      </View>
                      <View className='tag tag-plain'>
                        <Text>{formatDistance(card.distanceKm)}</Text>
                      </View>
                    </View>
                  </View>
                  <View className='row-card__side'>
                    <Text className='row-card__status row-card__status--liked'>已想要</Text>
                  </View>
                </View>
              )
            })
          ) : (
            <View className='profile__empty'>
              <Text className='profile__empty-emoji'>💛</Text>
              <Text className='profile__empty-text'>还没有想要过别人的物品</Text>
            </View>
          )}

          <View className='profile__safe-area' />
        </View>
      </ScrollView>
    </View>
  )
}
