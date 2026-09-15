const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const matches = db.collection('matches')

/**
 * 匹配列表。
 *
 * 传了 matchId 就只返回这一条（聊天页进来时用），
 * 不传则返回我的全部匹配（匹配列表页用）。
 *
 * 客户端拿到的永远是「我」的视角：myItem / peerItem 已经把
 * userA / userB 的对称结构翻译好了，页面不需要知道自己是 A 还是 B。
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
  return { ok: true, data: views.filter(Boolean) }
}

async function buildView(match, meId) {
  const isA = match.userA === meId
  const peerId = isA ? match.userB : match.userA
  const myItemId = isA ? match.itemB : match.itemA
  const peerItemId = isA ? match.itemA : match.itemB

  const [peerRes, myItemRes, peerItemRes] = await Promise.all([
    users.doc(peerId).get().catch(() => null),
    items.doc(myItemId).get().catch(() => null),
    items.doc(peerItemId).get().catch(() => null),
  ])

  if (!peerRes || !myItemRes || !peerItemRes) return null

  const messages = match.messages || []

  return {
    _id: match._id,
    createdAt: match.createdAt,
    peer: peerRes.data,
    myItem: myItemRes.data,
    peerItem: peerItemRes.data,
    lastMessage: messages[messages.length - 1],
  }
}
