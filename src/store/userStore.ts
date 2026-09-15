import { create } from 'zustand'

import { api } from '@/services'
import type { ProfilePatch, User } from '@/types'
import { needsProfileSetup } from '@/utils/profile'

interface UserState {
  user: User | null
  /**
   * 本次登录是否新建了账号。
   * 只用于埋点和引导判断，**不要拿它弹窗打断用户** —— 规格明确要求静默处理。
   */
  isNew: boolean
  /** 登录是否完成，页面用它决定要不要显示骨架屏 */
  ready: boolean

  setUser(user: User, isNew?: boolean): void
  /** 整个小程序生命周期只登录一次，重复调用是空操作 */
  init(): Promise<void>
  updateProfile(patch: ProfilePatch): Promise<void>
  /** 昵称还是默认值、或没有头像 —— 值得引导一下，但不强制 */
  needsProfile(): boolean
}

export const useUserStore = create<UserState>((set, get) => ({
  user: api.getCachedUser(),
  isNew: false,
  ready: false,

  setUser(user, isNew = false) {
    set({ user, isNew })
  },

  async init() {
    if (get().ready) return
    // 先用缓存渲染，网络回来再覆盖，避免白屏
    const cached = api.getCachedUser()
    if (cached) set({ user: cached })
    const { user, isNew } = await api.login()
    set({ user, isNew, ready: true })
  },

  async updateProfile(patch) {
    const user = await api.updateProfile(patch)
    set({ user })
  },

  needsProfile() {
    return needsProfileSetup(get().user)
  },
}))
