/**
 * 筛选弹层草稿逻辑的验证。
 *
 * 「选中之后点不掉」本质是状态算错了，所以这里断言的是纯函数，
 * 而不是靠真机上去点。运行：pnpm verify:filter
 */
import assert from 'node:assert/strict'

import type { Category } from '@/types'
import { sameCategories, toggleCategory } from '@/utils/filter'

async function step(title: string, fn: () => void) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function main() {
  console.log('\n换换 · 筛选验证\n')

  const ALL: Category[] = ['数码', '书籍', '潮玩', '乐器', '运动']

  await step('未选中的标签点一下会选中', () => {
    assert.deepEqual(toggleCategory([], '乐器'), ['乐器'])
    assert.deepEqual(toggleCategory(['数码'], '乐器'), ['数码', '乐器'])
  })

  await step('已选中的标签再点一下会取消（这条就是报的那个 bug）', () => {
    assert.deepEqual(toggleCategory(['乐器'], '乐器'), [], '点第二下必须能取消掉')
    assert.deepEqual(toggleCategory(['数码', '乐器'], '乐器'), ['数码'])
    assert.deepEqual(toggleCategory(['乐器', '数码'], '乐器'), ['数码'], '不受选中顺序影响')
  })

  await step('反复点偶数次会回到原样', () => {
    let list: Category[] = []
    for (let i = 0; i < 7; i += 1) list = toggleCategory(list, '潮玩')
    assert.deepEqual(list, ['潮玩'], '奇数次 = 选中')

    list = toggleCategory(list, '潮玩')
    assert.deepEqual(list, [], '偶数次 = 回到原样')
  })

  await step('每个品类都能独立选中和取消', () => {
    for (const key of ALL) {
      const on = toggleCategory([], key)
      assert.deepEqual(on, [key], `${key} 应该能选上`)
      assert.deepEqual(toggleCategory(on, key), [], `${key} 应该能取消`)
    }
  })

  await step('不改原数组（原地改会让 React 跳过重渲染）', () => {
    const original: Category[] = ['数码']
    const next = toggleCategory(original, '书籍')
    assert.deepEqual(original, ['数码'], '原数组不能被改动')
    assert.notEqual(next, original, '必须返回新数组')

    const removed = toggleCategory(original, '数码')
    assert.deepEqual(original, ['数码'], '取消时也不能改原数组')
    assert.notEqual(removed, original)
  })

  await step('全选后逐个取消能回到空', () => {
    let list = ALL.reduce<Category[]>((acc, k) => toggleCategory(acc, k), [])
    assert.equal(list.length, ALL.length, '五个品类都该选上')
    for (const k of ALL) list = toggleCategory(list, k)
    assert.deepEqual(list, [], '全部取消后应该为空')
  })

  await step('sameCategories：顺序无关，能识别出「没变」', () => {
    assert.equal(sameCategories([], []), true)
    assert.equal(sameCategories(['数码', '书籍'], ['书籍', '数码']), true, '顺序不同但同一组')
    assert.equal(sameCategories(['数码'], ['数码', '书籍']), false, '长度不同')
    assert.equal(sameCategories(['数码'], ['书籍']), false, '内容不同')
    assert.equal(sameCategories([], ['数码']), false, '空和非空')
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
