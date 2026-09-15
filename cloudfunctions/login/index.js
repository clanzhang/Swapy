const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')

/**
 * login — 静默登录，用户无感知。
 *
 * 入参：无（从微信上下文自动获取 openid）。
 *       另外接受 nickname / avatarUrl / city / location，传了就顺带更新资料，
 *       这样客户端只需要维护一个用户写入入口。
 * 出参：{ user, isNew }
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
    return { ok: true, data: { user: { ...doc, ...patch }, isNew: false } }
  }

  const profile = {
    _openid: OPENID,
    nickname: `换换用户${OPENID.slice(-4)}`,
    avatarUrl: '',
    city: '上海',
    location: null,
    createdAt: now,
    lastActiveAt: now,
    ...patch,
  }
  const res = await users.add({ data: profile })

  return { ok: true, data: { user: { _id: res._id, ...profile }, isNew: true } }
}
