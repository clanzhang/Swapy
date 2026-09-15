/**
 * 每日刷卡配额。
 *
 * 口径是「滑过的卡片数」：**左滑跳过和右滑想要都消耗额度**。
 * （另一种做法是只算「想要」，约会产品多用那种 —— 但本产品的额度就是
 * 每天能看多少张卡，所以跳过也算。）
 *
 * 关键约束：**dayKey 只由服务端计算**。
 * 云函数跑在 UTC，客户端跑在设备时区，如果两边各算各的，
 * 边界那天（12:00 前后）一定会打架，出现「刚刷新就没了」或者
 * 「明明用完了还能继续」。所以客户端只拿 `{ limit, used, remaining, resetAt }`
 * 显示，不参与判定 —— 这里的实现是给云函数和 Mock 共用的。
 */

/** 每日可滑的卡片数 */
export const DAILY_QUOTA = 30

/** 每天几点刷新（0-23）。这里取中午 12 点。 */
export const QUOTA_RESET_HOUR = 12

/** 北京时间相对 UTC 的偏移。固定写死，不依赖服务器时区。 */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000

const DAY_MS = 24 * 3600 * 1000

/**
 * 把时间平移到「以 resetHour 为 0 点、以北京时间为基准」的坐标系。
 * 这样切天就退化成普通的自然日切分。
 */
function shift(ts: number, resetHour: number): number {
  return ts + BEIJING_OFFSET_MS - resetHour * 3600 * 1000
}

/**
 * 当前属于哪个配额日。
 *
 * 以 12:00 为界：`[今天 12:00, 明天 12:00)` 是同一个 dayKey。
 * 返回 `YYYY-MM-DD` 形式，代表这个窗口的**起始日**。
 */
export function quotaDayKey(now: number, resetHour: number = QUOTA_RESET_HOUR): string {
  return new Date(shift(now, resetHour)).toISOString().slice(0, 10)
}

/** 下一次额度刷新的时间戳 */
export function nextResetAt(now: number, resetHour: number = QUOTA_RESET_HOUR): number {
  const shifted = shift(now, resetHour)
  const nextShifted = Math.floor(shifted / DAY_MS) * DAY_MS + DAY_MS
  return nextShifted - BEIJING_OFFSET_MS + resetHour * 3600 * 1000
}

/** 倒计时展示：`3 小时 12 分` / `12 分 30 秒` / `45 秒` */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`
  return `${seconds} 秒`
}
