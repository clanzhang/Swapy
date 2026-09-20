/**
 * 城市选择的验证。
 *
 * 城市这一块错起来全是「不报错但没法用」的类型：
 * - 用户资料里已经有城市了，列表里却没有 → 选择页里找不到当前城市
 * - 搜索只匹配全拼、大小写没处理 → 输「sh」一个结果都没有，看起来像没这个城市
 * - 空关键词返回全部城市 → 页面把「没在搜」当成搜索结果渲染
 *
 * 另外守一条数据底线：热门城市、种子数据里出现的城市，必须都在全部城市里。
 *
 * 运行：pnpm verify:city
 */
import assert from 'node:assert/strict'

import { ALL_CITIES, ALL_CITY_NAMES, HOT_CITIES, type City } from '@/constants/cities'
import { SEED_ME, SEED_USERS } from '@/constants/seed'
import { cityCenter, nearestCity, searchCities } from '@/utils/city'

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

function main() {
  console.log('\n换换 · 城市选择验证\n')

  step('城市数据自洽：不重名、拼音是小写字母和空格', () => {
    assert.ok(ALL_CITIES.length >= 50, `城市只有 ${ALL_CITIES.length} 个，太少了`)

    const names = new Set<string>()
    for (const city of ALL_CITIES) {
      assert.ok(!names.has(city.name), `${city.name} 重复了`)
      names.add(city.name)
      assert.ok(city.name.length >= 2, `${city.name} 名字太短，不像城市`)
      assert.match(
        city.pinyin,
        /^[a-z]+( [a-z]+)*$/,
        `${city.name} 的拼音「${city.pinyin}」格式不对：要小写、音节之间用单个空格`,
      )
    }
  })

  step('全部城市按拼音排序（长列表里才好找）', () => {
    const keys = ALL_CITIES.map((c) => c.pinyin.replace(/\s+/g, ''))
    const sorted = [...keys].sort((a, b) => a.localeCompare(b))
    assert.deepEqual(keys, sorted, '「全部城市」应该按拼音排序')
    assert.deepEqual(
      ALL_CITY_NAMES,
      ALL_CITIES.map((c) => c.name),
      'ALL_CITY_NAMES 要和 ALL_CITIES 一一对应',
    )
  })

  step('热门城市都在全部城市里', () => {
    for (const name of HOT_CITIES) {
      assert.ok(ALL_CITY_NAMES.includes(name), `热门城市 ${name} 不在全部城市列表里`)
    }
    assert.equal(new Set(HOT_CITIES).size, HOT_CITIES.length, '热门城市有重复')
  })

  step('种子数据用到的城市都能在列表里选到', () => {
    // 这条最容易被忽略：用户的城市如果是「列表外的野城市」，
    // 选择页里既看不到它被选中，也没法切回去。
    const used = new Set([SEED_ME.city, ...SEED_USERS.map((u) => u.city)].filter(Boolean))
    for (const city of used) {
      assert.ok(ALL_CITY_NAMES.includes(city), `种子数据里的 ${city} 不在城市列表里`)
    }
  })

  step('空关键词返回空数组（代表「没在搜」）', () => {
    assert.deepEqual(searchCities(''), [])
    assert.deepEqual(searchCities('   '), [], '空白字符也算没在搜')
  })

  step('中文匹配：按名字包含', () => {
    assert.deepEqual(searchCities('上海'), ['上海'])
    assert.ok(searchCities('州').length >= 10, '「州」应该命中一堆城市')
    assert.ok(searchCities('州').every((n) => n.includes('州')))
  })

  step('拼音匹配：全拼 / 音节前缀 / 首字母，都忽略大小写', () => {
    assert.ok(searchCities('shanghai').includes('上海'), '全拼')
    assert.ok(searchCities('shang').includes('上海'), '音节前缀')
    assert.ok(searchCities('SH').includes('上海'), '大写要能匹配')

    const sz = searchCities('sz')
    assert.ok(sz.includes('深圳') && sz.includes('苏州'), `sz 应该同时命中深圳和苏州，实际 ${sz}`)

    const nan = searchCities('nan')
    for (const name of ['南昌', '南京', '南宁', '南通']) {
      assert.ok(nan.includes(name), `nan 应该命中 ${name}`)
    }
  })

  step('搜不到就返回空，不要退化成「全部城市」', () => {
    assert.deepEqual(searchCities('zzzz'), [])
    assert.deepEqual(searchCities('纽约'), [], '超出覆盖范围的城市不该瞎猜')
  })

  step('保持候选顺序，且不改动入参', () => {
    const custom: City[] = [
      { name: '乙城', pinyin: 'yi cheng', lat: 30, lng: 120 },
      { name: '甲城', pinyin: 'jia cheng', lat: 40, lng: 110 },
    ]
    const frozen = Object.freeze(custom.map((c) => Object.freeze({ ...c })))

    assert.deepEqual(searchCities('城', frozen as City[]), ['乙城', '甲城'])
    assert.deepEqual(searchCities('jia', frozen as City[]), ['甲城'])
    assert.equal(custom.length, 2, '搜索不该增删候选')
  })

  step('每个城市的坐标都在中国范围内', () => {
    for (const city of ALL_CITIES) {
      assert.ok(
        city.lat > 3 && city.lat < 54,
        `${city.name} 的纬度 ${city.lat} 不在中国范围内（3~54）`,
      )
      assert.ok(
        city.lng > 73 && city.lng < 136,
        `${city.name} 的经度 ${city.lng} 不在中国范围内（73~136）`,
      )
    }
  })

  step('就近匹配：拿城市自己的坐标去定位，匹配回它自己', () => {
    // 这条把 101 个城市筛一遍：坐标写错（比如把上海的纬度填到苏州行）、
    // 或两个城市的坐标写重了，都会在这里暴露出来
    for (const city of ALL_CITIES) {
      const hit = nearestCity({ lat: city.lat, lng: city.lng })
      assert.equal(hit, city.name, `${city.name} 的坐标匹配到了 ${hit}，坐标表写错了`)
    }
  })

  step('就近匹配：真实定位点落在正确的城市', () => {
    assert.equal(nearestCity({ lat: 31.2304, lng: 121.4737 }), '上海', '人民广场')
    assert.equal(nearestCity({ lat: 39.9042, lng: 116.4074 }), '北京', '天安门')
    assert.equal(nearestCity({ lat: 22.5431, lng: 114.0579 }), '深圳', '福田')
    assert.equal(nearestCity({ lat: 23.1291, lng: 113.2644 }), '广州', '越秀')
    // 模糊定位的坐标会偏离市中心几公里，不该换城市
    assert.equal(nearestCity({ lat: 31.19, lng: 121.35 }), '上海', '虹桥附近仍是上海')
  })

  step('城市中心点：取得到就返回坐标，取不到返回 undefined', () => {
    assert.deepEqual(cityCenter('苏州'), { lat: 31.3, lng: 120.62 })
    assert.equal(cityCenter('不存在的城'), undefined)
    // 手选城市时要把中心点写进 location，否则距离会拿默认的上海坐标算
    assert.deepEqual(cityCenter('北京'), cityCenter('北京'))
  })

  step('就近匹配：候选为空时返回 null，不抛错', () => {
    assert.equal(nearestCity({ lat: 31.2, lng: 121.4 }, []), null)
  })

  console.log('\n全部通过 ✅\n')
}

main()
