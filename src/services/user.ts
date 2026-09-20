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

  /**
   * 上传头像，返回可直接渲染的地址。
   * 头像本质上和物品图片走同一条云存储链路，但归属上是用户资料，
   * 所以放在这里而不是让页面去调 itemService.uploadImages。
   */
  uploadAvatar: (filePath: string) => api.uploadImage(filePath),
}
