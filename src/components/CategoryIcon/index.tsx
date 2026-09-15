import { Book, Gift, Microphone, Photograph, Star } from '@/components/Icon'
import type { Category } from '@/types'

const MAP = {
  数码: Photograph,
  书籍: Book,
  潮玩: Gift,
  // NutUI 没有 Music 图标，用 Microphone 代替「乐器」
  乐器: Microphone,
  运动: Star,
} as const

interface Props {
  category: Category
  size?: number | string
  color?: string
}

/**
 * 品类图标。
 *
 * 和常量里的 emoji 是两个用途：
 * - emoji 只在 ItemImage 的占位图里用（图片加载失败时的视觉兜底）
 * - 图标用在标签、列表这些需要跟品牌色走的地方
 */
export default function CategoryIcon({ category, size = 13, color }: Props) {
  const Cmp = MAP[category] ?? Gift
  return <Cmp size={size} color={color} />
}
