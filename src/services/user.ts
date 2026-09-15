import type { ProfilePatch } from '@/types'

import { api } from './index'

/**
 * 用户相关。
 * 对应云函数：login
 */
export const userService = {
  /** 静默登录。首次会创建账号，返回 isNew=true */
  login: () => api.login(),

  /** 同步读本地缓存，用于首屏免闪 */
  getCachedUser: () => api.getCachedUser(),

  // 注意：这里必须用箭头包一层，不能写 `updateProfile: api.updateProfile`。
  // 这些模块和 index.ts 互相引用，直接引用属性会在模块初始化时踩 TDZ。
  updateProfile: (patch: ProfilePatch) => api.updateProfile(patch),
}
