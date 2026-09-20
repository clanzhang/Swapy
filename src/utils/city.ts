import { ALL_CITIES, type City } from '@/constants/cities'
import { haversine, type LatLng } from '@/utils/geo'

/** 音节首字母：'shang hai' → 'sh' */
function initials(pinyin: string): string {
  return pinyin
    .split(' ')
    .map((syllable) => syllable[0] ?? '')
    .join('')
}

/**
 * 城市搜索。
 *
 * 为什么值得单独抽成纯函数：城市列表有 100 项，用户要么搜、要么滚。
 * 搜索规则一旦写错（比如只匹配全拼、大小写没处理），表现是
 * 「我输 sh 一个都没有」—— 不报错，但会让人以为没有这个城市。
 *
 * 支持四种输入，都不区分大小写、忽略空格：
 * - 中文：`上` / `上海`
 * - 全拼：`shanghai`
 * - 音节前缀：`shang`
 * - 首字母：`sh` / `sz`
 *
 * @param keyword 用户输入的关键词
 * @param cities  候选城市，默认为全部城市（便于测试注入）
 * @returns 命中的城市名，保持传入顺序；空关键词返回空数组
 *          （空关键词代表「没在搜」，页面该展示热门 + 全部，而不是全长列表当结果）
 */
export function searchCities(keyword: string, cities: City[] = ALL_CITIES): string[] {
  const raw = keyword.trim()
  if (!raw) return []

  const kw = raw.toLowerCase().replace(/\s+/g, '')

  return cities
    .filter((city) => {
      if (city.name.includes(raw)) return true
      // 全拼前缀：shang → 上海
      if (city.pinyin.replace(/\s+/g, '').startsWith(kw)) return true
      // 首字母：sz → 深圳 / 苏州
      if (initials(city.pinyin).startsWith(kw)) return true
      // 音节前缀：nan → 南昌 / 南京 / 南宁 / 南通
      return city.pinyin.split(' ').some((syllable) => syllable.startsWith(kw))
    })
    .map((city) => city.name)
}

/** 城市中心点，找不到（比如用户城市是列表外的）返回 undefined */
export function cityCenter(name: string, cities: City[] = ALL_CITIES): LatLng | undefined {
  const city = cities.find((c) => c.name === name)
  return city ? { lat: city.lat, lng: city.lng } : undefined
}

/**
 * 定位坐标 → 最近的城市名。
 *
 * 微信只给经纬度，**不给城市名**：`wx.getLocation` / `wx.getFuzzyLocation`
 * 都返回 lat/lng。而把经纬度翻成城市名需要逆地理编码 —— 那要么接腾讯位置
 * 服务的 key（多一个外部依赖、要管配额），要么在小程序后台申请接口权限。
 * 这里走的是第三条路：拿全部城市的市中心做「就近匹配」。
 * 代价是边界地区可能选到邻近城市（比如昆山可能落到苏州或上海），
 * 但城市级精度完全够用，而且 Mock 模式也能离线跑通。
 *
 * @returns 最近的城市名；候选为空时返回 null
 */
export function nearestCity(point: LatLng, cities: City[] = ALL_CITIES): string | null {
  let best: { name: string; km: number } | null = null

  for (const city of cities) {
    const km = haversine(point, { lat: city.lat, lng: city.lng })
    if (!best || km < best.km) best = { name: city.name, km }
  }

  return best ? best.name : null
}
