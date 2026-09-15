import type { User } from '@/types'

/**
 * 昵称相关的约定。
 *
 * 默认昵称由云函数在创建账号时生成，客户端要能识别出「还是默认值」，
 * 好在用户第一次右滑时引导完善资料。两边的规则必须一致 ——
 * 云函数那份在 cloudfunctions/login/index.js 里，改一处要一起改。
 */

export const DEFAULT_NICKNAME_PREFIX = '换换用户'

/** 默认昵称：前缀 + openid 后四位 */
export function defaultNickname(openid: string): string {
  return `${DEFAULT_NICKNAME_PREFIX}${(openid || '').slice(-4)}`
}

/** 昵称是不是系统生成的默认值 */
export function isDefaultNickname(nickname: string): boolean {
  if (!nickname) return true
  return new RegExp(`^${DEFAULT_NICKNAME_PREFIX}.{0,4}$`).test(nickname)
}

/**
 * 是否需要引导完善资料。
 *
 * 规格要求：**不强制**填昵称头像，延迟到第一次右滑时再引导。
 * 所以这里返回 true 只代表「值得问一下」，弹窗必须可以跳过。
 */
export function needsProfileSetup(user: User | null): boolean {
  if (!user) return false
  return isDefaultNickname(user.nickname) || !user.avatarUrl
}
