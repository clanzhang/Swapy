import type {
  Category,
  GetCardsParams,
  GetCardsResult,
  Item,
  ItemStatus,
  PublishItemInput,
  PublishItemResult,
} from '@/types'

import { api } from './index'

/**
 * 物品相关。
 * 对应云函数：getCards、publishItem ＋ 云存储上传
 */
export const itemService = {
  /** 首页匹配池。筛选逻辑全在服务端，前端不做过滤 */
  getCards: (params?: GetCardsParams) => api.getCards(params),

  /**
   * 发布。图片先传云存储拿 fileID，再把 fileID 交给 publishItem。
   * 云函数侧会做枚举白名单和内容校验，失败时返回 { success:false, error }。
   */
  publishItem: (input: PublishItemInput): Promise<PublishItemResult> => api.publishItem(input),

  /** 批量上传，返回 fileID 列表（保持顺序） */
  uploadImages: async (filePaths: string[]): Promise<string[]> => {
    const ids: string[] = []
    for (const path of filePaths) {
      ids.push(await api.uploadImage(path))
    }
    return ids
  },

  // ---------------------------------------------------------- 规格外的能力

  /** 我发布的物品 */
  getMyItems: (): Promise<Item[]> => api.getMyItems(),

  /** 上架 / 下架 */
  updateItemStatus: (itemId: string, status: ItemStatus) => api.updateItemStatus(itemId, status),
}

export type { Category, GetCardsResult }
