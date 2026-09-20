/**
 * 城市数据。
 *
 * 为什么单独抽一个文件：这份列表以前在「我的」页和引导弹窗里各抄了一份
 * （都只有 10 个热门城市）。于是**用户资料里已经存在的城市，在选择页里找不到**，
 * 表现成「我明明在上海，城市列表里却没有上海可选」—— 不报错，但没法用。
 * 现在只有这一个数据源，`pnpm verify:city` 会守住「种子数据用到的城市都在列表里」。
 *
 * pinyin 用空格分隔音节、小写无音调。搜索时同时支持三种输入：
 * - 中文：上海 / 海
 * - 全拼：shanghai
 * - 首字母与音节前缀：sh / shang / sz
 * 详见 src/utils/city.ts 的 searchCities。
 *
 * lat / lng 是市中心坐标，用于「定位到当前城市」的就近匹配，见 src/utils/city.ts
 * 的 nearestCity / cityCenter。
 */
export interface City {
  name: string
  /** 空格分隔的音节 */
  pinyin: string
  /** 市中心纬度。用于「定位到当前城市」的就近匹配，精度到城市级就够 */
  lat: number
  /** 市中心经度 */
  lng: number
}

/** 热门城市：按用户量级排的，选择页第一屏直接给出来，不用搜 */
export const HOT_CITIES = [
  '上海',
  '北京',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '南京',
  '西安',
  '重庆',
]

const CITIES: City[] = [
  { name: '鞍山', pinyin: 'an shan', lat: 41.11, lng: 122.99 },
  { name: '澳门', pinyin: 'ao men', lat: 22.2, lng: 113.54 },
  { name: '包头', pinyin: 'bao tou', lat: 40.66, lng: 109.84 },
  { name: '保定', pinyin: 'bao ding', lat: 38.87, lng: 115.46 },
  { name: '宝鸡', pinyin: 'bao ji', lat: 34.36, lng: 107.24 },
  { name: '北京', pinyin: 'bei jing', lat: 39.9, lng: 116.41 },
  { name: '长春', pinyin: 'chang chun', lat: 43.82, lng: 125.32 },
  { name: '常德', pinyin: 'chang de', lat: 29.03, lng: 111.7 },
  { name: '长沙', pinyin: 'chang sha', lat: 28.23, lng: 112.94 },
  { name: '常州', pinyin: 'chang zhou', lat: 31.81, lng: 119.97 },
  { name: '潮州', pinyin: 'chao zhou', lat: 23.66, lng: 116.62 },
  { name: '成都', pinyin: 'cheng du', lat: 30.57, lng: 104.07 },
  { name: '赤峰', pinyin: 'chi feng', lat: 42.26, lng: 118.89 },
  { name: '重庆', pinyin: 'chong qing', lat: 29.56, lng: 106.55 },
  { name: '大连', pinyin: 'da lian', lat: 38.91, lng: 121.61 },
  { name: '大庆', pinyin: 'da qing', lat: 46.59, lng: 125.1 },
  { name: '大同', pinyin: 'da tong', lat: 40.08, lng: 113.3 },
  { name: '东莞', pinyin: 'dong guan', lat: 23.02, lng: 113.75 },
  { name: '鄂尔多斯', pinyin: 'e er duo si', lat: 39.61, lng: 109.78 },
  { name: '佛山', pinyin: 'fo shan', lat: 23.02, lng: 113.12 },
  { name: '福州', pinyin: 'fu zhou', lat: 26.07, lng: 119.3 },
  { name: '赣州', pinyin: 'gan zhou', lat: 25.83, lng: 114.93 },
  { name: '广州', pinyin: 'guang zhou', lat: 23.13, lng: 113.26 },
  { name: '贵阳', pinyin: 'gui yang', lat: 26.65, lng: 106.63 },
  { name: '桂林', pinyin: 'gui lin', lat: 25.27, lng: 110.29 },
  { name: '哈尔滨', pinyin: 'ha er bin', lat: 45.8, lng: 126.53 },
  { name: '海口', pinyin: 'hai kou', lat: 20.04, lng: 110.32 },
  { name: '杭州', pinyin: 'hang zhou', lat: 30.27, lng: 120.16 },
  { name: '合肥', pinyin: 'he fei', lat: 31.82, lng: 117.23 },
  { name: '衡阳', pinyin: 'heng yang', lat: 26.89, lng: 112.57 },
  { name: '呼和浩特', pinyin: 'hu he hao te', lat: 40.84, lng: 111.75 },
  { name: '湖州', pinyin: 'hu zhou', lat: 30.89, lng: 120.09 },
  { name: '惠州', pinyin: 'hui zhou', lat: 23.11, lng: 114.42 },
  { name: '吉林', pinyin: 'ji lin', lat: 43.84, lng: 126.55 },
  { name: '济南', pinyin: 'ji nan', lat: 36.65, lng: 117.12 },
  { name: '嘉兴', pinyin: 'jia xing', lat: 30.75, lng: 120.76 },
  { name: '江门', pinyin: 'jiang men', lat: 22.58, lng: 113.08 },
  { name: '揭阳', pinyin: 'jie yang', lat: 23.55, lng: 116.37 },
  { name: '金华', pinyin: 'jin hua', lat: 29.08, lng: 119.65 },
  { name: '九江', pinyin: 'jiu jiang', lat: 29.71, lng: 116 },
  { name: '昆明', pinyin: 'kun ming', lat: 25.04, lng: 102.71 },
  { name: '拉萨', pinyin: 'la sa', lat: 29.65, lng: 91.14 },
  { name: '兰州', pinyin: 'lan zhou', lat: 36.06, lng: 103.83 },
  { name: '廊坊', pinyin: 'lang fang', lat: 39.52, lng: 116.7 },
  { name: '临沂', pinyin: 'lin yi', lat: 35.1, lng: 118.36 },
  { name: '临汾', pinyin: 'lin fen', lat: 36.09, lng: 111.52 },
  { name: '柳州', pinyin: 'liu zhou', lat: 24.33, lng: 109.42 },
  { name: '洛阳', pinyin: 'luo yang', lat: 34.62, lng: 112.45 },
  { name: '茂名', pinyin: 'mao ming', lat: 21.66, lng: 110.93 },
  { name: '绵阳', pinyin: 'mian yang', lat: 31.47, lng: 104.68 },
  { name: '南昌', pinyin: 'nan chang', lat: 28.68, lng: 115.86 },
  { name: '南京', pinyin: 'nan jing', lat: 32.06, lng: 118.8 },
  { name: '南宁', pinyin: 'nan ning', lat: 22.82, lng: 108.37 },
  { name: '南通', pinyin: 'nan tong', lat: 31.98, lng: 120.89 },
  { name: '宁波', pinyin: 'ning bo', lat: 29.87, lng: 121.55 },
  { name: '齐齐哈尔', pinyin: 'qi qi ha er', lat: 47.35, lng: 123.92 },
  { name: '青岛', pinyin: 'qing dao', lat: 36.07, lng: 120.38 },
  { name: '泉州', pinyin: 'quan zhou', lat: 24.87, lng: 118.68 },
  { name: '日照', pinyin: 'ri zhao', lat: 35.42, lng: 119.53 },
  { name: '三亚', pinyin: 'san ya', lat: 18.25, lng: 109.51 },
  { name: '汕头', pinyin: 'shan tou', lat: 23.35, lng: 116.68 },
  { name: '上海', pinyin: 'shang hai', lat: 31.23, lng: 121.47 },
  { name: '绍兴', pinyin: 'shao xing', lat: 30, lng: 120.58 },
  { name: '深圳', pinyin: 'shen zhen', lat: 22.54, lng: 114.06 },
  { name: '沈阳', pinyin: 'shen yang', lat: 41.81, lng: 123.43 },
  { name: '石家庄', pinyin: 'shi jia zhuang', lat: 38.04, lng: 114.51 },
  { name: '苏州', pinyin: 'su zhou', lat: 31.3, lng: 120.62 },
  { name: '台州', pinyin: 'tai zhou', lat: 28.66, lng: 121.42 },
  { name: '泰安', pinyin: 'tai an', lat: 36.19, lng: 117.09 },
  { name: '太原', pinyin: 'tai yuan', lat: 37.87, lng: 112.55 },
  { name: '泰州', pinyin: 'tai zhou', lat: 32.46, lng: 119.92 },
  { name: '唐山', pinyin: 'tang shan', lat: 39.63, lng: 118.18 },
  { name: '天津', pinyin: 'tian jin', lat: 39.08, lng: 117.2 },
  { name: '潍坊', pinyin: 'wei fang', lat: 36.71, lng: 119.16 },
  { name: '威海', pinyin: 'wei hai', lat: 37.51, lng: 122.12 },
  { name: '温州', pinyin: 'wen zhou', lat: 27.99, lng: 120.7 },
  { name: '乌鲁木齐', pinyin: 'wu lu mu qi', lat: 43.83, lng: 87.62 },
  { name: '武汉', pinyin: 'wu han', lat: 30.59, lng: 114.31 },
  { name: '无锡', pinyin: 'wu xi', lat: 31.49, lng: 120.31 },
  { name: '西安', pinyin: 'xi an', lat: 34.34, lng: 108.94 },
  { name: '西宁', pinyin: 'xi ning', lat: 36.62, lng: 101.78 },
  { name: '襄阳', pinyin: 'xiang yang', lat: 32.01, lng: 112.12 },
  { name: '香港', pinyin: 'xiang gang', lat: 22.32, lng: 114.17 },
  { name: '厦门', pinyin: 'xia men', lat: 24.48, lng: 118.09 },
  { name: '咸阳', pinyin: 'xian yang', lat: 34.33, lng: 108.71 },
  { name: '徐州', pinyin: 'xu zhou', lat: 34.27, lng: 117.19 },
  { name: '烟台', pinyin: 'yan tai', lat: 37.46, lng: 121.45 },
  { name: '盐城', pinyin: 'yan cheng', lat: 33.35, lng: 120.16 },
  { name: '扬州', pinyin: 'yang zhou', lat: 32.39, lng: 119.42 },
  { name: '宜昌', pinyin: 'yi chang', lat: 30.69, lng: 111.29 },
  { name: '银川', pinyin: 'yin chuan', lat: 38.49, lng: 106.23 },
  { name: '岳阳', pinyin: 'yue yang', lat: 29.36, lng: 113.13 },
  { name: '运城', pinyin: 'yun cheng', lat: 35.03, lng: 111 },
  { name: '湛江', pinyin: 'zhan jiang', lat: 21.27, lng: 110.36 },
  { name: '郑州', pinyin: 'zheng zhou', lat: 34.75, lng: 113.63 },
  { name: '镇江', pinyin: 'zhen jiang', lat: 32.19, lng: 119.45 },
  { name: '中山', pinyin: 'zhong shan', lat: 22.52, lng: 113.39 },
  { name: '珠海', pinyin: 'zhu hai', lat: 22.27, lng: 113.58 },
  { name: '株洲', pinyin: 'zhu zhou', lat: 27.83, lng: 113.13 },
  { name: '淄博', pinyin: 'zi bo', lat: 36.81, lng: 118.05 },
  { name: '遵义', pinyin: 'zun yi', lat: 27.73, lng: 106.93 },
]

const key = (c: City) => c.pinyin.replace(/\s+/g, '')

/**
 * 全部城市，**按拼音排序**。
 * 长列表（90+ 项）里逐行找比按行政级别排更好找，选择页直接按这个顺序渲染。
 */
export const ALL_CITIES: City[] = [...CITIES].sort((a, b) => key(a).localeCompare(key(b)))

/** 全部城市的名字（搜索结果、校验用） */
export const ALL_CITY_NAMES = ALL_CITIES.map((c) => c.name)
