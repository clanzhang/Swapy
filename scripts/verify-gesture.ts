/**
 * 滑动手势的行为验证 + 参数表。
 *
 * 这些阈值决定「滑多远才算数」，写错了不报错、只影响手感，
 * 所以既做断言（防回归），也打印一张表（方便不通真机就能调参）。
 *
 * 运行：pnpm verify:gesture
 */
import assert from 'node:assert/strict'

import {
  DETAIL_THRESHOLD,
  DRAG_ROTATE,
  FLING_MIN_DISTANCE,
  FLING_VELOCITY,
  FLY_ROTATE,
  FLY_SCALE_LIKE,
  FLY_SCALE_NOPE,
  SWIPE_RATIO,
  decideOutcome,
  dragRotation,
  flyRotation,
  flyScale,
  sampleVelocity,
  stampOpacity,
} from '@/components/SwipeCard/gesture'

/** iPhone 375 宽 − 左右各 16px 边距 */
const CARD_W = 343
const THRESHOLD = CARD_W * SWIPE_RATIO

const LABEL: Record<string, string> = {
  right: '想要 →',
  left: '跳过 ←',
  detail: '详情 ↑',
  reset: '归位',
}

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

/** 静止松手（无甩动） */
const still = (x: number, y: number) => decideOutcome({ x, y }, CARD_W)

function printTable() {
  console.log(
    `\n  卡片宽度 ${CARD_W}px · 横向距离阈值 ${THRESHOLD.toFixed(
      1,
    )}px · 纵向阈值 ${DETAIL_THRESHOLD}px`,
  )
  console.log(
    `  甩动阈值：位移 > ${FLING_MIN_DISTANCE}px 且速度 > ${FLING_VELOCITY}px/ms\n`,
  )

  console.log('  ── 慢慢拖（松手时速度为 0） ──')
  console.log('  横向位移   判定      旋转     想要印章')
  console.log('  ─────────────────────────────────────────')
  for (const x of [0, 20, 40, 60, 80, 89, 90, 120, 200, 260]) {
    const outcome = still(x, 0)
    const rotate = dragRotation(x, CARD_W)
    const { like } = stampOpacity(x, 0, CARD_W)
    console.log(
      `  ${`${x}px`.padEnd(10)} ${LABEL[outcome].padEnd(8)} ${`${rotate.toFixed(1)}°`.padEnd(
        8,
      )} ${(like * 100).toFixed(0).padStart(3)}%`,
    )
  }

  console.log('\n  ── 快速甩（位移只有 50px） ──')
  console.log('  甩动速度        判定')
  console.log('  ──────────────────────────')
  for (const v of [0.2, 0.5, 0.6, 0.7, 1.2, 2.5, -1.2]) {
    const outcome = decideOutcome({ x: 50, y: 0, velocityX: v }, CARD_W)
    console.log(`  ${`${v}px/ms`.padEnd(14)} ${LABEL[outcome]}`)
  }

  console.log('\n  ── 纵向 ──')
  console.log('  纵向位移   判定')
  console.log('  ──────────────────────')
  for (const y of [0, -40, -79, -80, -81, -120]) {
    console.log(`  ${`${y}px`.padEnd(10)} ${LABEL[still(0, y)]}`)
  }
  console.log()
}

function main() {
  console.log('\n换换 · 滑动手势验证\n')

  step('横向位移不足且没有甩动时归位', () => {
    assert.equal(still(0, 0), 'reset')
    assert.equal(still(40, 0), 'reset')
    assert.equal(still(-40, 0), 'reset')
  })

  step('超过阈值才触发，恰好等于阈值仍归位', () => {
    assert.equal(still(THRESHOLD, 0), 'reset', '阈值上不该触发')
    assert.equal(still(THRESHOLD + 1, 0), 'right')
    assert.equal(still(-THRESHOLD - 1, 0), 'left')
  })

  step('左右对称', () => {
    for (const x of [100, 150, 220, 300]) {
      assert.equal(still(x, 0), 'right')
      assert.equal(still(-x, 0), 'left')
      assert.equal(dragRotation(x, CARD_W), -dragRotation(-x, CARD_W))
    }
  })

  step('斜向甩出时横向优先（决策优先于详情）', () => {
    assert.equal(still(120, -100), 'right')
    assert.equal(still(-120, -100), 'left')
  })

  step('纵向占优且够深才触发详情', () => {
    assert.equal(still(0, -DETAIL_THRESHOLD), 'reset', '阈值上不该触发')
    assert.equal(still(0, -DETAIL_THRESHOLD - 1), 'detail')
    assert.equal(still(20, -120), 'detail')
    assert.equal(still(0, 60), 'reset', '下滑不该有任何动作')
  })

  step('快速轻甩可以触发（不必拖满阈值）', () => {
    const flick = (v: number, x = 50) => decideOutcome({ x, y: 0, velocityX: v }, CARD_W)
    assert.equal(flick(FLING_VELOCITY - 0.05), 'reset', '速度不够不该触发')
    assert.equal(flick(FLING_VELOCITY + 0.05), 'right')
    assert.equal(flick(-(FLING_VELOCITY + 0.05)), 'left')
    assert.equal(flick(2.5, FLING_MIN_DISTANCE), 'reset', '位移太小不该触发（防误触）')
    assert.equal(flick(2.5, FLING_MIN_DISTANCE + 1), 'right')
    assert.equal(flick(2.5, 200), 'right', '位移已经够远时速度是多余的')
  })

  step('反方向甩不会误触发', () => {
    // 往右拖了一点，但甩的方向是往左
    assert.equal(decideOutcome({ x: 50, y: 0, velocityX: -2 }, CARD_W), 'left')
    // 位移不够远时，方向由速度决定
    assert.equal(decideOutcome({ x: -50, y: 0, velocityX: 2 }, CARD_W), 'right')
  })

  step('快速上甩也能打开详情', () => {
    assert.equal(decideOutcome({ x: 0, y: -50, velocityY: -2 }, CARD_W), 'detail')
    assert.equal(decideOutcome({ x: 0, y: -50, velocityY: -0.2 }, CARD_W), 'reset')
    // 横向位移已经超过门槛时，纵向速度再大也不该抢走判定
    assert.equal(decideOutcome({ x: 100, y: -50, velocityY: -2 }, CARD_W), 'right')
    // 横向不够、纵向占优时，上甩才生效
    assert.equal(decideOutcome({ x: 40, y: -50, velocityY: -2 }, CARD_W), 'detail')
    assert.equal(decideOutcome({ x: 40, y: -50, velocityY: -0.2 }, CARD_W), 'reset')
  })

  step('速度采样：静止与匀速都算得对', () => {
    assert.deepEqual(sampleVelocity({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 16 }), {
      x: 0,
      y: 0,
    })
    const v = sampleVelocity({ x: 0, y: 0, t: 1000 }, { x: 60, y: -30, t: 1020 })
    assert.equal(v.x, 3)
    assert.equal(v.y, -1.5)
    // 时间没走时不产生无穷速度
    assert.deepEqual(sampleVelocity({ x: 0, y: 0, t: 5 }, { x: 90, y: 90, t: 5 }), {
      x: 0,
      y: 0,
    })
  })

  step('旋转跟手且封顶', () => {
    assert.equal(dragRotation(0, CARD_W), 0)
    assert.ok(dragRotation(60, CARD_W) > 0, '右滑应该正向旋转')
    assert.ok(dragRotation(-60, CARD_W) < 0, '左滑应该反向旋转')
    let prev = -Infinity
    for (let x = 0; x <= 400; x += 10) {
      const r = dragRotation(x, CARD_W)
      assert.ok(r >= prev, `旋转角在 x=${x} 处回退了`)
      prev = r
    }
    assert.equal(dragRotation(9999, CARD_W), DRAG_ROTATE, '应该封顶在最大角')
    assert.equal(dragRotation(-9999, CARD_W), -DRAG_ROTATE)
  })

  step('印章透明度恒在 0..1，且到阈值时刚好满', () => {
    for (const x of [-500, -100, -30, 0, 30, 100, 500]) {
      for (const y of [-200, -50, 0, 50]) {
        const { like, nope, up } = stampOpacity(x, y, CARD_W)
        for (const [name, v] of Object.entries({ like, nope, up })) {
          assert.ok(v >= 0 && v <= 1, `${name} 越界：${v}`)
        }
      }
    }
    const full = stampOpacity(THRESHOLD, 0, CARD_W)
    assert.equal(full.like, 1, '到阈值时「想要」印章应刚好完全显现')
    assert.equal(full.nope, 0, '右滑时不该显示「跳过」')
    assert.equal(stampOpacity(0, -DETAIL_THRESHOLD, CARD_W).up, 1)
  })

  step('飞出参数：右滑放大发亮，左滑不缩放', () => {
    // 直接测组件真正调用的那个函数，而不是只对比常量
    assert.equal(flyScale('right'), FLY_SCALE_LIKE)
    assert.equal(flyScale('left'), FLY_SCALE_NOPE)
    // 规范：右滑轻微放大 1.05x；左滑只平移 + 旋转，不缩放
    assert.equal(FLY_SCALE_LIKE, 1.05, '右滑应该轻微放大')
    assert.equal(FLY_SCALE_NOPE, 1, '左滑不应该缩放')
    assert.equal(FLY_ROTATE, 15, '飞出旋转角应为 15°')
    assert.equal(flyRotation('right'), FLY_ROTATE)
    assert.equal(flyRotation('left'), -FLY_ROTATE)
  })

  printTable()

  console.log('全部通过 ✅\n')
}

main()
