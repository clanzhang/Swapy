/**
 * deckStore 的状态机验证。
 *
 * 这里测的是「多个异步操作交叉时状态还对不对」—— 这类问题单看代码很难发现，
 * 而且不报错，只表现为「牌堆里混进了不该有的卡」「额度莫名其妙少了」。
 *
 * 运行：pnpm verify:store
 */
import assert from 'node:assert/strict'

import { api } from '@/services'
import { resetMockData } from '@/services/mock'
import { useDeckStore } from '@/store/deckStore'
import type { CardItem, GetCardsParams, GetCardsResult } from '@/types'
import { DAILY_QUOTA } from '@/utils/quota'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const deck = () => useDeckStore.getState()

async function step(title: string, fn: () => Promise<void> | void) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function fresh() {
  resetMockData()
  useDeckStore.setState({
    cards: [],
    page: 1,
    hasMore: true,
    loading: false,
    categories: [],
    matchResult: null,
    quota: null,
    epoch: 0,
  })
  await deck().init()
  await sleep(30)
}

async function main() {
  console.log('\n换换 · deckStore 状态机验证\n')

  const swipeCard = (card: CardItem, direction: 'left' | 'right') =>
    api.swipe({ toItemId: card._id, toUserId: card.ownerId, direction })

  const quotaNow = async () => (await api.getCards({ page: 1, pageSize: 1 })).quota!

  await step('同一张卡重复提交不会重复扣额度', async () => {
    // 客户端重试、或牌堆状态陈旧时会重复提交。幂等检查必须在扣额度之前，
    // 否则用户白丢一次额度却根本没看到新卡。
    await fresh()

    const card = deck().cards[0]
    const before = (await quotaNow()).used

    await swipeCard(card, 'right')
    const afterFirst = await quotaNow()
    await swipeCard(card, 'right')
    const afterSecond = await quotaNow()
    await swipeCard(card, 'left')
    const afterThird = await quotaNow()

    assert.equal(afterFirst.used, before + 1, '第一次滑动应该扣 1')
    assert.equal(afterSecond.used, afterFirst.used, '重复滑动不该再扣')
    assert.equal(afterThird.used, afterFirst.used, '换方向重复滑动也不该再扣')
  })

  await step('切品类时，上一个筛选条件的过期响应会被丢弃', async () => {
    // init() 会重新拉卡，但上一次的请求还在飞。如果直接采纳，
    // 旧筛选的卡片就会被追加进新牌堆。
    await fresh()

    const original = api.getCards.bind(api)
    let delayNext = true
    // 故意把 API 换成慢的：这就是测试的目的（模拟过期响应）。
    api.getCards = async (query: GetCardsParams): Promise<GetCardsResult> => {
      if (delayNext) {
        delayNext = false
        await sleep(60)
      }
      return original(query)
    }

    // 慢请求（无筛选）还没回来就切品类
    const slow = deck().init()
    await sleep(10)
    await deck().setCategories(['数码'])
    await slow
    await sleep(150)

    // 测试结束还原（这里就是要跨越 await 改写同一个引用）
    // eslint-disable-next-line require-atomic-updates
    api.getCards = original

    const cards = deck().cards
    assert.ok(cards.length > 0, '切品类后应该有卡')
    const wrong = cards.filter((c) => c.category !== '数码')
    assert.equal(
      wrong.length,
      0,
      `牌堆里混进了非数码品类：${wrong.map((c) => `${c.title}(${c.category})`).join('、')}`,
    )
  })

  await step('滑动失败时卡片会放回牌堆', async () => {
    // 卡片是先推掉再提交的（动画已经播完）。提交失败必须放回去，
    // 否则用户以为滑过了、服务端却没记录。
    await fresh()

    const before = deck().cards.length
    const topId = deck().cards[0]._id
    const original = api.swipe.bind(api)
    // 故意让滑动失败：验证失败时卡片会被放回去。
    api.swipe = async () => {
      throw new Error('模拟网络失败')
    }

    await deck().commitSwipe('left')
    // eslint-disable-next-line require-atomic-updates
    api.swipe = original

    assert.equal(deck().cards.length, before, '失败后卡片数量应该不变')
    assert.equal(deck().cards[0]._id, topId, '失败的那张应该回到牌堆最上面')
  })

  await step('随机操作序列下不变量始终成立', async () => {
    await fresh()

    const ops = ['left', 'right', 'left', 'left', 'right'] as const
    let seed = 20260915
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    for (let i = 0; i < 60; i += 1) {
      const q = deck().quota!
      assert.ok(q.used >= 0 && q.used <= q.limit, `used 越界: ${q.used}`)
      assert.equal(
        q.remaining,
        q.limit - q.used,
        `remaining 和 used 对不上: ${q.remaining} vs ${q.limit - q.used}`,
      )

      const ids = deck().cards.map((c) => c._id)
      assert.equal(new Set(ids).size, ids.length, '牌堆里出现了重复卡片')

      if (q.remaining <= 0) {
        assert.equal(deck().cards.length, 0, '额度为 0 时牌堆应该清空')
        break
      }

      if (deck().cards.length === 0) {
        await deck().init()
        await sleep(15)
        if (deck().cards.length === 0) break
      }

      await deck().commitSwipe(ops[Math.floor(rand() * ops.length)])
      await sleep(8)

      // 中途穿插切品类，制造并发
      if (i === 15) await deck().setCategories(['潮玩'])
      if (i === 30) await deck().setCategories([])
    }

    assert.ok(deck().quota!.used <= DAILY_QUOTA, 'used 不该超过上限')
  })

  await step('分页追加不会造成重复或回放', async () => {
    await fresh()

    /** 已经滑掉的卡，绝不能再出现在牌堆里 */
    const swiped = new Set<string>()
    let count = 0

    for (let i = 0; i < 18; i += 1) {
      const cards = deck().cards
      if (!cards.length) break

      const ids = cards.map((c) => c._id)
      assert.equal(new Set(ids).size, ids.length, '牌堆内部出现了重复卡片')

      const replayed = cards.filter((c) => swiped.has(c._id))
      assert.equal(
        replayed.length,
        0,
        `已经滑过的卡片又回来了：${replayed.map((c) => c.title).join('、')}`,
      )

      swiped.add(cards[0]._id)
      count += 1
      await deck().commitSwipe('left')
      await sleep(12)
    }

    assert.ok(count >= 12, `只滑了 ${count} 张，分页可能没生效`)
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
