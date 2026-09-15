import type { GetMatchesResult, MatchItem } from '@/types'

import { api } from './index'

/**
 * 匹配相关。
 * 对应云函数：getMatches
 *
 * 返回的 MatchItem 已经把 userA/userB 的对称结构翻译成「我」的视角，
 * 页面不需要知道自己是 A 还是 B。
 */
export const matchService = {
  getMatches: (): Promise<GetMatchesResult> => api.getMatches(),
  getMatch: (matchId: string): Promise<MatchItem | null> => api.getMatch(matchId),
}
