const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const users = db.collection('users')
const items = db.collection('items')
const swipes = db.collection('swipes')

const { buildQuota, currentUsed } = require('./quota')

/** 和客户端 constants 保持一致，改一处要一起改 */
const MAX_DISTANCE_KM = 50
const PRICE_RANGES = {
  '0-50': [0, 50],
  '50-200': [50, 200],
  '200-500': [200, 500],
  '500-2000': [500, 2000],
}

const EARTH_RADIUS_KM = 6371
const toRad = (deg) => (deg * Math.PI) / 180

function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function rangesOverlap(a, b) {
  return a[0] <= b[1] && b[0] <= a[1]
}

/**
 * 拉取匹配池卡片。
 *
 * 注意这里把「距离筛选」和「估值区间有交集」放在云函数里做，
 * 而不是靠数据库查询 —— 云数据库不支持地理距离和区间交集查询。
 * 代价是一次最多处理 SCAN_LIMIT 条候选，靠游标翻页逐批扫。
 * 物品量级上来之后，应该改成按城市分片 + 定时预计算，见 README。
 */
const SCAN_LIMIT = 100

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const meRes = await users.where({ _openid: OPENID }).limit(1).get()
  const me = meRes.data[0]
  if (!me) return { ok: false, message: '用户不存在，请先登录' }

  const limit = Math.min(Number(event.limit) || 10, 20)
  const offset = Number(event.cursor) || 0
  const categories = Array.isArray(event.categories) ? event.categories.filter(Boolean) : []

  const now = Date.now()
  const quota = buildQuota(currentUsed(me, now).used, now)

  // 「我的想要」是另一个视图，复用同一个云函数避免多写一个。
  // 它不受配额限制 —— 看自己点过什么是回顾，不是消耗
  if (event.scope === 'wanted') {
    return { ok: true, data: await getWanted(me) }
  }

  // 额度用完就不再发卡。这是唯一的下发口径，
  // 页面不用自己拼「没卡了」和「额度没了」两种状态
  if (quota.remaining <= 0) {
    return { ok: true, data: { list: [], nextCursor: null, quota } }
  }

  const [swipeRes, myItemRes] = await Promise.all([
    swipes.where({ fromUserId: me._id }).field({ toItemId: true }).limit(1000).get(),
    items.where({ ownerId: me._id, status: 'active' }).field({ priceRange: true }).limit(50).get(),
  ])

  const swipedIds = swipeRes.data.map((s) => s.toItemId)
  const myRanges = myItemRes.data.map((i) => PRICE_RANGES[i.priceRange]).filter(Boolean)

  const where = {
    status: 'active',
    ownerId: _.neq(me._id),
  }
  // 注意：这里**不能**用 _.nin(swipedIds) 把已滑过的过滤掉。
  // 游标是「候选列表里的位置」，候选集如果因为滑过而变短、游标却按原步长
  // 前进，每翻一页就会静默跳过一批卡片。排除已滑过必须放在切片之后做。
  if (categories.length) where.category = _.in(categories)

  const itemRes = await items.where(where).orderBy('createdAt', 'desc').limit(SCAN_LIMIT).get()

  const ownerIds = [...new Set(itemRes.data.map((i) => i.ownerId))]
  const ownerMap = {}
  if (ownerIds.length) {
    const ownerRes = await users.where({ _id: _.in(ownerIds) }).limit(SCAN_LIMIT).get()
    ownerRes.data.forEach((u) => {
      ownerMap[u._id] = u
    })
  }

  const from = me.location
  const list = itemRes.data
    .map((item) => {
      const owner = ownerMap[item.ownerId]
      if (!owner) return null
      const distanceKm =
        from && owner.location ? haversine(from, owner.location) : Number.POSITIVE_INFINITY
      return { ...item, owner, distanceKm }
    })
    .filter((card) => {
      if (!card) return false
      if (card.distanceKm > MAX_DISTANCE_KM) return false
      // 我没有在架物品时不筛估值，否则新用户会无卡可滑
      if (myRanges.length) {
        const range = PRICE_RANGES[card.priceRange]
        if (!range) return false
        if (!myRanges.some((r) => rangesOverlap(r, range))) return false
      }
      return true
    })
    .sort((a, b) => a.distanceKm - b.distanceKm || b.createdAt - a.createdAt)

  // 沿候选集往后扫，跳过已滑过的，凑够 limit 张（或扫到底）
  const scanned = new Set(swipedIds)
  const page = []
  let scan = offset
  while (page.length < limit && scan < list.length) {
    const window = list.slice(scan, scan + (limit - page.length))
    scan += window.length
    for (const card of window) {
      if (!scanned.has(card._id)) page.push(card)
    }
  }

  return {
    ok: true,
    data: {
      list: page,
      nextCursor: scan < list.length ? String(scan) : null,
      quota,
    },
  }
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
    .map((item) => {
      const owner = ownerMap[item.ownerId]
      const distanceKm =
        me.location && owner && owner.location
          ? haversine(me.location, owner.location)
          : Number.POSITIVE_INFINITY
      return { ...item, owner, distanceKm }
    })
}
