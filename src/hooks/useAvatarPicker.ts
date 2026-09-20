import Taro from '@tarojs/taro'
import { useCallback, useRef } from 'react'

import { userService } from '@/services'
import { useUserStore } from '@/store/userStore'

/**
 * 换头像。
 *
 * 「我的」页和「设置」页都能点头像更换，「选图 → 上传云存储 → 写资料」
 * 这三步必须完全一致：漏掉上传就会把微信的本地临时路径写进 users 表，
 * 表现成「只有自己看得到头像，别人看到的是空白」。
 * 所以抽成一个 hook，两边共用。
 */
export function useAvatarPicker(): () => Promise<void> {
  const updateProfile = useUserStore((s) => s.updateProfile)
  // 上传期间挡住重复点击：连点两下会传两张，后一张把前一张覆盖掉
  const busyRef = useRef(false)

  // 上锁 / 解锁各自封成同步函数 —— 直接在 await 之后写 busyRef.current
  // 会被 ESLint 的 require-atomic-updates 拦下（本项目 max-warnings 0）
  const lock = useCallback(() => {
    if (busyRef.current) return false
    busyRef.current = true
    return true
  }, [])
  const unlock = useCallback(() => {
    busyRef.current = false
  }, [])

  return useCallback(async () => {
    if (busyRef.current) return

    let localPath = ''
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      localPath = res.tempFilePaths?.[0] ?? ''
    } catch {
      // 用户取消，什么都不做
      return
    }
    if (!localPath) return
    if (!lock()) return

    void Taro.showLoading({ title: '上传中', mask: true })
    try {
      const url = await userService.uploadAvatar(localPath)
      await updateProfile({ avatarUrl: url })
      Taro.hideLoading()
      void Taro.showToast({ title: '头像已更新', icon: 'success' })
    } catch {
      Taro.hideLoading()
      void Taro.showToast({ title: '头像更新失败，稍后再试', icon: 'none' })
    } finally {
      unlock()
    }
  }, [lock, unlock, updateProfile])
}
