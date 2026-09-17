/**
 * 聊天模块的验证。
 *
 * 这里要防的三件事都不会报错，只会让聊天「怪怪的」：
 * - sendMessage 不回传完整消息 → 乐观渲染的临时消息换不掉 → watch 推来时重复一条
 * - 分页取错方向或不去重 → 上拉加载后消息重复或顺序颠倒
 * - 时间戳规则写错 → 每行都顶着时间，或者完全不显示
 *
 * 运行：pnpm verify:chat
 */
import assert from 'node:assert/strict'

import { CHAT_PAGE_SIZE } from '@/constants'
import { createMockApi } from '@/services/mock'
import type { ChatMessage } from '@/types'
import { TIME_GAP_MS, shouldShowTime } from '@/utils/chat'

async function step(title: string, fn: () => Promise<void> | void) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function main() {
  console.log('\n换换 · 聊天模块验证\n')

  const api = createMockApi()
  await api.login()

  // 先造一个匹配：右滑一个预先喜欢过我的人
  const cards = (await api.getCards({ page: 1, pageSize: 50 })).cards
  const target = cards.find((c) => c.ownerId === 'u_azhe')
  assert.ok(target, '前置条件：阿哲的物品应该在池子里')
  const swipe = await api.swipe({
    toItemId: target._id,
    toUserId: target.ownerId,
    direction: 'right',
  })
  assert.ok(swipe.matchId, '前置条件：应该匹配成功')
  const matchId = swipe.matchId!

  await step('进入页面能拉到历史（含对方开场消息）', async () => {
    const res = await api.getChatHistory({ matchId, page: 1 })
    assert.equal(res.success, true)
    assert.ok(res.messages.length >= 1, '匹配成功时应有一条对方的开场消息')
    assert.equal(res.messages[0].senderId, 'u_azhe', '开场消息应该来自对方')
  })

  await step('时间正序返回（页面拿到就能直接渲染）', async () => {
    const { messages } = await api.getChatHistory({ matchId, page: 1 })
    for (let i = 1; i < messages.length; i += 1) {
      assert.ok(
        messages[i - 1].createdAt <= messages[i].createdAt,
        '聊天记录必须按时间正序返回',
      )
    }
  })

  let sent: ChatMessage | undefined

  await step('sendMessage 回传完整消息（乐观更新靠它替换临时那条）', async () => {
    const res = await api.sendMessage({ matchId, content: '你好，这个还在吗？', type: 'text' })
    assert.equal(res.success, true)
    assert.ok(res.messageId, '要返回 messageId')
    assert.ok(res.message, '必须回传完整消息 —— 否则本地乐观渲染的那条换不掉')

    // 这条是去重能生效的关键：临时 id 被替换成这个 _id 之后，
    // watch 推来同一条时才能按 _id 跳过
    assert.equal(res.message!._id, res.messageId, 'message._id 必须等于 messageId')
    assert.equal(res.message!.senderId, 'u_me')
    assert.equal(res.message!.type, 'text')
    assert.deepEqual(res.message!.content, '你好，这个还在吗？')
    assert.ok(res.message!.createdAt > 0)

    sent = res.message
  })

  await step('订阅推送的消息 _id 与返回值一致（去重的前提）', async () => {
    const received: ChatMessage[] = []
    const off = api.subscribe(matchId, (msg) => received.push(msg))

    const res = await api.sendMessage({ matchId, content: '我这边周末都行', type: 'text' })
    off()

    assert.equal(received.length, 1, '发一条应该只推一条')
    assert.equal(
      received[0]._id,
      res.message?._id,
      '推送的 _id 和返回值不一致的话，页面按 _id 去重会失效，消息会重复显示',
    )
  })

  await step('历史里能看到自己刚发的消息', async () => {
    const { messages } = await api.getChatHistory({ matchId, page: 1 })
    assert.ok(
      messages.some((m) => m._id === sent!._id),
      '刚发的消息应该已经在历史里',
    )
    const senders = new Set(messages.map((m) => m.senderId))
    assert.ok(senders.has('u_me') && senders.has('u_azhe'), '双方消息都要有')
  })

  await step('分页：上拉加载更早的消息，不重不漏且保持正序', async () => {
    // 补到超过两页，才测得出翻页
    const total = CHAT_PAGE_SIZE + 12
    const existing = (await api.getChatHistory({ matchId, page: 1 })).messages.length
    for (let i = existing; i < total; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await api.sendMessage({ matchId, content: `压测消息 ${i}`, type: 'text' })
    }

    const page1 = (await api.getChatHistory({ matchId, page: 1 })).messages
    const page2 = (await api.getChatHistory({ matchId, page: 2 })).messages

    assert.equal(page1.length, CHAT_PAGE_SIZE, `第 1 页应该是 ${CHAT_PAGE_SIZE} 条`)
    assert.ok(page2.length > 0, '第 2 页应该有更早的消息')

    // 第 2 页全部早于第 1 页
    const oldestOfPage1 = page1[0].createdAt
    for (const m of page2) {
      assert.ok(m.createdAt <= oldestOfPage1, '第 2 页应该都是更早的消息')
    }

    // 拼起来（更早的在前）应该正好是完整的时间正序，且没有重复
    const merged = [...page2, ...page1]
    const ids = merged.map((m) => m._id)
    assert.equal(new Set(ids).size, ids.length, '两页之间有重复消息')
    for (let i = 1; i < merged.length; i += 1) {
      assert.ok(merged[i - 1].createdAt <= merged[i].createdAt, '拼接后不是时间正序')
    }
  })

  await step('图片消息：content 存的是可渲染地址，type 为 image', async () => {
    const res = await api.sendMessage({ matchId, content: 'cloud://fake-file-id', type: 'image' })
    assert.equal(res.success, true)
    assert.equal(res.message?.type, 'image')
    assert.equal(res.message?.content, 'cloud://fake-file-id')

    const { messages } = await api.getChatHistory({ matchId, page: 1 })
    const image = messages.find((m) => m._id === res.message?._id)
    assert.ok(image, '图片消息应该出现在历史里')
  })

  await step('不是会话参与者不能发言', async () => {
    const res = await api.sendMessage({ matchId: 'no_such_match', content: 'hi', type: 'text' })
    assert.equal(res.success, false, '不存在的会话不该发得出去')
  })

  await step('同一毫秒内连发的消息，最新的一条必须在第 1 页', async () => {
    /*
      把时钟冻住，强制所有消息的 createdAt 完全相等 ——
      不冻的话这条断言靠运气（每条耗时偶然超过 1ms 就测不出来了）。

      相等时如果排序不是全序，sort 会保持插入顺序（旧在前），
      slice(0, 50) 就把「最旧的 50 条」当成「第 1 页 = 最新」，
      分页整个反过来，刚发的消息掉进第 2 页。
    */
    const realNow = Date.now
    // 定在「现在往后一点」：必须比前面所有消息都新。
    // 这条放最后跑，所以不会影响后面任何断言。
    Date.now = () => realNow() + 60_000
    let last: ChatMessage | undefined
    try {
      for (let i = 0; i < CHAT_PAGE_SIZE + 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await api.sendMessage({ matchId, content: `连发 ${i}`, type: 'text' })
        last = res.message
      }
    } finally {
      Date.now = realNow
    }

    const { messages } = await api.getChatHistory({ matchId, page: 1 })
    assert.equal(messages.length, CHAT_PAGE_SIZE, `第 1 页应该是 ${CHAT_PAGE_SIZE} 条`)
    assert.ok(
      messages.some((m) => m._id === last!._id),
      '刚发的消息必须在第 1 页里 —— 不在的话说明排序不是全序，分页反了',
    )
    assert.equal(
      messages[messages.length - 1]._id,
      last!._id,
      '最新的一条应该是第 1 页的最后一条',
    )

    // 同一毫秒内也要保持插入顺序，不能乱
    const burst = messages.filter((m) => m.content.startsWith('连发 '))
    const seq = burst.map((m) => Number(m.content.replace('连发 ', '')))
    for (let i = 1; i < seq.length; i += 1) {
      assert.ok(seq[i - 1] < seq[i], `同一毫秒内连发的顺序乱了：${seq.join(',')}`)
    }
  })

  await step('时间戳规则：超过 5 分钟才单独显示', () => {
    const base = { createdAt: 1_000_000_000_000 }
    const after = (ms: number) => ({ createdAt: base.createdAt + ms })

    assert.equal(shouldShowTime(base), true, '第一条必须显示时间')
    assert.equal(shouldShowTime(after(30_000), base), false, '30 秒内不显示')
    assert.equal(shouldShowTime(after(TIME_GAP_MS), base), false, '刚好 5 分钟不显示')
    assert.equal(shouldShowTime(after(TIME_GAP_MS + 1), base), true, '超过 5 分钟要显示')
    assert.equal(shouldShowTime(after(2 * 3600_000), base), true, '隔了两小时当然要显示')
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
