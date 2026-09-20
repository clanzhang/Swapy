import { Avatar, Cell, CellGroup, Dialog, Input } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { ArrowRight, Camera } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { THEME } from '@/constants'
import { useAvatarPicker } from '@/hooks/useAvatarPicker'
import { useUserStore } from '@/store/userStore'

import './index.scss'

/**
 * 设置（个人资料）。
 *
 * 三条约定：
 * 1. **没有「保存」按钮** —— 昵称和城市都是改完立刻写服务端。
 *    统一保存的版本里，用户改完城市直接返回就白改了。
 * 2. 头像走「选图 → 云存储 → users.avatarUrl」，只存本地临时路径的话，
 *    别人看到的还是空白（见 useAvatarPicker）。
 * 3. 城市不在本页平铺，跳独立的城市选择页（搜索 + 热门）。
 */
export default function Settings() {
  const user = useUserStore((s) => s.user)
  const updateProfile = useUserStore((s) => s.updateProfile)
  const changeAvatar = useAvatarPicker()

  const [editingName, setEditingName] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const nickname = user?.nickname ?? ''
  const city = user?.city ?? ''
  const initial = (nickname || '换').slice(0, 1)

  const openNameEditor = () => {
    setDraft(nickname)
    setEditingName(true)
  }

  /**
   * 弹窗的确认。
   * NutUI 的约定：onConfirm 正常 resolve 就关弹窗，抛错则留在弹窗里——
   * 保存失败时就是要留在原地让用户重试，所以这里把错误再抛出去。
   */
  const saveNickname = async () => {
    const name = draft.trim()
    if (!name) return
    setSaving(true)
    try {
      await updateProfile({ nickname: name })
      void Taro.showToast({ title: '昵称已更新', icon: 'success' })
    } catch {
      void Taro.showToast({ title: '保存失败，稍后再试', icon: 'none' })
      throw new Error('save nickname failed')
    } finally {
      setSaving(false)
    }
  }

  const openCityPicker = () => {
    void Taro.navigateTo({ url: '/pages/city/index' })
  }

  return (
    <View className='page settings'>
      <ScrollView className='settings__body' scrollY>
        <View className='settings__inner'>
          {/* -------------------------------------------------------- 头像 */}
          <View className='settings__avatar-card'>
            <View className='settings__avatar' onClick={() => void changeAvatar()}>
              {user?.avatarUrl ? (
                <ItemImage src={user.avatarUrl} emoji='🙂' className='settings__avatar-img' />
              ) : (
                <Avatar size='60' background={THEME.primarySoft} color={THEME.primary}>
                  {initial}
                </Avatar>
              )}
            </View>
            <View className='settings__avatar-link' onClick={() => void changeAvatar()}>
              <Camera size={13} color={THEME.sage} />
              <Text>更换头像</Text>
            </View>
          </View>

          {/* -------------------------------------------------------- 资料 */}
          <CellGroup title='个人资料' divider>
            <Cell
              clickable
              title='昵称'
              description='匹配成功后对方看到的就是这个'
              extra={
                <View className='settings__value'>
                  <Text className='settings__value-text ellipsis'>{nickname || '未设置'}</Text>
                  <ArrowRight size={13} color={THEME.textWeak} />
                </View>
              }
              onClick={openNameEditor}
            />
            <Cell
              clickable
              title='城市'
              description='选了城市只推荐同城的物品'
              extra={
                <View className='settings__value'>
                  <Text className='settings__value-text ellipsis'>{city || '未设置'}</Text>
                  <ArrowRight size={13} color={THEME.textWeak} />
                </View>
              }
              onClick={openCityPicker}
            />
          </CellGroup>

          <Text className='settings__hint'>资料改动会立即保存，不需要点确认</Text>
          <View className='settings__safe-area' />
        </View>
      </ScrollView>

      <Dialog
        visible={editingName}
        title='修改昵称'
        confirmText='保存'
        cancelText='取消'
        disableConfirmButton={!draft.trim() || saving}
        onClose={() => setEditingName(false)}
        onConfirm={() => saveNickname()}
      >
        <Input
          className='settings__dialog-input'
          value={draft}
          maxLength={12}
          placeholder='给自己起个名字'
          onChange={(v) => setDraft(v)}
        />
      </Dialog>
    </View>
  )
}
