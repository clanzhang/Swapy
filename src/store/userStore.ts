import { create } from 'zustand'

import { api } from '@/services'
import type { ProfilePatch, User } from '@/types'

interface UserState {
  user: User | null
  /** 登录是否完成，页面用它决定要不要显示骨架屏 */
  ready: boolean
  init(): Promise<void>
  updateProfile(patch: ProfilePatch): Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  user: api.getCachedUser(),
  ready: false,

  async init() {
    if (get().ready) return
    // 先用缓存渲染，网络回来再覆盖，避免白屏
    const cached = api.getCachedUser()
    if (cached) set({ user: cached })
    // login 现在返回 { user, isNew }，新用户不需要额外处理
    const { user } = await api.login()
    set({ user, ready: true })
  },

  async updateProfile(patch) {
    const user = await api.updateProfile(patch)
    set({ user })
  },
}))
