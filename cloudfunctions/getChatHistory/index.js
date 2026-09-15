const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')
const matches = db.collection('matches')

/**
 * 拉取聊天记录。
 *
 * 支持 since 增量拉取：实时推送偶尔会断（切后台、网络抖动），
 * 页面重新可见时用 since = 本地最后一条消息时间戳补齐，避免漏消息。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const { matchId, since } = event

  if (!matchId) return { ok: false, message: '缺少 matchId' }

  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  const res = await matches.doc(matchId).get().catch(() => null)
  const match = res && res.data
  if (!match) return { ok: false, message: '会话不存在' }
  if (match.userA !== me._id && match.userB !== me._id) {
    return { ok: false, message: '无权查看该会话' }
  }

  const messages = match.messages || []
  const list = since ? messages.filter((m) => m.createdAt > Number(since)) : messages

  return { ok: true, data: list }
}
