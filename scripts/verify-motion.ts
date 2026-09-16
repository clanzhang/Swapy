/**
 * 动画性能的验证。
 *
 * 卡屏的成因都很隐蔽，而且只在真机上暴露，构建和类型检查都发现不了：
 *
 * 1. 弹窗用 CSS keyframes 在「挂载的同一帧」开始播 —— 布局、绘制、动画
 *    抢同一帧，面板里东西越多越明显。
 * 2. 两个动画同时跑，比如「上滑看详情」时卡片还在弹、面板也在滑。
 * 3. 缺 `will-change`，动画期间每帧重绘整棵子树。
 * 4. 牌堆里的卡片没有 memo，首页任何状态变化都重渲染 3 张卡。
 *
 * 这些都没法在本地跑真机验证，所以固化成静态检查。
 *
 * 运行：pnpm verify:motion
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

/** 从底部/中央弹出来的三个浮层 */
const OVERLAYS = [
  {
    name: '详情面板',
    tsx: 'src/components/ItemDetailSheet/index.tsx',
    scss: 'src/components/ItemDetailSheet/index.scss',
    // 面板和遮罩都要查 —— 只查面板的话，遮罩漏改发现不了（真踩过）
    parts: ['sheet__panel', 'sheet__mask'],
  },
  {
    name: '匹配弹窗',
    tsx: 'src/components/MatchModal/index.tsx',
    scss: 'src/components/MatchModal/index.scss',
    parts: ['match-modal__content', 'match-modal__mask'],
  },
  {
    name: '完善资料引导',
    tsx: 'src/components/ProfileGuide/index.tsx',
    scss: 'src/components/ProfileGuide/index.scss',
    parts: ['guide__panel', 'guide__mask'],
  },
]

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

/** 取某个类名的规则块 */
function rule(scss: string, cls: string): string {
  const m = scss.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))
  return m ? m[1] : ''
}

function main() {
  console.log('\n换换 · 动画性能验证\n')

  step('弹窗走两段式入场，不用「挂载即播」的 keyframes', () => {
    const problems: string[] = []

    for (const o of OVERLAYS) {
      const tsx = read(o.tsx)
      const scss = read(o.scss)

      if (!tsx.includes('useEnter')) {
        problems.push(`${o.name} 没有用 useEnter —— 动画会和首帧布局抢时间`)
      }

      for (const part of o.parts) {
        // 必须精确到元素自己的类名。
        // 写 tsx.includes('--in') 是不行的：遮罩层的 xxx__mask--in 会把它满足，
        // 面板退化成挂载即播也测不出来（这个坑已经踩过）
        if (!tsx.includes(`${part}--in`)) {
          problems.push(`${o.name} 的 ${part} 没有 --in 状态类`)
        }

        const body = rule(scss, part)
        if (!body) {
          problems.push(`${o.name} 找不到 ${part} 的样式`)
          continue
        }
        if (/\banimation\s*:/.test(body)) {
          problems.push(`${o.name} 的 ${part} 还在用 animation keyframes`)
        }
        if (!/transition\s*:/.test(body)) {
          problems.push(`${o.name} 的 ${part} 没有 transition`)
        }
      }

      // will-change 只要求面板加上：遮罩是一层纯色，不值得单独提升合成层
      const panel = o.parts[0]
      if (!/will-change\s*:/.test(rule(scss, panel))) {
        problems.push(`${o.name} 的 ${panel} 缺 will-change`)
      }
    }

    assert.equal(problems.length, 0, `\n    ${problems.join('\n    ')}`)
  })

  step('上滑看详情不再和卡片弹簧动画重叠', () => {
    const swipe = read('src/components/SwipeCard/index.tsx')
    const raw = swipe.match(/if \(outcome === 'detail'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? ''

    assert.ok(raw, '找不到 detail 分支')

    // 先把注释剥掉再检查：说明文字里会提到 reset()，不能当成真的在调用
    const detail = raw
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')

    assert.ok(
      !/reset\(\)/.test(detail),
      '详情分支不能跑 reset()（360ms 弹簧会和面板滑入抢帧），应该用 snapBack',
    )
    assert.ok(/snapBack\(\)/.test(detail), '详情分支应该调用 snapBack()')
    assert.ok(!/later\(/.test(detail), '详情分支不该有延时 —— 直接归位后立刻开面板')
  })

  step('牌堆卡片是 memo 的，回调也稳定', () => {
    assert.ok(
      /export default memo\(/.test(read('src/components/SwipeCard/index.tsx')),
      'SwipeCard 应该有 memo 包裹',
    )

    const page = read('src/pages/index/index.tsx')
    assert.ok(/onDecide=\{handleDecide\}/.test(page), 'onDecide 应该传稳定引用')
    assert.ok(/onDetail=\{handleDetail\}/.test(page), 'onDetail 应该传稳定引用')
    assert.ok(/useCallback\(\s*async \(direction/.test(page), 'handleDecide 应该用 useCallback')

    const body = rule(read('src/components/SwipeCard/index.scss'), 'swipe-card__mover')
    assert.ok(/will-change\s*:/.test(body), '拖拽层应该有 will-change: transform')
  })

  step('撒花粒子数量克制', () => {
    const src = read('src/components/MatchModal/index.tsx')
    const count = Number(src.match(/length:\s*(\d+)\s*\}/)?.[1] ?? 0)

    assert.ok(count > 0, '找不到粒子数量')
    assert.ok(
      count <= 20,
      `粒子有 ${count} 个 —— 二十多个元素同时跑动画在小程序 webview 里很吃帧`,
    )
  })

  console.log('\n全部通过 ✅\n')
}

main()
