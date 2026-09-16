/**
 * 聊天记录的时间显示规则。
 *
 * 抽出来是为了能验证：规则本身是「和上一条间隔超过 5 分钟才显示」，
 * 写错的话会变成每行都顶着时间戳（很吵），或者完全不显示。
 */

export const TIME_GAP_MS = 5 * 60_000

interface TimedMessage {
  createdAt: number
}

/**
 * 这条消息前面是否要单独显示时间。
 * 第一条总是要显示 —— 否则用户不知道会话是从什么时候开始的。
 */
export function shouldShowTime(current: TimedMessage, prev?: TimedMessage): boolean {
  if (!prev) return true
  return current.createdAt - prev.createdAt > TIME_GAP_MS
}
