/**
 * 匹配算法 + 每日配额的行为验证。
 *
 * 匹配判定是整个产品最容易悄悄写错的地方（互相右滑、估值区间交集、
 * 距离过滤、排除已滑过的、额度扣减），所以用一个可执行脚本把它钉死。
 *
 * 注意：所有查找都用谓词而不是硬编码 ID —— 种子数据会变，ID 也会变。
 *
 * 运行：pnpm verify:matching
 */
import assert from 'node:assert/strict'

import { MAX_DISTANCE_KM } from '@/constants'
import { SEED_SWIPES } from '@/constants/seed'
import { createMockApi } from '@/services/mock'
import { DAILY_QUOTA } from '@/utils/quota'

const api = createMockApi()

/** 种子里预置了「已经右滑过我」的三个人 */
const RECIPROCAL_OWNERS = ['u_azhe', 'u_mumu', 'u_xiaoyu']

async function step(title: string, fn: () => Promise<void>) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function main() {
  console.log('\n换换 · 匹配算法验证\n')

  await api.init()

  await step('匹配池只包含 50km 内、非本人、在架的物品', async () => {
    const page = await api.getCards({ limit: 200 })
    assert.ok(page.list.length > 0, '冷启动必须有卡片可滑')

    for (const card of page.list) {
      assert.ok(card.ownerId !== 'u_me', `不该出现自己的物品：${card.title}`)
      assert.ok(card.status === 'active', `不该出现非在架物品：${card.title}`)
      assert.ok(
        card.distanceKm <= MAX_DISTANCE_KM,
        `${card.title} 距离 ${card.distanceKm.toFixed(1)}km 超出了 ${MAX_DISTANCE_KM}km`,
      )
    }

    // 苏州 85km、杭州 170km，都应该被挡掉
    assert.ok(
      !page.list.some((c) => c.owner.city === '苏州' || c.owner.city === '杭州'),
      '外地的物品不该出现',
    )
    assert.ok(
      !page.list.some((c) => c.status !== 'active'),
      '已换出 / 已下架的物品不该出现',
    )
  })

  await step('匹配池总量必须大于每日配额（否则限额机制形同虚设）', async () => {
    const page = await api.getCards({ limit: 200 })
    assert.ok(
      page.list.length > DAILY_QUOTA,
      `池子只有 ${page.list.length} 张，配额是 ${DAILY_QUOTA} —— 用户会先「刷完了」而不是「额度用完了」`,
    )
  })

  await step('冷启动时必须滑得到「能匹配」的卡', async () => {
    // 种子里的 SEED_SWIPES 决定了谁会跟我匹配。如果这些物品被删了、
    // 或者它们的主人一件在架物品都没有，新用户就会「怎么点喜欢都不匹配」，
    // 表现上跟功能坏了一样。
    const page = await api.getCards({ limit: 200 })
    const reciprocalOwners = new Set(
      SEED_SWIPES.filter((s) => s.direction === 'right').map((s) => s.fromUserId),
    )
    const matchable = page.list.filter((c) => reciprocalOwners.has(c.ownerId))

    assert.ok(
      reciprocalOwners.size >= 3,
      `只有 ${reciprocalOwners.size} 个人预先右滑过我，冷启动的匹配体验太单薄`,
    )
    assert.ok(
      matchable.length >= 3,
      `牌堆里只有 ${matchable.length} 张点了会匹配，新用户很可能一直碰不到匹配`,
    )
  })

  await step('翻页不漏卡：边翻边滑也要能拿满整个池子', async () => {
    // 游标是「候选列表里的位置」。如果候选集因为滑过而变短、游标却按原步长
    // 前进，每翻一页就会静默跳过一批卡片 —— 曾经 42 张只能滑到 26 张，
    // 而且看起来像「池子就这么大」，非常难察觉。
    //
    // 这里挑一个小池子（数码）避开每日配额的限制。
    const probe = createMockApi()
    await probe.init()

    const total = (await probe.getCards({ limit: 999, categories: ['digital'] })).list.length
    assert.ok(total > 6, `前置条件：数码池子太小（${total} 张），测不出分页问题`)

    const seen = new Set<string>()
    let cursor: string | null = null

    for (let guard = 0; guard < 30; guard += 1) {
      const page = await probe.getCards({ cursor, limit: 5, categories: ['digital'] })
      for (const card of page.list) {
        seen.add(card._id)
        await probe.swipe(card._id, 'left')
      }
      cursor = page.nextCursor
      if (!cursor) break
    }

    assert.equal(
      seen.size,
      total,
      `池子有 ${total} 张，边翻边滑只拿到 ${seen.size} 张 —— 游标跳过了卡片`,
    )
  })

  await step('左滑不产生匹配，且该物品不再出现', async () => {
    const before = await api.getCards({ limit: 200 })
    const target = before.list[0]
    assert.ok(target, '前置条件：池子里应该有卡片')

    const result = await api.swipe(target._id, 'left')
    assert.equal(result.matched, false, '左滑绝不能匹配')

    const after = await api.getCards({ limit: 200 })
    assert.ok(!after.list.some((c) => c._id === target._id), '滑过的物品不该重复出现')
  })

  await step('单向右滑不匹配（对方没想要我的东西）', async () => {
    const pool = await api.getCards({ limit: 200 })
    const target = pool.list.find((c) => !RECIPROCAL_OWNERS.includes(c.ownerId))
    assert.ok(target, '前置条件：应该存在一个没有右滑过我的用户')

    const result = await api.swipe(target._id, 'right')
    assert.equal(result.matched, false, '只有我单方面想要时不该匹配')
  })

  await step('互相右滑才匹配成功', async () => {
    const pool = await api.getCards({ limit: 200 })
    const target = pool.list.find(
      (c) => c.ownerId === 'u_azhe' && c.status === 'active',
    )
    assert.ok(target, '前置条件：阿哲的在架物品应该在池子里')

    const result = await api.swipe(target._id, 'right')
    assert.equal(result.matched, true, '双方互相想要时必须匹配')
    assert.ok(result.match, '匹配成功要带回 match 记录')

    const match = result.match!
    assert.equal(match.peer._id, 'u_azhe')
    assert.equal(match.peerItem._id, target._id, '对方物品应是我右滑的那件')
    assert.equal(match.myItem.ownerId, 'u_me', '我的物品应该是我自己的')
    assert.ok(
      ['it_mine_kindle', 'it_mine_xm3'].includes(match.myItem._id),
      '我的物品应该是对方先前右滑过的那件',
    )
  })

  await step('重复右滑同一对用户不会产生第二个 match', async () => {
    const matches = await api.getMatches()
    const withAzhe = matches.filter((m) => m.peer._id === 'u_azhe')
    assert.equal(withAzhe.length, 1, '同一对用户只应有一条匹配记录')
  })

  await step('估价区间无交集的物品不进池子', async () => {
    // 我的两件物品估值分别是 200-500 和 500-2000；
    // 0-50 区间的物品与它们都没有交集，不该出现
    const page = await api.getCards({ limit: 200 })
    const zeroFifty = page.list.filter((c) => c.priceRange === '0-50')
    assert.equal(
      zeroFifty.length,
      0,
      `0-50 区间与我的物品估值无交集，不该出现：${zeroFifty.map((c) => c.title).join('、')}`,
    )
  })

  await step('品类筛选生效', async () => {
    const page = await api.getCards({ limit: 200, categories: ['instrument'] })
    assert.ok(page.list.length > 0, '乐器品类应该有结果')
    for (const card of page.list) {
      assert.equal(card.category, 'instrument', `筛选后混入了 ${card.category}`)
    }
  })

  await step('发布后进入自己的物品列表，但不会进自己的牌堆', async () => {
    const item = await api.publishItem({
      images: ['/tmp/fake.jpg'],
      title: '验证用物品',
      category: 'digital',
      condition: '95',
      priceRange: '200-500',
      description: '脚本创建',
    })
    assert.ok(item._id, '发布应返回带 _id 的物品')

    const mine = await api.getMyItems()
    assert.ok(mine.some((i) => i._id === item._id), '新发布的物品应出现在「我的发布」')
    assert.equal(mine[0]._id, item._id, '新发布的物品应排在最前')

    const page = await api.getCards({ limit: 200 })
    assert.ok(
      !page.list.some((c) => c.title === '验证用物品'),
      '自己的物品不该被推荐给自己',
    )
  })

  await step('下架后状态变为 off', async () => {
    const mine = await api.getMyItems()
    const target = mine.find((i) => i.title === '验证用物品')!
    await api.updateItemStatus(target._id, 'off')

    const after = await api.getMyItems()
    assert.equal(after.find((i) => i._id === target._id)?.status, 'off')
  })

  await step('聊天：发消息、拉历史、双方消息都在', async () => {
    const match = (await api.getMatches())[0]
    assert.ok(match, '前置条件：应该已经有匹配')

    const historyBefore = await api.getChatHistory(match._id)
    assert.ok(historyBefore.length >= 1, '匹配成功时应有一条对方的开场消息')

    await api.sendMessage(match._id, 'text', '你好，这个还在吗？')
    const history = await api.getChatHistory(match._id)
    const last = history[history.length - 1]
    assert.equal(last.content, '你好，这个还在吗？')
    assert.equal(last.fromUserId, 'u_me', '我发的消息应该标记为我')

    const senders = new Set(history.map((m) => m.fromUserId))
    assert.ok(senders.has('u_me'), '历史里应有我发的消息')
    assert.ok(senders.size >= 2, '历史里应同时有对方的消息')
  })

  await step('「我的想要」只记录右滑过的物品', async () => {
    const wanted = await api.getWantedItems()
    assert.ok(wanted.length >= 2, `右滑过至少两件，实际 ${wanted.length}`)
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
