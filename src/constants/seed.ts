import type { Item, Swipe, User } from '@/types'

/**
 * 冷启动种子数据。
 *
 * 新用户第一次进入时，匹配池里必须有东西可滑，否则产品体验是「一片空白」。
 * 线上部署时把这份数据导入 items / users 两个集合即可（见 cloudfunctions/README.md）。
 *
 * 图片用 `seed://<slug>` 占位，前端 ItemImage 组件会渲染成渐变色块；
 * 真实图片是云存储 fileID，两者在 UI 上走同一个组件。
 */

const now = Date.now()
const minsAgo = (n: number) => now - n * 60_000
const hoursAgo = (n: number) => now - n * 3_600_000

/** 当前登录用户（Mock 下由 login 创建） */
export const SEED_ME: User = {
  _id: 'u_me',
  _openid: 'openid_me',
  nickname: '我',
  avatarUrl: '',
  city: '上海',
  location: { lat: 31.2304, lng: 121.4737 },
  createdAt: hoursAgo(72),
  lastActiveAt: now,
}

/** 我自己的两个物品：没有它们，「互相想要」永远不可能发生 */
export const SEED_MY_ITEMS: Item[] = [
  {
    _id: 'it_mine_kindle',
    ownerId: 'u_me',
    images: ['seed://kindle-paperwhite'],
    title: 'Kindle Paperwhite 4 8G',
    category: 'book',
    condition: '90',
    priceRange: '200-500',
    description: '吃灰很久了，屏幕无划痕，带原装保护套，送一个收纳袋。',
    status: 'active',
    createdAt: hoursAgo(48),
  },
  {
    _id: 'it_mine_xm3',
    ownerId: 'u_me',
    images: ['seed://sony-wh1000xm3'],
    title: '索尼 WH-1000XM3 头戴降噪',
    category: 'digital',
    condition: '80',
    priceRange: '500-2000',
    description: '耳罩有一点使用痕迹，降噪和续航都正常，附收纳盒。',
    status: 'active',
    createdAt: hoursAgo(50),
  },
]

export const SEED_USERS: User[] = [
  SEED_ME,
  {
    _id: 'u_azhe',
    _openid: 'openid_azhe',
    nickname: '阿哲',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2241, lng: 121.4692 },
    createdAt: hoursAgo(240),
    lastActiveAt: minsAgo(6),
  },
  {
    _id: 'u_mumu',
    _openid: 'openid_mumu',
    nickname: '木木',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2405, lng: 121.4805 },
    createdAt: hoursAgo(300),
    lastActiveAt: minsAgo(22),
  },
  {
    _id: 'u_xiaoyu',
    _openid: 'openid_xiaoyu',
    nickname: '小鱼',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2019, lng: 121.4374 },
    createdAt: hoursAgo(180),
    lastActiveAt: minsAgo(41),
  },
  {
    _id: 'u_kk',
    _openid: 'openid_kk',
    nickname: 'KK',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2589, lng: 121.5201 },
    createdAt: hoursAgo(400),
    lastActiveAt: hoursAgo(3),
  },
  {
    _id: 'u_lin',
    _openid: 'openid_lin',
    nickname: '林子',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.1932, lng: 121.5112 },
    createdAt: hoursAgo(520),
    lastActiveAt: hoursAgo(9),
  },
  {
    _id: 'u_yoyo',
    _openid: 'openid_yoyo',
    nickname: 'Yoyo',
    avatarUrl: '',
    city: '苏州',
    // 苏州 → 上海约 85km，会被 50km 筛选规则挡掉，用来验证距离过滤确实生效
    location: { lat: 31.2989, lng: 120.5853 },
    createdAt: hoursAgo(260),
    lastActiveAt: minsAgo(15),
  },
  {
    _id: 'u_dada',
    _openid: 'openid_dada',
    nickname: '大大的D',
    avatarUrl: '',
    city: '杭州',
    location: { lat: 30.2741, lng: 120.1551 },
    createdAt: hoursAgo(600),
    lastActiveAt: hoursAgo(30),
  },
]

export const SEED_ITEMS: Item[] = [
  ...SEED_MY_ITEMS,
  // ---- 阿哲 ----
  {
    _id: 'it_azhe_switch',
    ownerId: 'u_azhe',
    images: ['seed://switch-oled-1', 'seed://switch-oled-2'],
    title: 'Switch OLED 白色 日版',
    category: 'digital',
    condition: '95',
    priceRange: '500-2000',
    description: '买了半年，玩通了塞尔达就吃灰，屏幕无痕，带底座和原装包。',
    status: 'active',
    createdAt: hoursAgo(20),
  },
  {
    _id: 'it_azhe_lego',
    ownerId: 'u_azhe',
    images: ['seed://lego-911'],
    title: '乐高 10295 保时捷 911',
    category: 'toy',
    condition: '95',
    priceRange: '500-2000',
    description: '拼完展示过一次，零件齐全，说明书和原盒都在。',
    status: 'active',
    createdAt: hoursAgo(30),
  },
  // ---- 木木 ----
  {
    _id: 'it_mumu_airpods',
    ownerId: 'u_mumu',
    images: ['seed://airpods-3'],
    title: 'AirPods 3 代',
    category: 'digital',
    condition: '90',
    priceRange: '200-500',
    description: '续航正常，充电盒有轻微划痕，已消毒，可当场试听。',
    status: 'active',
    createdAt: hoursAgo(14),
  },
  {
    _id: 'it_mumu_book',
    ownerId: 'u_mumu',
    images: ['seed://sapiens-set'],
    title: '《人类简史》三部曲',
    category: 'book',
    condition: '95',
    priceRange: '50-200',
    description: '三本一起出，只翻过一遍，无笔记无划线。',
    status: 'active',
    createdAt: hoursAgo(40),
  },
  {
    _id: 'it_mumu_yoga',
    ownerId: 'u_mumu',
    images: ['seed://yoga-set'],
    title: '瑜伽垫 + 弹力带套装',
    category: 'sport',
    condition: '80',
    priceRange: '0-50',
    description: '搬家带不走，垫子 8mm 加厚，弹力带五件套齐全。',
    status: 'active',
    createdAt: hoursAgo(60),
  },
  // ---- 小鱼 ----
  {
    _id: 'it_xiaoyu_guitar',
    ownerId: 'u_xiaoyu',
    images: ['seed://yamaha-f310', 'seed://yamaha-f310-2'],
    title: '雅马哈 F310 民谣吉他',
    category: 'instrument',
    condition: '90',
    priceRange: '200-500',
    description: '新手琴，换了达达里奥琴弦，带琴包、变调夹、拨片。',
    status: 'active',
    createdAt: hoursAgo(10),
  },
  {
    _id: 'it_xiaoyu_mouse',
    ownerId: 'u_xiaoyu',
    images: ['seed://mx-master-3'],
    title: '罗技 MX Master 3 鼠标',
    category: 'digital',
    condition: '90',
    priceRange: '200-500',
    description: '换 Mac 之后用不上了，滚轮手感依旧，接收器齐全。',
    status: 'active',
    createdAt: hoursAgo(26),
  },
  // ---- KK ----
  {
    _id: 'it_kk_popmart',
    ownerId: 'u_kk',
    images: ['seed://popmart-labubu', 'seed://popmart-set'],
    title: '泡泡玛特 一整套 12 只',
    category: 'toy',
    condition: 'new',
    priceRange: '200-500',
    description: '整盒未拆封，重复了所以出，可拆盒验货。',
    status: 'active',
    createdAt: hoursAgo(8),
  },
  {
    _id: 'it_kk_bike',
    ownerId: 'u_kk',
    images: ['seed://road-bike'],
    title: '迪卡侬 RC100 公路车',
    category: 'sport',
    condition: '80',
    priceRange: '500-2000',
    description: '骑了大概 300 公里，刚做过保养，L 码适合 175 以上。',
    status: 'active',
    createdAt: hoursAgo(34),
  },
  // ---- 林子 ----
  {
    _id: 'it_lin_gundam',
    ownerId: 'u_lin',
    images: ['seed://gundam-mg', 'seed://gundam-mg-2'],
    title: '高达 MG 独角兽 已上色',
    category: 'toy',
    condition: '95',
    priceRange: '200-500',
    description: '自己喷涂的，做工还行，带支架，仅展出过。',
    status: 'active',
    createdAt: hoursAgo(17),
  },
  {
    _id: 'it_lin_keys',
    ownerId: 'u_lin',
    images: ['seed://casio-cts300'],
    title: '卡西欧 CT-S300 电子琴',
    category: 'instrument',
    condition: '90',
    priceRange: '200-500',
    description: '61 键，功能全好，带电源和谱架，自提优先。',
    status: 'active',
    createdAt: hoursAgo(45),
  },
  {
    _id: 'it_lin_design',
    ownerId: 'u_lin',
    images: ['seed://design-of-design'],
    title: '《设计中的设计》原研哉',
    category: 'book',
    condition: '95',
    priceRange: '0-50',
    description: '广西师大版，几乎全新，只是放书架久了。',
    status: 'active',
    createdAt: hoursAgo(70),
  },
  // ---- Yoyo（苏州，超出 50km，不应出现在首页）----
  {
    _id: 'it_yoyo_ipad',
    ownerId: 'u_yoyo',
    images: ['seed://ipad-mini-6'],
    title: 'iPad mini 6 64G 紫色',
    category: 'digital',
    condition: '95',
    priceRange: '500-2000',
    description: '看剧神器，无磕碰，可当面验机。',
    status: 'active',
    createdAt: hoursAgo(12),
  },
  // ---- 大大的D（杭州，超出 50km）----
  {
    _id: 'it_dada_badminton',
    ownerId: 'u_dada',
    images: ['seed://lining-racket'],
    title: '李宁 羽毛球拍 一对',
    category: 'sport',
    condition: '90',
    priceRange: '50-200',
    description: '打了几次，线还挺紧，送一筒球。',
    status: 'active',
    createdAt: hoursAgo(28),
  },
  // ---- 已换出：不应出现在匹配池 ----
  {
    _id: 'it_azhe_swapped',
    ownerId: 'u_azhe',
    images: ['seed://old-camera'],
    title: '富士 X100F（已换出）',
    category: 'digital',
    condition: '80',
    priceRange: '500-2000',
    description: '已经换掉了，留个记录。',
    status: 'swapped',
    createdAt: hoursAgo(200),
  },
]

/**
 * 预置一条「对方已经右滑过我」的记录。
 *
 * 目的是让新用户滑第一张卡就能命中匹配、看到完整闭环，
 * 而不是滑了几十张都毫无反馈 —— 冷启动阶段最怕这个。
 */
export const SEED_SWIPES: Swipe[] = [
  {
    _id: 'sw_azhe_kindle',
    fromUserId: 'u_azhe',
    toItemId: 'it_mine_kindle',
    toUserId: 'u_me',
    direction: 'right',
    createdAt: minsAgo(35),
  },
  {
    _id: 'sw_mumu_kindle',
    fromUserId: 'u_mumu',
    toItemId: 'it_mine_kindle',
    toUserId: 'u_me',
    direction: 'right',
    createdAt: minsAgo(80),
  },
  {
    _id: 'sw_xiaoyu_xm3',
    fromUserId: 'u_xiaoyu',
    toItemId: 'it_mine_xm3',
    toUserId: 'u_me',
    direction: 'right',
    createdAt: minsAgo(120),
  },
]
