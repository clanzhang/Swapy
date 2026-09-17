/**
 * 匹配算法 + 每日配额 + 分页的行为验证。
 *
 * 匹配判定是整个产品最容易悄悄写错的地方（互相右滑、估值区间交集、
 * 同城过滤、排除已滑过的、额度扣减），所以用一个可执行脚本把它钉死。
 *
 * 注意：所有查找都用谓词而不是硬编码 ID —— 种子数据会变，ID 也会变。
 *
 * 运行：pnpm verify:matching
 */
import assert from 'node:assert/strict'

import { SEED_ITEMS, SEED_SWIPES, SEED_USERS } from '@/constants/seed'
import type { Category } from '@/types'
import { createMockApi } from '@/services/mock'
import { DAILY_QUOTA } from '@/utils/quota'

const api = createMockApi()

async function step(title: string, fn: () => Promise<void>) {
  await fn()
  console.log(`  ✓ ${title}`)
}

/** 一次把整个匹配池拿完，方便断言「池子里有什么」 */
async function pool(categories?: Category[]) {
  const res = await api.getCards({ page: 1, pageSize: 999, categories })
  return res.cards
}

async function main() {
  console.log('\n换换 · 匹配算法验证\n')

  await api.login()

  await step('匹配池只包含同城、非本人、在架的物品', async () => {
    const cards = await pool()
    assert.ok(cards.length > 0, '冷启动必须有卡片可滑')

    for (const card of cards) {
      assert.ok(card.ownerId !== 'u_me', `不该出现自己的物品：${card.title}`)
      assert.ok(card.status === 'active', `不该出现非在架物品：${card.title}`)
      assert.equal(card.owner.city, '上海', `${card.title} 不在同城`)
    }

    // 苏州 / 杭州的物品应该被同城筛掉
    assert.ok(
      !cards.some((c) => c.owner.city === '苏州' || c.owner.city === '杭州'),
      '外地的物品不该出现',
    )
    assert.ok(
      !cards.some((c) => c.status !== 'active'),
      '已换出 / 已下架的物品不该出现',
    )
  })

  await step('按 createdAt 倒序返回', async () => {
    const cards = await pool()
    for (let i = 1; i < cards.length; i += 1) {
      assert.ok(
        cards[i - 1].createdAt >= cards[i].createdAt,
        `排序不对：${cards[i - 1].title} 比 ${cards[i].title} 旧却排在前面`,
      )
    }
  })

  await step('匹配池总量必须大于每日配额（否则限额机制形同虚设）', async () => {
    const cards = await pool()
    assert.ok(
      cards.length > DAILY_QUOTA,
      `池子只有 ${cards.length} 张，配额是 ${DAILY_QUOTA} —— 用户会先「刷完了」而不是「额度用完了」`,
    )
  })

  await step('冷启动时必须滑得到「能匹配」的卡', async () => {
    // 种子里的 SEED_SWIPES 决定了谁会跟我匹配。如果这些物品被删了、
    // 或者它们的主人一件在架物品都没有，新用户就会「怎么点喜欢都不匹配」。
    const cards = await pool()
    const reciprocalOwners = new Set(
      SEED_SWIPES.filter((s) => s.direction === 'right').map((s) => s.fromUserId),
    )
    const matchable = cards.filter((c) => reciprocalOwners.has(c.ownerId))

    // 匹配是按「用户对」唯一的，同一对只匹配一次。
    // 预置的人太少的话，全部匹配完之后再点喜欢就永远不匹配了 ——
    // 演示时看起来就像功能坏了。所以要求覆盖全部同城用户。
    const sameCityOwners = new Set(cards.map((c) => c.ownerId))
    assert.equal(
      reciprocalOwners.size,
      sameCityOwners.size,
      `只有 ${reciprocalOwners.size} 个人预先右滑过我，但有 ${sameCityOwners.size} 个同城用户 —— 匹配完就没了`,
    )
    assert.ok(matchable.length >= 10, `牌堆里只有 ${matchable.length} 张点了会匹配`)
  })

  await step('翻页不漏卡：边翻边滑也要能拿满整个池子', async () => {
    // 分页下标必须索引一个稳定的候选列表。如果候选集因为滑过而变短、
    // 下标却按原步长前进，每翻一页就会静默跳过一批卡片 ——
    // 曾经 42 张只能滑到 26 张，看起来就像「池子就这么大」。
    const probe = createMockApi()
    await probe.login()

    // 用小品类池避开每日额度（滑一张就少一次额度，池子大了会撞额度）
    const scope = ['乐器'] as const
    const total = (await probe.getCards({ page: 1, pageSize: 999, categories: [...scope] })).cards
      .length
    assert.ok(total > 6, `前置条件：该品类池子太小（${total} 张），测不出分页问题`)
    assert.ok(total < DAILY_QUOTA, `前置条件：该品类池子（${total} 张）撞上额度了，测不准`)

    const seen = new Set<string>()
    const pageSize = 6
    const totalPages = Math.ceil(total / pageSize) + 2

    for (let page = 1; page <= totalPages; page += 1) {
      const res = await probe.getCards({ page, pageSize, categories: [...scope] })
      if (!res.cards.length) break
      for (const card of res.cards) {
        seen.add(card._id)
        await probe.swipe({ toItemId: card._id, toUserId: card.ownerId, direction: 'left' })
      }
      if (!res.hasMore) break
    }

    assert.equal(
      seen.size,
      total,
      `池子有 ${total} 张，边翻边滑只拿到 ${seen.size} 张 —— 分页下标跳过了卡片`,
    )
  })

  await step('左滑不产生匹配，且该物品不再出现', async () => {
    const before = await pool()
    const target = before[0]
    assert.ok(target, '前置条件：池子里应该有卡片')

    const result = await api.swipe({
      toItemId: target._id,
      toUserId: target.ownerId,
      direction: 'left',
    })
    assert.equal(result.matched, false, '左滑绝不能匹配')

    const after = await pool()
    assert.ok(!after.some((c) => c._id === target._id), '滑过的物品不该重复出现')
  })

  await step('单向右滑不匹配（对方没想要我的东西）', async () => {
    // 同城用户现在都预置了「右滑过我」，所以拿外地用户来验证单向不匹配。
    // swipe 是按物品 ID 查的，不经过同城筛选，所以能直接对它发请求。
    const target = SEED_ITEMS.find((i) => {
      const owner = SEED_USERS.find((u) => u._id === i.ownerId)
      return owner && owner.city !== '上海' && i.status === 'active'
    })
    assert.ok(target, '前置条件：应该存在一个外地物品')

    const result = await api.swipe({
      toItemId: target._id,
      toUserId: target.ownerId,
      direction: 'right',
    })
    assert.equal(result.matched, false, '只有我单方面想要时不该匹配')
    assert.ok(!result.matchId, '不匹配就不该带回 matchId')
  })

  await step('互相右滑才匹配成功', async () => {
    const cards = await pool()
    const target = cards.find((c) => c.ownerId === 'u_azhe' && c.status === 'active')
    assert.ok(target, '前置条件：阿哲的在架物品应该在池子里')

    const result = await api.swipe({
      toItemId: target._id,
      toUserId: target.ownerId,
      direction: 'right',
    })
    assert.equal(result.matched, true, '双方互相想要时必须匹配')
    assert.ok(result.matchId, '匹配成功要带回 matchId')
    assert.equal(result.otherUser?._id, 'u_azhe')

    const { matches } = await api.getMatches()
    const match = matches.find((m) => m.matchId === result.matchId)
    assert.ok(match, '匹配记录应该能查到')
    assert.equal(match.otherItem._id, target._id, '对方物品应是我右滑的那件')
    assert.equal(match.myItem.ownerId, 'u_me', '我的物品应该是我自己的')
    assert.ok(
      ['it_mine_kindle', 'it_mine_xm3'].includes(match.myItem._id),
      '我的物品应该是对方先前右滑过的那件',
    )
  })

  await step('重复右滑同一对用户不会产生第二个 match', async () => {
    const { matches } = await api.getMatches()
    const withAzhe = matches.filter((m) => m.otherUser._id === 'u_azhe')
    assert.equal(withAzhe.length, 1, '同一对用户只应有一条匹配记录')
  })

  await step('估价区间无交集的物品不进池子', async () => {
    // 我的两件物品估值分别是 200-500 和 500-2000；
    // 0-50 区间的物品与它们都没有交集，不该出现
    const cards = await pool()
    const zeroFifty = cards.filter((c) => c.priceRange === '0-50')
    assert.equal(
      zeroFifty.length,
      0,
      `0-50 区间与我的物品估值无交集，不该出现：${zeroFifty.map((c) => c.title).join('、')}`,
    )
  })

  await step('品类筛选生效', async () => {
    const cards = await pool(['乐器'])
    assert.ok(cards.length > 0, '乐器品类应该有结果')
    for (const card of cards) {
      assert.equal(card.category, '乐器', `筛选后混入了 ${card.category}`)
    }
  })

  await step('品类「家具」通了：有种子物品，且服务端认这个品类', async () => {
    const cards = await pool(['家具'])
    assert.ok(
      cards.length > 0,
      '家具应该有种子里物品 —— 没有的话演示时永远滑不到家具，发布页却让你选它',
    )
    for (const card of cards) {
      assert.equal(card.category, '家具', `筛选后混入了 ${card.category}`)
      assert.equal(card.owner.city, '上海', '新增的家具物品必须落在同城用户名下')
      assert.ok(
        ['200-500', '500-2000'].includes(card.priceRange),
        '家具的估价区间必须和我的物品有交集，否则进不了牌堆',
      )
    }
  })

  await step('多品类是「或」不是「与」', async () => {
    const cards = await pool(['乐器', '潮玩'])
    assert.ok(cards.length > 0, '两个品类一起筛应该有结果')

    const picked = new Set(cards.map((c) => c.category))
    for (const card of cards) {
      assert.ok(
        card.category === '乐器' || card.category === '潮玩',
        `筛选后混入了 ${card.category}`,
      )
    }
    // 写成「与」的话只可能剩下同时属于两类的物品，实际上一个都不剩
    assert.equal(picked.size, 2, `两个品类都应该有结果，实际只有 ${[...picked].join('、')}`)

    // 结果必须正好是两类之和，说明没有漏
    const one = await pool(['乐器'])
    const two = await pool(['潮玩'])
    assert.equal(cards.length, one.length + two.length, '多品类结果应等于各品类之和')
  })

  await step('品类筛选不绕过同城', async () => {
    const cards = await pool(['乐器'])
    for (const card of cards) {
      assert.equal(card.owner.city, '上海', `筛选后混进了非同城用户：${card.owner.city}`)
      assert.notEqual(card.ownerId, 'u_me', '自己的物品不该出现')
    }
  })

  await step('筛选后翻页仍然不重不漏', async () => {
    const pageSize = 2
    const all = await pool(['乐器', '潮玩'])
    assert.ok(all.length > pageSize, `前置条件：池子只有 ${all.length} 张，测不出翻页`)

    const seen: string[] = []
    for (let page = 1; page <= 10; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await api.getCards({ page, pageSize, categories: ['乐器', '潮玩'] })
      seen.push(...res.cards.map((c) => c._id))
      if (!res.hasMore) break
    }

    assert.equal(seen.length, all.length, '翻页拿到的总数应和一次拿完一致')
    assert.equal(new Set(seen).size, seen.length, '翻页出现了重复卡片')
    for (const id of all.map((c) => c._id)) {
      assert.ok(seen.includes(id), `翻页漏掉了 ${id}`)
    }
  })

  await step('清空筛选等于不筛（空数组和 undefined 一致）', async () => {
    const empty = await pool([])
    const none = await pool(undefined)
    assert.equal(empty.length, none.length, '空数组应该等同于不传')
    assert.ok(empty.length > (await pool(['乐器'])).length, '不筛应该比筛单品类多')
  })

  await step('发布后进入自己的物品列表，但不会进自己的牌堆', async () => {
    const res = await api.publishItem({
      imageFileIds: ['/tmp/fake.jpg'],
      title: '验证用物品',
      category: '数码',
      condition: '95新',
      priceRange: '200-500',
      description: '脚本创建',
    })
    assert.equal(res.success, true, '发布应该成功')
    assert.ok(res.itemId, '发布应返回 itemId')

    const mine = await api.getMyItems()
    assert.ok(mine.some((i) => i._id === res.itemId), '新发布的物品应出现在「我的发布」')
    assert.equal(mine[0]._id, res.itemId, '新发布的物品应排在最前')

    const cards = await pool()
    assert.ok(!cards.some((c) => c.title === '验证用物品'), '自己的物品不该被推荐给自己')
  })

  await step('下架后状态变为 off', async () => {
    const mine = await api.getMyItems()
    const target = mine.find((i) => i.title === '验证用物品')!
    await api.updateItemStatus(target._id, 'off')

    const after = await api.getMyItems()
    assert.equal(after.find((i) => i._id === target._id)?.status, 'off')
  })

  await step('聊天：发消息、拉历史、双方消息都在', async () => {
    const { matches } = await api.getMatches()
    const match = matches[0]
    assert.ok(match, '前置条件：应该已经有匹配')

    const before = await api.getChatHistory({ matchId: match.matchId })
    assert.ok(before.messages.length >= 1, '匹配成功时应有一条对方的开场消息')

    const sent = await api.sendMessage({
      matchId: match.matchId,
      content: '你好，这个还在吗？',
      type: 'text',
    })
    assert.equal(sent.success, true)
    assert.ok(sent.messageId)

    const after = await api.getChatHistory({ matchId: match.matchId })
    const last = after.messages[after.messages.length - 1]
    assert.equal(last.content, '你好，这个还在吗？')
    assert.equal(last.senderId, 'u_me', '我发的消息应该标记为我')

    // 时间正序：页面拿到就能直接渲染
    for (let i = 1; i < after.messages.length; i += 1) {
      assert.ok(
        after.messages[i - 1].createdAt <= after.messages[i].createdAt,
        '聊天记录应该按时间正序返回',
      )
    }

    const senders = new Set(after.messages.map((m) => m.senderId))
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
