/**
 * 每日刷卡配额的领域逻辑。口径是「滑过的卡片数」，左滑右滑都消耗。
 *
 * 这份文件在 swipe / getCards 两个函数目录下各有一份副本 —— 云函数各自独立
 * 打包，没法直接共享代码。改动时两个目录要一起改。
 * 客户端的 src/utils/quota.ts 是同一套算法的参考实现，也要对齐。
 *
 * dayKey 固定按北京时间算，不依赖云函数所在时区（云函数跑在 UTC，
 * 而用户在 UTC+8，两边各算各的一定会在刷新点打架）。
 */

/** 每日可滑的卡片数 */
const DAILY_QUOTA = 30

/** 每天几点刷新（0-23）。这里取中午 12 点。 */
const QUOTA_RESET_HOUR = 12

const BEIJING_OFFSET_MS = 8 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

function shift(ts, resetHour) {
  return ts + BEIJING_OFFSET_MS - resetHour * 3600 * 1000
}

/** 当前属于哪个配额日。以 12:00 为界，`[今天12:00, 明天12:00)` 同一 key。 */
function quotaDayKey(now, resetHour = QUOTA_RESET_HOUR) {
  return new Date(shift(now, resetHour)).toISOString().slice(0, 10)
}

/** 下一次额度刷新的时间戳 */
function nextResetAt(now, resetHour = QUOTA_RESET_HOUR) {
  const shifted = shift(now, resetHour)
  const next = Math.floor(shifted / DAY_MS) * DAY_MS + DAY_MS
  return next - BEIJING_OFFSET_MS + resetHour * 3600 * 1000
}

/** 客户端可见的配额状态 */
function buildQuota(used, now = Date.now()) {
  const value = Math.max(0, used || 0)
  return {
    limit: DAILY_QUOTA,
    used: value,
    remaining: Math.max(0, DAILY_QUOTA - value),
    resetAt: nextResetAt(now),
  }
}

/** 取出用户文档里当前配额日的记录，跨天了就归零 */
function currentUsed(userDoc, now) {
  const dayKey = quotaDayKey(now)
  const stored = userDoc && userDoc.quota
  if (stored && stored.dayKey === dayKey) return { dayKey, used: stored.used || 0 }
  return { dayKey, used: 0 }
}

module.exports = {
  DAILY_QUOTA,
  QUOTA_RESET_HOUR,
  quotaDayKey,
  nextResetAt,
  buildQuota,
  currentUsed,
}
