import type { Category, Condition, PriceRange } from '@/types'

/**
 * 运行时用到的颜色（图标 color 属性等）。
 * 必须和 src/styles/variables.scss 保持一致 —— 那边给样式用，这边给组件属性用。
 */
export const THEME = {
  /** 深墨绿：主按钮、选中态 */
  primary: '#3C5434',
  primaryDeep: '#2C3F26',
  primarySoft: '#E9EEE7',
  /** 暖棕：强调标签、估值高亮 */
  accent: '#94601A',
  accentSoft: '#F6EEE1',
  /** 金棕：次级按钮、图标选中态 */
  gold: '#C79A54',
  /** 灰绿：品类标签、分割线 */
  sage: '#5F8578',
  /** 灰绿的深色字（胶囊标签文字） */
  sageDeep: '#45685C',

  text: '#080905',
  textSub: '#9FA199',
  textWeak: '#BFC1BA',

  bg: '#FEFDFC',
  border: 'rgba(159, 161, 153, 0.24)',
  success: '#2FBF71',
  danger: '#C0392B',
}

/**
 * 品类。注意 key 就是存进数据库的值（中文），label 不再单独存在。
 * emoji 用在 ItemImage 的占位图兜底和 TagPicker 的标签上；
 * 列表/卡片里的品类徽标走 CategoryIcon。
 */
export const CATEGORIES: { key: Category; emoji: string }[] = [
  { key: '数码', emoji: '📱' },
  { key: '书籍', emoji: '📚' },
  { key: '潮玩', emoji: '🧸' },
  { key: '乐器', emoji: '🎸' },
  { key: '运动', emoji: '🏀' },
  { key: '家具', emoji: '🛋️' },
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
