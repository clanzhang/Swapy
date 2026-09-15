const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const items = db.collection('items')
const users = db.collection('users')

const {
  describeHits,
  moderateItem,
  secCheckImages,
  secCheckText,
} = require('./moderation')

const CATEGORIES = ['digital', 'book', 'toy', 'instrument', 'sport']
const CONDITIONS = ['new', '95', '90', '80']
const PRICE_RANGES = ['0-50', '50-200', '200-500', '500-2000']
const STATUSES = ['active', 'swapped', 'off']

/**
 * 发布物品 / 修改物品状态。
 *
 * 品类、成色、估值区间都在这里做白名单校验 —— 客户端的下拉选项是可以被绕过的，
 * 落库前的校验必须放在服务端。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  if (event.action === 'updateStatus') {
    return updateStatus(me, event)
  }

  const { images, title, category, condition, priceRange, description } = event

  if (!Array.isArray(images) || !images.length) return { ok: false, message: '至少上传一张图片' }
  if (images.length > 9) return { ok: false, message: '最多上传 9 张图片' }
  if (typeof title !== 'string' || !title.trim()) return { ok: false, message: '缺少物品名称' }
  if (title.trim().length > 30) return { ok: false, message: '物品名称过长' }
  if (!CATEGORIES.includes(category)) return { ok: false, message: '品类不合法' }
  if (!CONDITIONS.includes(condition)) return { ok: false, message: '成色不合法' }
  if (!PRICE_RANGES.includes(priceRange)) return { ok: false, message: '估值区间不合法' }

  // 内容校验：本地规则先跑（快、免费），过了再过微信内容安全接口
  const verdict = moderateItem({ title, description })
  if (!verdict.ok) {
    return { ok: false, message: describeHits(verdict.hits) }
  }

  const textRisk = await secCheckText(cloud, {
    content: `${title} ${description || ''}`,
    openid: OPENID,
  })
  if (textRisk) return { ok: false, message: textRisk }

  const imageRisk = await secCheckImages(cloud, images)
  if (imageRisk) return { ok: false, message: imageRisk }

  const doc = {
    ownerId: me._id,
    _openid: OPENID,
    images,
    title: title.trim(),
    category,
    condition,
    priceRange,
    description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
    status: 'active',
    createdAt: Date.now(),
  }

  const res = await items.add({ data: doc })
  return { ok: true, data: { _id: res._id, ...doc } }
}

async function updateStatus(me, event) {
  const { itemId, status } = event
  if (!itemId) return { ok: false, message: '缺少 itemId' }
  if (!STATUSES.includes(status)) return { ok: false, message: '状态不合法' }

  const res = await items.doc(itemId).get().catch(() => null)
  const item = res && res.data
  if (!item) return { ok: false, message: '物品不存在' }
  // 只允许改自己的东西
  if (item.ownerId !== me._id) return { ok: false, message: '无权操作该物品' }

  await items.doc(itemId).update({ data: { status } })
  return { ok: true, data: { _id: itemId, status } }
}
