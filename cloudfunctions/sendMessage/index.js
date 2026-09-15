const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const matches = db.collection('matches')

/**
 * 发送聊天消息。
 *
 * 消息直接 push 进 matches 文档的 messages 数组，客户端用
 * db.collection('matches').doc(id).watch() 就能拿到实时推送，
 * 一对一会话不需要额外的长连接服务。
 *
 * 上限提醒：单个文档 16MB。按一条消息 ~200B 算，能存约 8 万条，
 * 一对一的闲置交换场景够用。真要做大，把 messages 拆成独立集合并
 * 只把最近一条冗余在 match 上。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId, type, content } = event

  if (!matchId) return { ok: false, message: '缺少 matchId' }
  if (type !== 'text' && type !== 'image') return { ok: false, message: '消息类型不合法' }
  if (typeof content !== 'string' || !content) return { ok: false, message: '消息内容为空' }

  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  const matchRes = await matches.doc(matchId).get().catch(() => null)
  const match = matchRes && matchRes.data
  if (!match) return { ok: false, message: '会话不存在' }
  if (match.userA !== me._id && match.userB !== me._id) {
    return { ok: false, message: '无权在该会话发言' }
  }

  const now = Date.now()
  const message = {
    _id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    matchId,
    fromUserId: me._id,
    type,
    content: type === 'text' ? content.slice(0, 1000) : content,
    createdAt: now,
  }

  await matches.doc(matchId).update({
    data: {
      messages: _.push([message]),
      lastMessageAt: now,
    },
  })

  return { ok: true, data: message }
}
