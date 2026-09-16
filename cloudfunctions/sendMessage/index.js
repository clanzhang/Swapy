const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const users = db.collection('users')
const matches = db.collection('matches')
const messages = db.collection('messages')

/**
 * sendMessage — 发送聊天消息。
 *
 * 入参：{ matchId, content, type }，type 为 text 或 image
 * 出参：{ success, messageId? }
 *
 * 消息写在**独立的 messages 集合**里，不嵌在 matches 文档里 ——
 * 这样能按 matchId 分页查询，也能被客户端 watch 订阅，
 * 而且不会撞上单文档 16MB 的上限。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId, content, type } = event

  if (!matchId) return { ok: true, data: { success: false, error: '缺少 matchId' } }
  if (type !== 'text' && type !== 'image') {
    return { ok: true, data: { success: false, error: '消息类型不合法' } }
  }
  if (typeof content !== 'string' || !content) {
    return { ok: true, data: { success: false, error: '消息内容为空' } }
  }

  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: true, data: { success: false, error: '用户不存在，请先登录' } }

  const matchRes = await matches.doc(matchId).get().catch(() => null)
  const match = matchRes && matchRes.data
  if (!match) return { ok: true, data: { success: false, error: '会话不存在' } }
  // 只有会话双方能发言
  if (match.userA !== me._id && match.userB !== me._id) {
    return { ok: true, data: { success: false, error: '无权在该会话发言' } }
  }

  const now = Date.now()
  const doc = {
    matchId,
    senderId: me._id,
    content: type === 'text' ? content.slice(0, 1000) : content,
    type,
    createdAt: now,
  }

  const res = await messages.add({ data: doc })
  const message = { _id: res._id, ...doc }
  // matches 上留个时间戳，用于会话列表排序
  await matches.doc(matchId).update({ data: { lastMessageAt: now } })

  // 多回传一份完整消息：客户端要先乐观渲染，再拿真实 _id 把临时那条替换掉，
  // 这样 watch 推来同一条时才能按 _id 去重
  return { ok: true, data: { success: true, messageId: res._id, message } }
}
