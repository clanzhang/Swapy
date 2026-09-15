const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const swipes = db.collection('swipes')
const matches = db.collection('matches')

/**
 * 匹配成功订阅消息模板 ID。
 * 在微信公众平台「订阅消息」里申请后填到这里，留空则跳过推送。
 * 模板字段名（thing1 / thing2 / time3）要和模板实际字段一一对应。
 */
const MATCH_TEMPLATE_ID = ''

/**
 * 记录一次滑动，并判断是否达成交换匹配。
 *
 * 判定规则：A 右滑了 B 的物品 X，且 B 之前右滑过 A 的任一物品 Y，
 * 则 (A,X) 与 (B,Y) 组成一次匹配。
 *
 * 这段逻辑和客户端 src/services/mock.ts 里的实现必须保持一致 ——
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

  // 幂等：同一件物品重复滑只记一次，避免用户连点产生脏数据
  const existed = await swipes
    .where({ fromUserId: me._id, toItemId })
    .limit(1)
    .get()

  if (!existed.data.length) {
    await swipes.add({
      data: {
        fromUserId: me._id,
        toItemId,
        toUserId: target.ownerId,
        direction,
        createdAt: Date.now(),
      },
    })
  }

  if (direction === 'left') {
    return { ok: true, data: { matched: false } }
  }

  // 对方有没有右滑过我的任一物品
  const myItemRes = await items.where({ ownerId: me._id }).field({ _id: true }).limit(100).get()
  const myItemIds = myItemRes.data.map((i) => i._id)
  if (!myItemIds.length) {
    return { ok: true, data: { matched: false } }
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
    return { ok: true, data: { matched: false } }
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

  const now = Date.now()
  let match = dupRes.data[0]

  if (!match) {
    const doc = {
      userA: me._id,
      userB: target.ownerId,
      // itemA 是 userA 右滑的物品，itemB 是 userB 右滑的物品
      itemA: toItemId,
      itemB: reciprocal.toItemId,
      messages: [],
      createdAt: now,
      lastMessageAt: now,
    }
    const added = await matches.add({ data: doc })
    match = { _id: added._id, ...doc }
    await notifyBoth(match, me, target.ownerId)
  }

  return { ok: true, data: { matched: true, match: await buildMatchView(match, me._id) } }
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

async function buildMatchView(match, meId) {
  const isA = match.userA === meId
  const peerId = isA ? match.userB : match.userA
  const myItemId = isA ? match.itemB : match.itemA
  const peerItemId = isA ? match.itemA : match.itemB

  const [peerRes, myItemRes, peerItemRes] = await Promise.all([
    users.doc(peerId).get().catch(() => null),
    items.doc(myItemId).get().catch(() => null),
    items.doc(peerItemId).get().catch(() => null),
  ])

  const messages = match.messages || []

  return {
    _id: match._id,
    createdAt: match.createdAt,
    peer: peerRes && peerRes.data,
    myItem: myItemRes && myItemRes.data,
    peerItem: peerItemRes && peerItemRes.data,
    lastMessage: messages[messages.length - 1],
  }
}
