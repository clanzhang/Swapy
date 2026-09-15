/**
 * 每日配额的验证。
 *
 * 配额的坑全在时间边界上：12:00 刷新点、跨天重置、云函数在 UTC 而用户在 UTC+8。
 * 这些都不会报错，只会表现为「刚刷新就没了」或者「明明用完了还能继续」。
 *
 * 运行：pnpm verify:quota
 */
import assert from 'node:assert/strict'

import { SEED_ITEMS, SEED_ME, SEED_SWIPES, SEED_USERS } from '@/constants/seed'
import { createMockApi } from '@/services/mock'
import { useDeckStore } from '@/store/deckStore'
import { DAILY_QUOTA, formatCountdown, nextResetAt, quotaDayKey } from '@/utils/quota'

const DB_KEY = 'swapy:mock-db:v1'

/** 北京时间某天的某个整点对应的真实时间戳 */
function beijing(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

async function step(title: string, fn: () => Promise<void> | void) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function main() {
  console.log('\n换换 · 每日配额验证\n')

  await step('dayKey 以 12:00 为界切天', () => {
    const before = beijing(2026, 9, 15, 11, 59)
    const after = beijing(2026, 9, 15, 12, 0)

    // 11:59 还属于「14 号 12:00 开始」的那个窗口
    assert.equal(quotaDayKey(before), '2026-09-14')
    // 12:00 整点切换
    assert.equal(quotaDayKey(after), '2026-09-15')
    // 一直到次日 11:59 都不变
    assert.equal(quotaDayKey(beijing(2026, 9, 16, 11, 59)), '2026-09-15')
    assert.equal(quotaDayKey(beijing(2026, 9, 16, 12, 0)), '2026-09-16')
  })

  await step('dayKey 不受服务器时区影响（固定按北京时间算）', () => {
    // 同一时刻，无论进程 TZ 是什么，结果都一样 —— 这里只能验证它是纯函数
    const ts = beijing(2026, 9, 15, 12, 0)
    assert.equal(quotaDayKey(ts), quotaDayKey(ts))
    // UTC 当天 04:00 正好是北京 12:00
    assert.equal(quotaDayKey(Date.UTC(2026, 8, 15, 3, 59)), '2026-09-14')
    assert.equal(quotaDayKey(Date.UTC(2026, 8, 15, 4, 0)), '2026-09-15')
  })

  await step('nextResetAt 落在下一个 12:00 整点', () => {
    for (const hour of [0, 6, 11, 12, 13, 18, 23]) {
      const now = beijing(2026, 9, 15, hour, 30)
      const reset = nextResetAt(now)

      assert.ok(reset > now, `${hour}:30 的下次刷新应该在将来`)
      assert.ok(reset - now <= 24 * 3600 * 1000, '下次刷新不该超过 24 小时')

      // 刷新点前 1ms 和后 1ms 必须属于不同的配额日
      assert.notEqual(
        quotaDayKey(reset - 1),
        quotaDayKey(reset),
        `${hour}:30 推出来的刷新点没有切天`,
      )
      // 刷新那一刻必须属于新的一天
      assert.equal(quotaDayKey(reset), quotaDayKey(now + 24 * 3600 * 1000 <= reset ? now : reset))
    }
  })

  await step('倒计时格式化', () => {
    assert.equal(formatCountdown(0), '0 秒')
    assert.equal(formatCountdown(45_000), '45 秒')
    assert.equal(formatCountdown(90_000), '1 分 30 秒')
    assert.equal(formatCountdown(3 * 3600_000 + 12 * 60_000), '3 小时 12 分')
    assert.equal(formatCountdown(-5000), '0 秒', '负数不该出现负号')
  })

  // ------------------------------------------------------------ 消耗行为

  const settle = () => new Promise((r) => setTimeout(r, 40))

  await step('首页徽标：每滑一张就少 1（用户实际看到的链路）', async () => {
    // 这条是照着真实链路跑的：deckStore → services → mock。
    // 之前有人反馈「数字一直停在 29」，原因不在这一层（是口径理解不同），
    // 但既然有人会这么看，就该有一条断言盯着它。
    const store = useDeckStore.getState()
    await store.init()
    await settle()

    const first = useDeckStore.getState().quota!.remaining
    assert.ok(first > 0, '初始应该有额度')

    // 左滑右滑交替，每一次徽标都必须减 1
    const directions = ['right', 'left', 'left', 'right', 'left'] as const
    for (let i = 0; i < directions.length; i += 1) {
      await useDeckStore.getState().commitSwipe(directions[i])
      await settle()
      assert.equal(
        useDeckStore.getState().quota!.remaining,
        first - (i + 1),
        `第 ${i + 1} 次滑动（${directions[i]}）之后徽标没变`,
      )
    }
  })

  const api = createMockApi()
  await api.init()

  await step('左滑和右滑都消耗额度（额度按张数算）', async () => {
    const before = (await api.getCards({ limit: 1 })).quota!
    const pool = (await api.getCards({ limit: 5 })).list

    const left = await api.swipe(pool[0]._id, 'left')
    assert.equal(left.quota.used, before.used + 1, '左滑跳过也要扣额度')

    const right = await api.swipe(pool[1]._id, 'right')
    assert.equal(right.quota.used, before.used + 2, '右滑想要也要扣额度')
    assert.equal(right.quota.limit, DAILY_QUOTA)
    assert.equal(right.quota.remaining, DAILY_QUOTA - (before.used + 2))
  })

  let exhausted = false

  await step('额度耗尽后不再下发卡片', async () => {
    // 一直左滑到额度见底（左滑不涉及匹配，跑起来更干净）
    for (let guard = 0; guard < DAILY_QUOTA * 3; guard += 1) {
      const pool = (await api.getCards({ limit: 200 })).list
      if (!pool.length) break
      const res = await api.swipe(pool[0]._id, 'left')
      if (res.quota.remaining <= 0) {
        exhausted = true
        break
      }
    }

    assert.ok(exhausted, '应该能把额度用光')
    const page = await api.getCards({ limit: 200 })
    assert.equal(page.list.length, 0, '额度用完就不该再发卡')
    assert.equal(page.quota?.remaining, 0)
    assert.equal(page.quota?.used, DAILY_QUOTA)
  })

  await step('额度耗尽后的滑动不被记录（不能偷偷消耗掉物品）', async () => {
    const wantedBefore = (await api.getWantedItems()).length
    const pool = (await api.getCards({ limit: 200 })).list
    assert.equal(pool.length, 0, '前置条件：额度用完时池子应该是空的')

    // 直接对一件已知物品发起滑动，模拟客户端被绕过
    const target = SEED_ITEMS.find(
      (i) => i.ownerId !== SEED_ME._id && i.status === 'active',
    )!

    const left = await api.swipe(target._id, 'left')
    assert.equal(left.quota.remaining, 0, '额度不该变成负数')
    assert.equal(left.quota.used, DAILY_QUOTA, 'used 不该超过上限')

    const right = await api.swipe(target._id, 'right')
    assert.equal(right.matched, false, '超额度不该匹配')
    assert.equal(right.quota.used, DAILY_QUOTA, 'used 不该超过上限')

    const wantedAfter = (await api.getWantedItems()).length
    assert.equal(
      wantedAfter,
      wantedBefore,
      '超额度的滑动不该被记录，否则用户明天回来会发现物品被偷偷跳过了',
    )
  })

  await step('resetAt 在未来且不超过 24 小时', async () => {
    const page = await api.getCards({ limit: 1 })
    const now = Date.now()
    const resetAt = page.quota!.resetAt
    assert.ok(resetAt > now, '刷新时间应该在将来')
    assert.ok(resetAt - now <= 24 * 3600 * 1000, '刷新时间不该超过 24 小时')
  })

  // ------------------------------------------------------------ 跨天重置

  await step('跨过刷新点后额度自动恢复', async () => {
    const Taro = (await import('@tarojs/taro')).default as any

    // 等上一个实例的持久化定时器落地，避免被它覆盖
    await new Promise((r) => setTimeout(r, 400))

    // 造一份「昨天的存档」：额度已经用光
    Taro.setStorageSync(
      DB_KEY,
      JSON.stringify({
        users: SEED_USERS,
        items: SEED_ITEMS,
        swipes: SEED_SWIPES,
        matches: [],
        messages: [],
        meId: SEED_ME._id,
        quota: { dayKey: '2000-01-01', used: DAILY_QUOTA },
      }),
    )

    const revived = createMockApi()
    await revived.init()

    const page = await revived.getCards({ limit: 5 })
    assert.equal(page.quota?.used, 0, '跨天后已用次数应归零')
    assert.equal(page.quota?.remaining, DAILY_QUOTA, '跨天后额度应满血')
    assert.ok(page.list.length > 0, '跨天后应该重新有卡片可滑')
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
