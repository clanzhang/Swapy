import type { Category, Condition, PriceRange } from '@/types'

export const THEME = {
  primary: '#FF6B35',
  primaryDeep: '#E2551F',
  primarySoft: '#FFF3E0',
  text: '#1F1F1F',
  textSub: '#8A8A8E',
  textWeak: '#B8B8BD',
  border: '#F0F0F0',
  bg: '#F7F7F9',
  success: '#2FBF71',
  danger: '#FF4D4F',
}

/**
 * 品类。注意 key 就是存进数据库的值（中文），label 不再单独存在。
 * emoji 只用于 ItemImage 的占位图兜底，UI 上的标签图标走 CategoryIcon。
 */
export const CATEGORIES: { key: Category; emoji: string }[] = [
  { key: '数码', emoji: '📱' },
  { key: '书籍', emoji: '📚' },
  { key: '潮玩', emoji: '🧸' },
  { key: '乐器', emoji: '🎸' },
  { key: '运动', emoji: '🏀' },
]

export const CONDITIONS: Condition[] = ['全新', '95新', '9成新', '8成新']

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

export const PRICE_RANGE_MAP = Object.fromEntries(PRICE_RANGES.map((p) => [p.key, p])) as Record<
  PriceRange,
  (typeof PRICE_RANGES)[number]
>

/** 首页每批拉取的卡片数（对应 getCards 的 pageSize） */
export const CARD_PAGE_SIZE = 10

/** 发布图片上限 */
export const MAX_ITEM_IMAGES = 9

/** 聊天记录每页条数（对应 getChatHistory） */
export const CHAT_PAGE_SIZE = 50
