let seq = 0

/** 生成客户端临时 ID（Mock 用；线上由云数据库生成 _id） */
export function uid(prefix = 'id'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

/** 相对时间：刚刚 / 5分钟前 / 3小时前 / 2天前 / 日期 */
export function fromNow(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 聊天时间戳：今天只显示时分 */
export function clockTime(ts: number): string {
  const d = new Date(ts)
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mm = `${d.getMinutes()}`.padStart(2, '0')
  return `${hh}:${mm}`
}

/** 把字符串稳定映射成一个 0-359 的色相，用于占位图配色 */
export function hashHue(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 360
  }
  return h
}
