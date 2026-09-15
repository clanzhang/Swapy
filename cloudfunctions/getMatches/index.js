const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const matches = db.collection('matches')
const messages = db.collection('messages')

/**
 * getMatches — 当前用户的全部匹配记录。
 *
 * 入参：无（从上下文取 openid），可选 matchId 只取一条。
 * 出参：{ matches: [{ matchId, otherUser, myItem, otherItem, createdAt, lastMessage? }] }
 *
 * 返回值已经把 userA / userB 的对称结构翻译成「我」的视角，
 * 页面不需要知道自己是 A 还是 B。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  let list = []

  if (event.matchId) {
    const res = await matches.doc(event.matchId).get().catch(() => null)
    const match = res && res.data
    // 只允许读自己参与的会话
    if (match && (match.userA === me._id || match.userB === me._id)) {
      list = [match]
    }
  } else {
    const res = await matches
      .where(_.or([{ userA: me._id }, { userB: me._id }]))
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get()
    list = res.data
  }

  const views = await Promise.all(list.map((match) => buildView(match, me._id)))
  return { ok: true, data: { matches: views.filter(Boolean) } }
}

async function buildView(match, meId) {
  const isA = match.userA === meId
  const peerId = isA ? match.userB : match.userA
  const myItemId = isA ? match.itemB : match.itemA
  const otherItemId = isA ? match.itemA : match.itemB

  const [peerRes, myItemRes, otherItemRes, lastMsgRes] = await Promise.all([
    users.doc(peerId).get().catch(() => null),
    items.doc(myItemId).get().catch(() => null),
    items.doc(otherItemId).get().catch(() => null),
    messages
      .where({ matchId: match._id })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
      .catch(() => null),
  ])

  if (!peerRes || !myItemRes || !otherItemRes) return null

  const peer = peerRes.data
  const lastMessage = lastMsgRes && lastMsgRes.data[0]

  return {
    matchId: match._id,
    createdAt: match.createdAt,
    otherUser: {
      _id: peer._id,
      nickname: peer.nickname,
      avatarUrl: peer.avatarUrl,
      city: peer.city,
    },
    myItem: myItemRes.data,
    otherItem: otherItemRes.data,
    // 规格外的可选字段，列表页做消息预览用
    ...(lastMessage ? { lastMessage } : {}),
  }
}
