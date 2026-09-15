import type { CardItem, SwipeParams, SwipeResult } from '@/types'

import { api } from './index'

/**
 * 滑动相关。
 * 对应云函数：swipe
 *
 * 匹配判定完全在服务端，前端只负责传方向、接收 matched 结果。
 */
export const swipeService = {
  swipe: (params: SwipeParams): Promise<SwipeResult> => api.swipe(params),

  /** 我右滑过的物品（规格外，「我的想要」用） */
  getWantedItems: (): Promise<CardItem[]> => api.getWantedItems(),
}
