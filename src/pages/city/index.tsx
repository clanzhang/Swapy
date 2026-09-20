import { SearchBar } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'

import { ArrowRight, Check, Location } from '@/components/Icon'
import { LOCATION_ENABLED } from '@/config/location'
import { ALL_CITIES, HOT_CITIES, THEME } from '@/constants'
import { useLocateCity } from '@/hooks/useLocateCity'
import { useUserStore } from '@/store/userStore'
import { cityCenter, searchCities } from '@/utils/city'
import type { LatLng } from '@/utils/geo'

import './index.scss'

/**
 * 城市选择。
 *
 * 以前是在「设置」里平铺十来个标签：占屏、还选不到自己的城市。
 * 现在改成「定位 + 搜索 + 热门 + 全部」，并且：
 * - 选中即保存（即时写 users.city），不需要再点保存
 * - 定位是**主动点击**才触发，不在进页面时弹授权框（和静默登录的调性一致）；
 *   只有 LOCATION_ENABLED 为 true（已声明定位接口）时才渲染这个入口
 * - 「不限城市」始终可点 —— 城市本来就可选，得留一条退路
 * - 用 searchCities / nearestCity 纯函数匹配（pnpm verify:city）
 */
export default function CityPicker() {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)
  const { locate, locating } = useLocateCity()

  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  const current = user?.city ?? ''
  const results = useMemo(() => searchCities(keyword), [keyword])

  const backToSettings = () => {
    setTimeout(() => void Taro.navigateBack(), 400)
  }

  /**
   * 选中一个城市并保存。
   *
   * 顺带把城市中心点写进 location —— getCards 是拿 location 算距离的，
   * 不写的话手选了北京也还是拿默认的上海坐标算，卡片上会出现「1060km」。
   */
  const choose = async (city: string, point?: LatLng) => {
    if (saving) return
    if (city === current && !point) {
      void Taro.navigateBack()
      return
    }

    setSaving(true)
    try {
      const center = point ?? cityCenter(city)
      await updateProfile({ city, ...(center ? { location: center } : {}) })
      void Taro.showToast({ title: city ? `已切换到${city}` : '已切换为不限城市', icon: 'none' })
      backToSettings()
    } catch {
      setSaving(false)
      void Taro.showToast({ title: '保存失败，稍后再试', icon: 'none' })
    }
  }

  const locateNow = async () => {
    if (locating || saving) return
    // 定位成功后经纬度由 useLocateCity 一并写进资料
    const res = await locate()
    void Taro.showToast({ title: res.message, icon: 'none' })
    if (res.city) backToSettings()
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
              {/* 没声明定位接口时不渲染 —— 声明了但账号没权限，连预览/上传都会被拒 */}
              {LOCATION_ENABLED && (
                <View
                  className='city__row city__row--action'
                  onClick={() => void locateNow()}
                >
                  <Location size={16} color={THEME.primary} />
                  <View className='city__row-main'>
                    <Text className='city__row-title'>{locating ? '定位中…' : '使用当前定位'}</Text>
                    <Text className='city__row-desc'>
                      {locating ? '正在获取位置' : '自动匹配到最近的城市'}
                    </Text>
                  </View>
                  <ArrowRight size={14} color={THEME.textWeak} />
                </View>
              )}

              <View
                className={`city__row ${current ? '' : 'city__row--on'}`}
                onClick={() => void choose('')}
              >
                <Location size={16} color={current ? THEME.textSub : THEME.primary} />
                <View className='city__row-main'>
                  <Text className='city__row-title'>不限城市</Text>
                  <Text className='city__row-desc'>推荐所有城市的物品</Text>
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
