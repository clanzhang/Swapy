const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const users = db.collection('users')
const matches = db.collection('matches')
const messages = db.collection('messages')

/** 每页条数 */
const PAGE_SIZE = 50

/**
 * getChatHistory — 聊天记录，分页。
 *
 * 入参：{ matchId, page = 1 }
 * 出参：{ success, messages[] }
 *
 * 按 (createdAt, _id) 倒序取一页（page=1 就是最近 50 条），
 * 两个字段一起排是为了拿到全序 —— 只按 createdAt 的话，
 * 同毫秒的消息在翻页时可能重复或漏掉。
 * 再翻转为时间正序返回 —— 页面拿到就能直接渲染，往上翻页用 page+1。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId } = event

  if (!matchId) return { ok: true, data: { success: false, messages: [] } }

  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: true, data: { success: false, messages: [] } }

  const matchRes = await matches.doc(matchId).get().catch(() => null)
  const match = matchRes && matchRes.data
  if (!match) return { ok: true, data: { success: false, messages: [] } }
  // 只有会话双方能看
  if (match.userA !== me._id && match.userB !== me._id) {
    return { ok: true, data: { success: false, messages: [] } }
  }

  const page = Math.max(1, Number(event.page) || 1)

  const res = await messages
    .where({ matchId })
    .orderBy('createdAt', 'desc')
    // 次级排序不能省：createdAt 是毫秒精度，同一毫秒内的多条记录相对顺序
    // 不确定，skip/limit 翻页会重复或漏掉消息。_id 唯一，加上它就是全序。
    .orderBy('_id', 'desc')
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get()

  const list = res.data.slice().reverse()

  const senderIds = [...new Set(list.map((m) => m.senderId))]
  const senderMap = {}
  if (senderIds.length) {
    const senderRes = await users.where({ _id: db.command.in(senderIds) }).limit(50).get()
    senderRes.data.forEach((u) => {
      senderMap[u._id] = {
        _id: u._id,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        city: u.city,
      }
    })
  }

  return {
    ok: true,
    data: {
      success: true,
      messages: list.map((m) => ({
        ...m,
        // 规格外的可选字段：页面直接渲染头像/昵称，省一次请求
        ...(senderMap[m.senderId] ? { sender: senderMap[m.senderId] } : {}),
      })),
    },
  }
}
