import type { Category, Condition, Item, PriceRange, Swipe, User } from '@/types'

/**
 * 冷启动种子数据。
 *
 * 新用户第一次进来时，匹配池里必须有东西可滑，否则产品体验是「一片空白」。
 * 线上部署时把这份数据导入 items / users 两个集合即可（见 cloudfunctions/README.md）。
 *
 * 图片用 `seed://<slug>` 占位，前端 ItemImage 组件会渲染成渐变色块；
 * 真实图片是云存储 fileID，两者在 UI 上走同一个组件。
 *
 * 数量要求：匹配池的总量必须远大于每日配额（DAILY_QUOTA），
 * 否则用户永远是「刷完了」而不是「额度用完了」，限额机制根本看不出来。
 */

const now = Date.now()
const minsAgo = (n: number) => now - n * 60_000
const hoursAgo = (n: number) => now - n * 3_600_000

/**
 * 种子数据版本号。**每次改动 SEED_* 的内容都要 +1。**
 *
 * 为什么需要它：Mock 模式把数据持久化在本地 Storage 里，读回来时如果
 * 直接信任存档，那么改完种子数据后老设备上永远是旧数据 —— 会表现成
 * 「牌堆不对」「怎么点都不匹配」这类很难查的问题。
 * 版本对不上就重新播种。
 */
export const SEED_VERSION = 2

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

/**
 * 我自己的两个物品：没有它们，「互相想要」永远不可能发生。
 * ID 保持固定，因为 SEED_SWIPES 里要引用。
 */
export const SEED_MY_ITEMS: Item[] = [
  {
    _id: 'it_mine_kindle',
    ownerId: 'u_me',
    images: ['seed://kindle-paperwhite'],
    title: 'Kindle Paperwhite 4 8G',
    category: '书籍',
    condition: '9成新',
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
    category: '数码',
    condition: '8成新',
    priceRange: '500-2000',
    description: '耳罩有一点使用痕迹，降噪和续航都正常，附收纳盒。',
    status: 'active',
    createdAt: hoursAgo(50),
  },
]

export const SEED_USERS: User[] = [
  SEED_ME,
  // ---------------------------------------------------------------- 上海（会进匹配池）
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
    _id: 'u_xiaoman',
    _openid: 'openid_xiaoman',
    nickname: '小满',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2156, lng: 121.4459 },
    createdAt: hoursAgo(150),
    lastActiveAt: minsAgo(12),
  },
  {
    _id: 'u_atang',
    _openid: 'openid_atang',
    nickname: '阿汤',
    avatarUrl: '',
    city: '上海',
    location: { lat: 31.2486, lng: 121.4385 },
    createdAt: hoursAgo(210),
    lastActiveAt: minsAgo(35),
  },
  // ---------------------------------------------------------------- 外地（会被 50km 挡掉）
  {
    _id: 'u_yoyo',
    _openid: 'openid_yoyo',
    nickname: 'Yoyo',
    avatarUrl: '',
    city: '苏州',
    // 苏州 → 上海约 85km
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
    // 杭州 → 上海约 170km
    location: { lat: 30.2741, lng: 120.1551 },
    createdAt: hoursAgo(600),
    lastActiveAt: hoursAgo(30),
  },
]

/**
 * 用一行描述一件物品，避免几十条种子数据写成几百行对象字面量。
 * ID 由序号生成，测试不要依赖具体 ID，用谓词找。
 */
let seq = 0
function offer(
  ownerId: string,
  title: string,
  category: Category,
  condition: Condition,
  priceRange: PriceRange,
  description: string,
  hours: number,
  imageCount = 1,
): Item {
  seq += 1
  const slug = `o${seq}`
  return {
    _id: `it_${slug}`,
    ownerId,
    images: Array.from({ length: imageCount }, (_, i) => `seed://${slug}-${i + 1}`),
    title,
    category,
    condition,
    priceRange,
    description,
    status: 'active',
    createdAt: hoursAgo(hours),
  }
}

export const SEED_ITEMS: Item[] = [
  ...SEED_MY_ITEMS,

  // ---------------------------------------------------------------- 阿哲
  offer('u_azhe', 'Switch OLED 白色 日版', '数码', '95新', '500-2000', '买了半年，玩通塞尔达就吃灰，带底座和原装包。', 20, 2),
  offer('u_azhe', '乐高 10295 保时捷 911', '潮玩', '95新', '500-2000', '拼完展示过一次，零件齐全，说明书和原盒都在。', 30),
  offer('u_azhe', '索尼 A7M3 机身', '数码', '8成新', '500-2000', '快门一万出头，机身有轻微使用痕迹，功能一切正常。', 46, 2),
  offer('u_azhe', '《三体》全集 典藏版', '书籍', '全新', '200-500', '塑封都没拆，买重了。', 60),
  offer('u_azhe', '迪卡侬 折叠划船机', '运动', '9成新', '500-2000', '用了不到十次，太占地方，上海自提。', 72),
  offer('u_azhe', '泰勒 GS Mini 旅行吉他', '乐器', '9成新', '500-2000', '带原装琴包，出差带着弹过几次。', 90, 2),
  offer('u_azhe', 'SKULLPANDA 整盒 12 只', '潮玩', '全新', '200-500', '重复了所以出，可拆盒验货。', 100),

  // ---------------------------------------------------------------- 木木
  offer('u_mumu', 'AirPods 3 代', '数码', '9成新', '200-500', '续航正常，充电盒有轻微划痕，已消毒。', 14),
  offer('u_mumu', '《人类简史》三部曲', '书籍', '95新', '50-200', '三本一起出，只翻过一遍，无笔记无划线。', 40),
  offer('u_mumu', '瑜伽垫 + 弹力带套装', '运动', '8成新', '0-50', '搬家带不走，垫子 8mm 加厚。', 60),
  offer('u_mumu', 'iPad Air 4 64G', '数码', '9成新', '500-2000', '看剧用，无磕碰，可当面验机。', 18, 2),
  offer('u_mumu', '《置身事内》', '书籍', '95新', '50-200', '读了一遍，很新。', 52),
  offer('u_mumu', '捷安特 ATX 山地车', '运动', '8成新', '500-2000', '骑了两年，刚做过保养，M 码。', 66),
  offer('u_mumu', '尤克里里 23 寸', '乐器', '95新', '50-200', '带调音器和琴包。', 80),

  // ---------------------------------------------------------------- 小鱼
  offer('u_xiaoyu', '雅马哈 F310 民谣吉他', '乐器', '9成新', '200-500', '新手琴，换了达达里奥琴弦，带琴包和变调夹。', 10, 2),
  offer('u_xiaoyu', '罗技 MX Master 3 鼠标', '数码', '9成新', '200-500', '换 Mac 之后用不上了，滚轮手感依旧。', 26),
  offer('u_xiaoyu', '《设计中的设计》原研哉', '书籍', '95新', '0-50', '广西师大版，几乎全新。', 70),
  offer('u_xiaoyu', '佳能 EOS M50 微单', '数码', '9成新', '500-2000', '带 15-45 套机镜头，快门数不高。', 34, 2),
  offer('u_xiaoyu', 'YONEX 羽毛球拍 一对', '运动', '9成新', '200-500', '打了几次，线还挺紧，送一筒球。', 44),
  offer('u_xiaoyu', '卡西欧 CT-S300 电子琴', '乐器', '9成新', '200-500', '61 键，功能全好，带电源和谱架。', 45),
  offer('u_xiaoyu', '高达 RG 沙扎比', '潮玩', '95新', '200-500', '素组，已上色，带支架。', 58),

  // ---------------------------------------------------------------- KK
  offer('u_kk', '泡泡玛特 一整套 12 只', '潮玩', '全新', '200-500', '整盒未拆封，重复了所以出。', 8, 2),
  offer('u_kk', '迪卡侬 RC100 公路车', '运动', '8成新', '500-2000', '骑了大概 300 公里，刚保养过，L 码。', 34),
  offer('u_kk', 'Steam Deck 256G', '数码', '9成新', '500-2000', '玩了几个月，成色很好，带底座。', 22, 2),
  offer('u_kk', '《房思琪的初恋乐园》', '书籍', '95新', '0-50', '只读过一次。', 76),
  offer('u_kk', 'Roland TD-1K 电子鼓', '乐器', '9成新', '500-2000', '配件齐全，体积大，上海自提。', 50, 2),
  offer('u_kk', '李宁 羽毛球拍', '运动', '9成新', '50-200', '打了几次，手胶刚换。', 62),
  offer('u_kk', '乐高 科技组 兰博基尼', '潮玩', '95新', '500-2000', '拼过一次就收起来了。', 84),

  // ---------------------------------------------------------------- 林子
  offer('u_lin', '高达 MG 独角兽 已上色', '潮玩', '95新', '200-500', '自己喷涂的，做工还行，带支架，仅展出过。', 17, 2),
  offer('u_lin', '雅马哈 PSR-E373 电子琴', '乐器', '9成新', '500-2000', '61 键，带电源和谱架。', 45),
  offer('u_lin', '《万历十五年》', '书籍', '95新', '50-200', '无笔记无划线。', 55),
  offer('u_lin', '富士 X-T30 微单', '数码', '9成新', '500-2000', '带 15-45 镜头，成色好。', 28, 2),
  offer('u_lin', '家用折叠跑步机', '运动', '8成新', '500-2000', '搬家出，折叠后不占地方，自提。', 68),
  offer('u_lin', '雅马哈 FG830 民谣吉他', '乐器', '9成新', '500-2000', '音色很好，带琴包。', 88),
  offer('u_lin', '万代 PG 强袭高达', '潮玩', '9成新', '500-2000', '素组未上色，零件齐全。', 95),

  // ---------------------------------------------------------------- 小满
  offer('u_xiaoman', '索尼 WH-1000XM4', '数码', '9成新', '500-2000', '降噪很好，带收纳盒和音频线。', 6, 2),
  offer('u_xiaoman', '《明朝那些事儿》全套', '书籍', '9成新', '50-200', '九成新，全套九册。', 24),
  offer('u_xiaoman', '双翘滑板', '运动', '9成新', '0-50', '玩了几次，轴承还很顺。', 48),
  offer('u_xiaoman', '泰勒 114ce 电箱吉他', '乐器', '9成新', '500-2000', '带拾音器，可插音箱。', 36, 2),
  offer('u_xiaoman', '泡泡玛特 盲盒 5 只', '潮玩', '全新', '50-200', '未拆封，打包出。', 42),
  offer('u_xiaoman', '佳能 24-105 镜头', '数码', '9成新', '500-2000', '无霉无雾，带 UV 镜。', 54),
  offer('u_xiaoman', '迪卡侬 篮球', '运动', '9成新', '0-50', '打了两次，气很足。', 64),

  // ---------------------------------------------------------------- 阿汤
  offer('u_atang', '任天堂 Switch Lite', '数码', '9成新', '500-2000', '便携款，带收纳包。', 12),
  offer('u_atang', '《沉默的大多数》', '书籍', '95新', '0-50', '全新，买重了。', 33),
  offer('u_atang', '卡马 D1C 民谣吉他', '乐器', '9成新', '200-500', '新手琴，手感不错。', 38),
  offer('u_atang', '哑铃 一对 10kg', '运动', '9成新', '0-50', '太重了不想搬，自提。', 47),
  offer('u_atang', '高达 HG 一批 5 个', '潮玩', '9成新', '200-500', '打包出，都已拼好。', 56, 2),
  offer('u_atang', '索尼 ZV-1 相机', '数码', '95新', '500-2000', '买来拍 vlog，没用几次。', 26, 2),
  offer('u_atang', '《百年孤独》精装', '书籍', '95新', '50-200', '收藏版，书脊无痕。', 78),

  // ---------------------------------------------------------------- 苏州（超 50km，不该进池子）
  offer('u_yoyo', 'iPad mini 6 64G 紫色', '数码', '95新', '500-2000', '看剧神器，无磕碰。', 12, 2),
  offer('u_yoyo', '《人类简史》单本', '书籍', '9成新', '50-200', '读过一遍。', 44),
  offer('u_yoyo', '川崎 羽毛球拍', '运动', '9成新', '50-200', '打了几次。', 70),

  // ---------------------------------------------------------------- 杭州（超 50km，不该进池子）
  offer('u_dada', '李宁 羽毛球拍 一对', '运动', '9成新', '50-200', '打了几次，线还挺紧，送一筒球。', 28),
  offer('u_dada', '杜伽 K320 机械键盘', '数码', '9成新', '500-2000', '茶轴，手感好。', 36),
  offer('u_dada', '尤克里里 26 寸', '乐器', '9成新', '50-200', '带琴包。', 58),

  // ---------------------------------------------------------------- 已换出（不该进池子）
  {
    ...offer('u_azhe', '富士 X100F', '数码', '8成新', '500-2000', '已经换掉了，留个记录。', 200),
    status: 'swapped' as const,
  },
]

/**
 * 预置一条「对方已经右滑过我」的记录。
 *
 * 目的是让新用户滑到阿哲/木木/小鱼的物品时能命中匹配、看到完整闭环，
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
