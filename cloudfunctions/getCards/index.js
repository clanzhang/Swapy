const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const swipes = db.collection('swipes')

const { buildQuota, currentUsed } = require('./quota')

const PRICE_RANGES = {
  '0-50': [0, 50],
  '50-200': [50, 200],
  '200-500': [200, 500],
  '500-2000': [500, 2000],
}

/**
 * 一次最多扫多少条候选。
 *
 * 云数据库不支持「估值区间交集」这种查询，所以只能先按
 * status / category 捞一批，再在内存里过滤。物品量上来之后要改成
 * 按城市分片 + 定时任务预计算推荐池。
 */
const SCAN_LIMIT = 100

function rangesOverlap(a, b) {
  return a[0] <= b[1] && b[0] <= a[1]
}

/**
 * getCards — 首页匹配池，分页加载。
 *
 * 入参：{ page = 1, pageSize = 20, categories? }
 * 出参：{ cards, hasMore, quota? }
 *
 * 筛选：同城 + 排除自己 + 排除已滑过 + 只取 active + 估值区间有交集。
 * 排序：createdAt 倒序。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(event.pageSize) || 20), 50)
  const offset = (page - 1) * pageSize
  const categories = Array.isArray(event.categories) ? event.categories.filter(Boolean) : []

  const now = Date.now()
  const quota = buildQuota(currentUsed(me, now).used, now)

  // 「我的想要」是另一个视图，复用同一个云函数。
  // 它不受额度限制 —— 看自己点过什么是回顾，不是消耗
  if (event.scope === 'wanted') {
    return { ok: true, data: { cards: await getWanted(me), hasMore: false } }
  }

  // 额度用完就不再发卡。这是唯一的下发口径，
  // 页面不用自己拼「没卡了」和「额度没了」两种状态
  if (quota.remaining <= 0) {
    return { ok: true, data: { cards: [], hasMore: false, quota } }
  }

  const [swipeRes, myItemRes] = await Promise.all([
    swipes.where({ fromUserId: me._id }).field({ toItemId: true }).limit(1000).get(),
    items.where({ ownerId: me._id, status: 'active' }).field({ priceRange: true }).limit(50).get(),
  ])

  const swipedIds = swipeRes.data.map((s) => s.toItemId)
  const myRanges = myItemRes.data.map((i) => PRICE_RANGES[i.priceRange]).filter(Boolean)

  // 注意：这里**不能**用 _.nin(swipedIds) 把已滑过的过滤掉。
  // 分页下标必须索引一个稳定的候选列表，否则每翻一页都会静默跳过一批卡片。
  // 排除已滑过要放在切片之后做。
  const where = {
    status: 'active',
    ownerId: _.neq(me._id),
  }
  if (categories.length) where.category = _.in(categories)

  const itemRes = await items
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(SCAN_LIMIT)
    .get()

  const ownerIds = [...new Set(itemRes.data.map((i) => i.ownerId))]
  const ownerMap = {}
  if (ownerIds.length) {
    const ownerRes = await users.where({ _id: _.in(ownerIds) }).limit(SCAN_LIMIT).get()
    ownerRes.data.forEach((u) => {
      ownerMap[u._id] = u
    })
  }

  // 同城 + 估值区间交集
  const candidates = itemRes.data
    .map((item) => {
      const owner = ownerMap[item.ownerId]
      if (!owner) return null
      if (owner.city !== me.city) return null
      if (myRanges.length) {
        const range = PRICE_RANGES[item.priceRange]
        if (!range || !myRanges.some((r) => rangesOverlap(r, range))) return null
      }
      return {
        ...item,
        owner: {
          _id: owner._id,
          nickname: owner.nickname,
          avatarUrl: owner.avatarUrl,
          city: owner.city,
        },
      }
    })
    .filter(Boolean)

  // 沿候选集往后扫，跳过已滑过的，凑够 pageSize 张（或扫到底）
  const scanned = new Set(swipedIds)
  const cards = []
  let scan = offset
  while (cards.length < pageSize && scan < candidates.length) {
    const window = candidates.slice(scan, scan + (pageSize - cards.length))
    scan += window.length
    for (const card of window) {
      if (!scanned.has(card._id)) cards.push(card)
    }
  }

  return { ok: true, data: { cards, hasMore: scan < candidates.length, quota } }
}

async function getWanted(me) {
  const swipeRes = await swipes
    .where({ fromUserId: me._id, direction: 'right' })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  const itemIds = swipeRes.data.map((s) => s.toItemId)
  if (!itemIds.length) return []

  const itemRes = await items.where({ _id: _.in(itemIds) }).limit(50).get()
  const ownerIds = [...new Set(itemRes.data.map((i) => i.ownerId))]
  const ownerRes = await users.where({ _id: _.in(ownerIds) }).limit(50).get()
  const ownerMap = {}
  ownerRes.data.forEach((u) => {
    ownerMap[u._id] = u
  })

  const byId = {}
  itemRes.data.forEach((i) => {
    byId[i._id] = i
  })

  return itemIds
    .map((id) => byId[id])
    .filter(Boolean)
    .map((item) => ({
      ...item,
      owner: ownerMap[item.ownerId]
        ? {
            _id: ownerMap[item.ownerId]._id,
            nickname: ownerMap[item.ownerId].nickname,
            avatarUrl: ownerMap[item.ownerId].avatarUrl,
            city: ownerMap[item.ownerId].city,
          }
        : null,
    }))
}
