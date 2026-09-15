import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'

import type { QuotaState } from '@/types'
import { formatCountdown } from '@/utils/quota'

import './index.scss'

/** 首页顶部常驻的剩余额度徽标 */
export function QuotaBadge({ quota }: { quota: QuotaState | null }) {
  if (!quota) return null

  const low = quota.remaining <= 5
  const gone = quota.remaining <= 0

  return (
    <View className={`quota-badge ${gone ? 'quota-badge--gone' : ''} ${low ? 'quota-badge--low' : ''}`}>
      <Text className='quota-badge__num'>{quota.remaining}</Text>
      <Text className='quota-badge__label'>/{quota.limit} 张</Text>
    </View>
  )
}

interface LimitProps {
  resetAt: number
  onPublish: () => void
}

/** 额度用完后的引导页：倒计时 + 把限制转化成发布动机 */
export function QuotaLimit({ resetAt, onPublish }: LimitProps) {
  const [now, setNow] = useState(() => Date.now())

  // 只在这个页面挂载时才走秒，不常驻
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const left = Math.max(0, resetAt - now)

  return (
    <View className='quota-limit'>
      <Text className='quota-limit__emoji'>🌙</Text>
      <Text className='quota-limit__title'>今天的 30 张刷完了</Text>
      <Text className='quota-limit__desc'>
        每天 30 张，中午 12:00 刷新。已经匹配上的会话不受影响，随时可以接着聊。
      </Text>

      <View className='quota-limit__timer'>
        <Text className='quota-limit__timer-label'>距离刷新还有</Text>
        <Text className='quota-limit__timer-value'>{formatCountdown(left)}</Text>
      </View>

      <View className='quota-limit__cta' onClick={onPublish}>
        <Text>去发布一件闲置</Text>
      </View>
      <Text className='quota-limit__cta-hint'>让更多人滑到你，明天回来看结果</Text>
    </View>
  )
}
