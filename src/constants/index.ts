import type { Category, Condition, PriceRange } from '@/types'

export const THEME = {
  primary: '#FF6B35',
  primarySoft: '#FFF3E0',
  text: '#1F1F1F',
  textSub: '#8A8A8E',
  border: '#F0F0F0',
  bg: '#F7F7F9',
  success: '#2FBF71',
  danger: '#FF4D4F',
}

export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'digital', label: '数码', emoji: '📱' },
  { key: 'book', label: '书籍', emoji: '📚' },
  { key: 'toy', label: '潮玩', emoji: '🧸' },
  { key: 'instrument', label: '乐器', emoji: '🎸' },
  { key: 'sport', label: '运动', emoji: '🏀' },
]

export const CONDITIONS: { key: Condition; label: string }[] = [
  { key: 'new', label: '全新' },
  { key: '95', label: '95新' },
  { key: '90', label: '9成新' },
  { key: '80', label: '8成新' },
]

export const PRICE_RANGES: { key: PriceRange; label: string; min: number; max: number }[] = [
  { key: '0-50', label: '0-50', min: 0, max: 50 },
  { key: '50-200', label: '50-200', min: 50, max: 200 },
  { key: '200-500', label: '200-500', min: 200, max: 500 },
  { key: '500-2000', label: '500-2000', min: 500, max: 2000 },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  Category,
  (typeof CATEGORIES)[number]
>

export const CONDITION_MAP = Object.fromEntries(CONDITIONS.map((c) => [c.key, c])) as Record<
  Condition,
  (typeof CONDITIONS)[number]
>

export const PRICE_RANGE_MAP = Object.fromEntries(PRICE_RANGES.map((p) => [p.key, p])) as Record<
  PriceRange,
  (typeof PRICE_RANGES)[number]
>

/** 匹配池筛选：距离阈值（km） */
export const MAX_DISTANCE_KM = 50

/** 首页每批拉取的卡片数 */
export const CARD_PAGE_SIZE = 10

/** 发布图片上限 */
export const MAX_ITEM_IMAGES = 9
