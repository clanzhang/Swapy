/**
 * 滑动手势的纯计算部分。
 *
 * 从组件里抽出来是为了能验证：这些阈值直接决定「滑多远才算数」，
 * 写错了不会报错，只会让人觉得「怎么滑都不生效」或者「一碰就飞」。
 * 调参改这里，然后跑 `pnpm verify:gesture` 看行为表。
 */

/** 触发「想要 / 跳过」的横向位移阈值（占卡片宽度比例） */
export const SWIPE_RATIO = 0.26

/** 触发「查看详情」的纵向位移阈值（px） */
export const DETAIL_THRESHOLD = 80

/** 拖动过程中的最大旋转角（度） */
export const DRAG_ROTATE = 14

/** 旋转达到最大值所需的横向位移（占卡片宽度比例，越小越灵敏） */
export const ROTATE_RATIO = 0.4

/** 飞出时的旋转角（度） */
export const FLY_ROTATE = 18

/** 右滑飞出时的放大倍数 */
export const FLY_SCALE_LIKE = 1.08

/** 左滑飞出时的缩小倍数 */
export const FLY_SCALE_NOPE = 0.96

/**
 * 甩动判定：速度超过这个值（px/ms）且位移超过 FLING_MIN_DISTANCE，
 * 就算没拖满阈值也认。这是「一甩就走」的手感来源。
 * 阈值取得比较保守，宁可贵一点也不能误触发。
 */
export const FLING_VELOCITY = 0.6

/** 甩动判定要求的最小位移（px） */
export const FLING_MIN_DISTANCE = 36

/** 松手时距上一次 touchmove 超过这个时长，速度就不作数了（用户是拖住不动后松手的） */
export const FLING_STALE_MS = 120

export type SwipeOutcome = 'left' | 'right' | 'detail' | 'reset'

export interface DragSample {
  x: number
  y: number
  /** 时间戳（ms） */
  t: number
}

export interface DragState {
  x: number
  y: number
  /** 横向速度，px/ms，右为正 */
  velocityX?: number
  /** 纵向速度，px/ms，下为正 */
  velocityY?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** 用相邻两次采样估算速度 */
export function sampleVelocity(prev: DragSample, next: DragSample) {
  const dt = next.t - prev.t
  if (dt <= 0) return { x: 0, y: 0 }
  return { x: (next.x - prev.x) / dt, y: (next.y - prev.y) / dt }
}

/**
 * 松手后该怎么处理。
 *
 * 横向优先于纵向：斜着甩出去时，用户的意图是「决策」而不是「看详情」，
 * 因为决策是这个产品唯一的核心动作。
 */
export function decideOutcome(drag: DragState, cardWidth: number): SwipeOutcome {
  const { x, y, velocityX = 0, velocityY = 0 } = drag
  const threshold = cardWidth * SWIPE_RATIO
  const horizontal = Math.abs(x) >= Math.abs(y)

  if (horizontal) {
    // 拖够了距离
    if (Math.abs(x) > threshold) return x > 0 ? 'right' : 'left'
    // 或者甩得够快
    if (Math.abs(x) > FLING_MIN_DISTANCE && Math.abs(velocityX) > FLING_VELOCITY) {
      return velocityX > 0 ? 'right' : 'left'
    }
    return 'reset'
  }

  if (y < -DETAIL_THRESHOLD) return 'detail'
  if (-y > FLING_MIN_DISTANCE && -velocityY > FLING_VELOCITY) return 'detail'
  return 'reset'
}

/** 拖动中的旋转角：跟手，且在 ±DRAG_ROTATE 封顶 */
export function dragRotation(x: number, cardWidth: number): number {
  return clamp(x / (cardWidth * ROTATE_RATIO), -1, 1) * DRAG_ROTATE
}

/** 飞出时的旋转角 */
export function flyRotation(direction: 'left' | 'right'): number {
  return direction === 'right' ? FLY_ROTATE : -FLY_ROTATE
}

/** 飞出时的缩放：右滑放大（想要），左滑缩小（丢掉） */
export function flyScale(direction: 'left' | 'right'): number {
  return direction === 'right' ? FLY_SCALE_LIKE : FLY_SCALE_NOPE
}

/** 三个操作印章的透明度 */
export function stampOpacity(x: number, y: number, cardWidth: number) {
  const threshold = cardWidth * SWIPE_RATIO
  return {
    like: clamp(x / threshold, 0, 1),
    nope: clamp(-x / threshold, 0, 1),
    up: clamp(-y / DETAIL_THRESHOLD, 0, 1),
  }
}
