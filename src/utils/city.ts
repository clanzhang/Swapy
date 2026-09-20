import { ALL_CITIES, type City } from '@/constants/cities'

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
 * 为什么值得单独抽成纯函数：城市列表有 90+ 项，用户要么搜、要么滚。
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
