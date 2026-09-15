const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const swipes = db.collection('swipes')
const matches = db.collection('matches')

const { DAILY_QUOTA, buildQuota, currentUsed } = require('./quota')

/**
 * 匹配成功订阅消息模板 ID。
 * 在微信公众平台「订阅消息」里申请后填到这里，留空则跳过推送。
 */
const MATCH_TEMPLATE_ID = ''

/**
 * swipe — 记录滑动，右滑时判断是否双向匹配。
 *
 * 入参：{ toItemId, toUserId, direction }
 * 出参：{ matched, matchId?, otherUser?, quota? }
 *
 * 判定规则：A 右滑了 B 的物品 X，且 B 之前右滑过 A 的任一物品 Y，
 * 则 (A,X) 与 (B,Y) 组成一次匹配。
 *
 * 这段逻辑和 src/services/mock.ts 里的实现必须保持一致 ——
 * Mock 只是本地预览，真实判定以这里为准，客户端不写 swipes / matches。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { toItemId, direction } = event

  if (!toItemId || (direction !== 'left' && direction !== 'right')) {
    return { ok: false, message: '参数不合法' }
  }

  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  const targetRes = await items.doc(toItemId).get().catch(() => null)
  const target = targetRes && targetRes.data
  if (!target) return { ok: false, message: '物品不存在' }
  if (target.ownerId === me._id) return { ok: false, message: '不能滑自己的物品' }

  const now = Date.now()

  // 幂等检查要放在扣额度**之前**。
  // 客户端重试、或牌堆状态陈旧时会重复提交同一张卡，如果先扣额度，
  // 用户会白丢一次额度却根本没看到新卡。
  const existed = await swipes.where({ fromUserId: me._id, toItemId }).limit(1).get()
  if (existed.data.length) {
    return { ok: true, data: { matched: false, quota: await readQuota(me, now) } }
  }

  // 左滑跳过和右滑想要都消耗额度：额度就是「每天能看多少张卡」
  const gate = await consumeOne(me, now)
  if (!gate.allowed) {
    // 额度用完就整条不记录：否则用户明天回来会发现物品被「偷偷」
    // 跳过了，而他并没有真的做过选择
    return { ok: true, data: { matched: false, quota: buildQuota(gate.used, now) } }
  }

  await swipes.add({
    data: {
      fromUserId: me._id,
      toItemId,
      toUserId: target.ownerId,
      direction,
      createdAt: now,
    },
  })

  if (direction === 'left') {
    return { ok: true, data: { matched: false, quota: await readQuota(me, now) } }
  }

  // 对方有没有右滑过我的任一物品
  const myItemRes = await items.where({ ownerId: me._id }).field({ _id: true }).limit(100).get()
  const myItemIds = myItemRes.data.map((i) => i._id)
  if (!myItemIds.length) {
    return { ok: true, data: { matched: false, quota: await readQuota(me, now) } }
  }

  const reciprocalRes = await swipes
    .where({
      fromUserId: target.ownerId,
      toItemId: _.in(myItemIds),
      direction: 'right',
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()

  const reciprocal = reciprocalRes.data[0]
  if (!reciprocal) {
    return { ok: true, data: { matched: false, quota: await readQuota(me, now) } }
  }

  // 同一对用户只保留一条匹配记录
  const dupRes = await matches
    .where(
      _.or([
        { userA: me._id, userB: target.ownerId },
        { userA: target.ownerId, userB: me._id },
      ]),
    )
    .limit(1)
    .get()

  let match = dupRes.data[0]

  if (!match) {
    const doc = {
      userA: me._id,
      userB: target.ownerId,
      // itemA 是 userA 右滑的物品，itemB 是 userB 右滑的物品
      itemA: toItemId,
      itemB: reciprocal.toItemId,
      createdAt: now,
      lastMessageAt: now,
    }
    const added = await matches.add({ data: doc })
    match = { _id: added._id, ...doc }
    await notifyBoth(match, me, target.ownerId)
  }

  const peerRes = await users.doc(target.ownerId).get().catch(() => null)
  const peer = peerRes && peerRes.data
  const otherUser = peer
    ? { _id: peer._id, nickname: peer.nickname, avatarUrl: peer.avatarUrl, city: peer.city }
    : undefined

  return {
    ok: true,
    data: {
      matched: true,
      matchId: match._id,
      otherUser,
      quota: await readQuota(me, now),
    },
  }
}

/** 读一次配额（不消耗），用于回包 */
async function readQuota(me, now) {
  const fresh = await users.doc(me._id).get().catch(() => null)
  const doc = (fresh && fresh.data) || me
  return buildQuota(currentUsed(doc, now).used, now)
}

/**
 * 消耗一次额度。用事务做「检查 + 自增」，防止连点超发。
 *
 * runTransaction 在某些环境下不可用，退化成非事务的「先读后写」：
 * 并发连点理论上可能多算一次，但客户端已经做了手势锁，这里只作兜底。
 */
async function consumeOne(me, now) {
  const { dayKey } = currentUsed(me, now)

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.collection('users').doc(me._id).get()
      const current = currentUsed((doc && doc.data) || me, now)
      if (current.used >= DAILY_QUOTA) {
        return { allowed: false, used: current.used }
      }
      const used = current.used + 1
      await transaction
        .collection('users')
        .doc(me._id)
        .update({ data: { quota: { dayKey, used, updatedAt: now } } })
      return { allowed: true, used }
    })
  } catch (err) {
    console.warn('配额事务不可用，退化为非事务写入', err && err.errMsg)
    const fresh = await users.doc(me._id).get().catch(() => null)
    const current = currentUsed((fresh && fresh.data) || me, now)
    if (current.used >= DAILY_QUOTA) {
      return { allowed: false, used: current.used }
    }
    const used = current.used + 1
    await users.doc(me._id).update({ data: { quota: { dayKey, used, updatedAt: now } } })
    return { allowed: true, used }
  }
}

async function notifyBoth(match, me, peerId) {
  if (!MATCH_TEMPLATE_ID) return

  const peerRes = await users.doc(peerId).get().catch(() => null)
  const peer = peerRes && peerRes.data
  if (!peer) return

  const peerItemRes = await items.doc(match.itemA).get().catch(() => null)
  const myItemRes = await items.doc(match.itemB).get().catch(() => null)

  const base = {
    templateId: MATCH_TEMPLATE_ID,
    miniprogramState: 'formal',
    lang: 'zh_CN',
  }

  const payloads = [
    {
      touser: me._openid,
      page: `pages/chat/index?matchId=${match._id}`,
      data: {
        thing1: { value: peerItemRes?.data?.title?.slice(0, 20) || '对方的物品' },
        thing2: { value: peer.nickname?.slice(0, 20) || '对方' },
      },
    },
    {
      touser: peer._openid,
      page: `pages/chat/index?matchId=${match._id}`,
      data: {
        thing1: { value: myItemRes?.data?.title?.slice(0, 20) || '你的物品' },
        thing2: { value: me.nickname?.slice(0, 20) || '有人' },
      },
    },
  ]

  // 订阅消息是「锦上添花」：没订阅额度或模板没配好，都不能影响匹配本身
  await Promise.all(
    payloads.map((p) =>
      cloud.openapi.subscribeMessage.send({ ...base, ...p }).catch((err) => {
        console.warn('订阅消息发送失败', err && err.errCode, err && err.errMsg)
      }),
    ),
  )
}
