const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')

/**
 * 微信登录：拿到 openid，创建或更新用户。
 *
 * 同时也承担「更新资料」的职责（传了 nickname / avatarUrl / city 就更新），
 * 这样客户端只需要维护一个用户写入入口。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, message: '拿不到 openid' }
  }

  const now = Date.now()
  const patch = { lastActiveAt: now }
  if (typeof event.nickname === 'string' && event.nickname.trim()) {
    patch.nickname = event.nickname.trim().slice(0, 12)
  }
  if (typeof event.avatarUrl === 'string') patch.avatarUrl = event.avatarUrl
  if (typeof event.city === 'string' && event.city) patch.city = event.city
  if (event.location && typeof event.location.lat === 'number') {
    patch.location = { lat: event.location.lat, lng: event.location.lng }
  }

  const existing = await users.where({ _openid: OPENID }).limit(1).get()

  if (existing.data.length) {
    const doc = existing.data[0]
    await users.doc(doc._id).update({ data: patch })
    return { ok: true, data: { ...doc, ...patch } }
  }

  const profile = {
    _openid: OPENID,
    nickname: `换友${OPENID.slice(-4)}`,
    avatarUrl: '',
    city: '上海',
    location: null,
    createdAt: now,
    lastActiveAt: now,
    ...patch,
  }
  const res = await users.add({ data: profile })
  return { ok: true, data: { _id: res._id, ...profile } }
}
