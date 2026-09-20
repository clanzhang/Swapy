import { SearchBar } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { Check, Location } from '@/components/Icon'
import { ALL_CITIES, HOT_CITIES, THEME } from '@/constants'
import { useUserStore } from '@/store/userStore'
import { searchCities } from '@/utils/city'

import './index.scss'

/**
 * 城市选择。
 *
 * 以前是在「设置」里平铺十来个标签：占屏、还选不到自己的城市。
 * 现在改成「搜索 + 热门 + 全部」，并且：
 * - 选中即保存（即时写 users.city），不需要再点保存
 * - 「不限城市」始终可点 —— 城市本来就可选，得留一条退路
 * - 用 searchCities 纯函数匹配中文 / 全拼 / 首字母（pnpm verify:city）
 */
export default function CityPicker() {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)

  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  const current = user?.city ?? ''
  const results = useMemo(() => searchCities(keyword), [keyword])

  const choose = async (city: string) => {
    if (saving) return
    if (city === current) {
      void Taro.navigateBack()
      return
    }

    setSaving(true)
    try {
      await updateProfile({ city })
      // 保存成功后立刻返回设置页，那边从 store 读，已经是新城市了
      void Taro.showToast({ title: city ? `已切换到${city}` : '已切换为不限城市', icon: 'none' })
      setTimeout(() => void Taro.navigateBack(), 400)
    } catch {
      setSaving(false)
      void Taro.showToast({ title: '保存失败，稍后再试', icon: 'none' })
    }
  }

  const renderChips = (names: string[], className = '') => (
    <View className={`city__grid ${className}`}>
      {names.map((name) => (
        <View
          key={name}
          className={`city__chip ${current === name ? 'city__chip--on' : ''}`}
          onClick={() => void choose(name)}
        >
          <Text className='city__chip-text'>{name}</Text>
        </View>
      ))}
    </View>
  )

  return (
    <View className='page city'>
      <View className='city__search'>
        <SearchBar
          value={keyword}
          placeholder='搜索城市名或拼音'
          shape='round'
          onChange={(v) => setKeyword(v)}
          onClear={() => setKeyword('')}
        />
      </View>

      <ScrollView className='city__body' scrollY>
        <View className='city__inner'>
          {keyword.trim() ? (
            results.length ? (
              renderChips(results)
            ) : (
              <View className='city__empty'>
                <Text className='city__empty-text'>没有找到「{keyword.trim()}」</Text>
                <Text className='city__empty-desc'>试试「suzhou」这样的拼音</Text>
              </View>
            )
          ) : (
            <>
              <View
                className={`city__any ${current ? '' : 'city__any--on'}`}
                onClick={() => void choose('')}
              >
                <Location size={16} color={current ? THEME.textSub : THEME.primary} />
                <View className='city__any-main'>
                  <Text className='city__any-title'>不限城市</Text>
                  <Text className='city__any-desc'>推荐所有城市的物品</Text>
                </View>
                {!current && <Check size={16} color={THEME.primary} />}
              </View>

              <Text className='city__section'>热门城市</Text>
              {renderChips(HOT_CITIES, 'city__grid--hot')}

              <Text className='city__section'>全部城市</Text>
              {renderChips(ALL_CITIES.map((c) => c.name))}
            </>
          )}

          <View className='city__safe-area' />
        </View>
      </ScrollView>
    </View>
  )
}
