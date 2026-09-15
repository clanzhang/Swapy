const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const items = db.collection('items')
const users = db.collection('users')

const { describeHits, moderateItem, secCheckImages, secCheckText } = require('./moderation')

/** 枚举白名单，和客户端 src/types 保持一致 */
const CATEGORIES = ['数码', '书籍', '潮玩', '乐器', '运动']
const CONDITIONS = ['全新', '95新', '9成新', '8成新']
const PRICE_RANGES = ['0-50', '50-200', '200-500', '500-2000']
const STATUSES = ['active', 'swapped', 'off']

/**
 * publishItem — 发布物品 / 修改物品状态。
 *
 * 入参：{ title, category, condition, priceRange, description, imageFileIds[] }
 * 出参：{ success, itemId?, error? }
 *
 * 枚举白名单必须在服务端校验 —— 客户端的选项是可以被绕过的。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: true, data: { success: false, error: '用户不存在，请先登录' } }

  if (event.action === 'updateStatus') {
    return updateStatus(me, event)
  }

  const { title, category, condition, priceRange, description, imageFileIds } = event

  if (!Array.isArray(imageFileIds) || !imageFileIds.length) {
    return { ok: true, data: { success: false, error: '至少上传一张图片' } }
  }
  if (imageFileIds.length > 9) {
    return { ok: true, data: { success: false, error: '最多上传 9 张图片' } }
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { ok: true, data: { success: false, error: '缺少物品名称' } }
  }
  if (title.trim().length > 30) {
    return { ok: true, data: { success: false, error: '物品名称过长' } }
  }
  if (!CATEGORIES.includes(category)) {
    return { ok: true, data: { success: false, error: '品类不合法' } }
  }
  if (!CONDITIONS.includes(condition)) {
    return { ok: true, data: { success: false, error: '成色不合法' } }
  }
  if (!PRICE_RANGES.includes(priceRange)) {
    return { ok: true, data: { success: false, error: '估值区间不合法' } }
  }

  // 内容校验：本地规则先跑（快、免费），过了再过微信内容安全接口
  const verdict = moderateItem({ title, description })
  if (!verdict.ok) {
    return { ok: true, data: { success: false, error: describeHits(verdict.hits) } }
  }

  const textRisk = await secCheckText(cloud, {
    content: `${title} ${description || ''}`,
    openid: OPENID,
  })
  if (textRisk) return { ok: true, data: { success: false, error: textRisk } }

  const imageRisk = await secCheckImages(cloud, imageFileIds)
  if (imageRisk) return { ok: true, data: { success: false, error: imageRisk } }

  const doc = {
    ownerId: me._id,
    _openid: OPENID,
    images: imageFileIds,
    title: title.trim(),
    category,
    condition,
    priceRange,
    description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
    status: 'active',
    createdAt: Date.now(),
  }

  const res = await items.add({ data: doc })
  return { ok: true, data: { success: true, itemId: res._id } }
}

async function updateStatus(me, event) {
  const { itemId, status } = event
  if (!itemId) return { ok: true, data: { success: false, error: '缺少 itemId' } }
  if (!STATUSES.includes(status)) {
    return { ok: true, data: { success: false, error: '状态不合法' } }
  }

  const res = await items.doc(itemId).get().catch(() => null)
  const item = res && res.data
  if (!item) return { ok: true, data: { success: false, error: '物品不存在' } }
  // 只允许改自己的东西
  if (item.ownerId !== me._id) {
    return { ok: true, data: { success: false, error: '无权操作该物品' } }
  }

  await items.doc(itemId).update({ data: { status } })
  return { ok: true, data: { success: true, itemId } }
}
