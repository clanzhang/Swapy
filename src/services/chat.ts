import type {
  ChatMessage,
  GetChatHistoryParams,
  GetChatHistoryResult,
  SendMessageParams,
  SendMessageResult,
} from '@/types'

import { api } from './index'

/**
 * 聊天相关。
 * 对应云函数：sendMessage、getChatHistory
 *
 * 消息存在独立的 messages 集合里（不嵌在 matches 文档中），
 * 所以能按 matchId 分页查询，也能被 watch 订阅。
 */
export const chatService = {
  sendMessage: (params: SendMessageParams): Promise<SendMessageResult> => api.sendMessage(params),

  /** 翻页取历史：page=1 是最近 50 条，返回时已翻转为时间正序 */
  getChatHistory: (params: GetChatHistoryParams): Promise<GetChatHistoryResult> =>
    api.getChatHistory(params),

  /** 订阅该会话的新消息，返回取消订阅函数 */
  subscribe: (matchId: string, handler: (msg: ChatMessage) => void) =>
    api.subscribe(matchId, handler),
}
