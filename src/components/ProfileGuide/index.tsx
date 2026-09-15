import { Button, Input } from '@nutui/nutui-react-taro'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import { THEME } from '@/constants'
import { useEnter } from '@/hooks/useEnter'
import { itemService } from '@/services'
import { useUserStore } from '@/store/userStore'
import { defaultNickname } from '@/utils/profile'

import './index.scss'

/** 城市是可选的，不填就按「全部城市」推荐 */
const CITIES = ['上海', '北京', '广州', '深圳', '杭州', '成都', '苏州', '武汉', '南京', '西安']

interface Props {
  visible: boolean
  onClose: () => void
}

/**
 * 完善资料引导。
 *
 * 触发时机：用户**第一次右滑「想要」**时，如果昵称还是默认值或没有头像。
 * 规格要求不能强制 —— 登录后直接弹窗打断是很劝退的，所以：
 * - 只在右滑时出现（用户已经在产生价值行为了）
 * - 可以「以后再说」，不填也能继续用
 * - 同一会话里只出现一次，不再骚扰
 */
export default function ProfileGuide({ visible, onClose }: Props) {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)

  const [nickname, setNickname] = useState('')
  const [city, setCity] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [localAvatar, setLocalAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const entered = useEnter(visible)

  // 每次打开都用当前资料回填，避免上次没保存的残留
  useEffect(() => {
    if (!visible || !user) return
    setNickname(user.nickname)
    setCity(user.city)
    setAvatarUrl(user.avatarUrl)
    setLocalAvatar('')
  }, [visible, user])

  if (!visible) return null

  const chooseAvatar = async (e: any) => {
    const path = e?.detail?.avatarUrl
    if (!path) return
    setLocalAvatar(path)
  }

  const save = async () => {
    const name = nickname.trim()
    if (!name) {
      void Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      // 头像拿到的是本地临时路径，要传上去才能被别人看到
      const uploaded = localAvatar ? (await itemService.uploadImages([localAvatar]))[0] : avatarUrl

      await updateProfile({ nickname: name, city, avatarUrl: uploaded })
      void Taro.showToast({ title: '已保存', icon: 'success' })
      onClose()
    } catch {
      void Taro.showToast({ title: '保存失败，稍后再试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const shownAvatar = localAvatar || avatarUrl
  const isDefaultName = nickname === (user ? defaultNickname(user._openid) : '')

  return (
    <View className='guide'>
      <View className={`guide__mask ${entered ? 'guide__mask--in' : ''}`} onClick={onClose} />

      <View className={`guide__panel ${entered ? 'guide__panel--in' : ''}`}>
        <Text className='guide__title'>让别人认得你</Text>
        <Text className='guide__desc'>
          匹配成功后对方会看到你的昵称和头像，完善一下更容易聊起来。
        </Text>

        <View className='guide__avatar-row'>
          <Button
            className='guide__avatar-btn'
            openType='chooseAvatar'
            onChooseAvatar={chooseAvatar}
          >
            <View className='guide__avatar'>
              {shownAvatar ? (
                <Image className='guide__avatar-img' src={shownAvatar} mode='aspectFill' />
              ) : (
                <Text className='guide__avatar-text'>
                  {(nickname || '换').slice(0, 1)}
                </Text>
              )}
            </View>
          </Button>
          <View className='guide__avatar-hint'>
            <Text className='guide__avatar-hint-title'>点击换头像</Text>
            <Text className='guide__avatar-hint-sub'>用微信头像也可以</Text>
          </View>
        </View>

        <View className='guide__field'>
          <Text className='guide__label'>昵称</Text>
          <Input
            className='guide__input'
            value={nickname}
            maxLength={12}
            placeholder='给自己起个名字'
            onChange={(v) => setNickname(v)}
          />
          {isDefaultName && (
            <Text className='guide__tip'>现在还是系统生成的默认昵称</Text>
          )}
        </View>

        <View className='guide__field'>
          <Text className='guide__label'>城市</Text>
          <Text className='guide__tip'>选了城市只推荐同城的物品，更容易当面交换</Text>
          <View className='guide__cities'>
            {CITIES.map((c) => (
              <View
                key={c}
                className={`guide__city ${city === c ? 'guide__city--on' : ''}`}
                onClick={() => setCity(city === c ? '' : c)}
              >
                <Text>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='guide__actions'>
          <Button
            type='primary'
            block
            size='large'
            shape='round'
            loading={saving}
            onClick={() => void save()}
          >
            保存
          </Button>
          <View className='guide__skip' onClick={onClose}>
            <Text style={{ color: THEME.textSub }}>以后再说</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
