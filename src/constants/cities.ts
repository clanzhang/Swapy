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
 */
export interface City {
  name: string
  /** 空格分隔的音节 */
  pinyin: string
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
  { name: '鞍山', pinyin: 'an shan' },
  { name: '澳门', pinyin: 'ao men' },
  { name: '包头', pinyin: 'bao tou' },
  { name: '保定', pinyin: 'bao ding' },
  { name: '宝鸡', pinyin: 'bao ji' },
  { name: '北京', pinyin: 'bei jing' },
  { name: '长春', pinyin: 'chang chun' },
  { name: '常德', pinyin: 'chang de' },
  { name: '长沙', pinyin: 'chang sha' },
  { name: '常州', pinyin: 'chang zhou' },
  { name: '潮州', pinyin: 'chao zhou' },
  { name: '成都', pinyin: 'cheng du' },
  { name: '赤峰', pinyin: 'chi feng' },
  { name: '重庆', pinyin: 'chong qing' },
  { name: '大连', pinyin: 'da lian' },
  { name: '大庆', pinyin: 'da qing' },
  { name: '大同', pinyin: 'da tong' },
  { name: '东莞', pinyin: 'dong guan' },
  { name: '鄂尔多斯', pinyin: 'e er duo si' },
  { name: '佛山', pinyin: 'fo shan' },
  { name: '福州', pinyin: 'fu zhou' },
  { name: '赣州', pinyin: 'gan zhou' },
  { name: '广州', pinyin: 'guang zhou' },
  { name: '贵阳', pinyin: 'gui yang' },
  { name: '桂林', pinyin: 'gui lin' },
  { name: '哈尔滨', pinyin: 'ha er bin' },
  { name: '海口', pinyin: 'hai kou' },
  { name: '杭州', pinyin: 'hang zhou' },
  { name: '合肥', pinyin: 'he fei' },
  { name: '衡阳', pinyin: 'heng yang' },
  { name: '呼和浩特', pinyin: 'hu he hao te' },
  { name: '湖州', pinyin: 'hu zhou' },
  { name: '惠州', pinyin: 'hui zhou' },
  { name: '吉林', pinyin: 'ji lin' },
  { name: '济南', pinyin: 'ji nan' },
  { name: '嘉兴', pinyin: 'jia xing' },
  { name: '江门', pinyin: 'jiang men' },
  { name: '揭阳', pinyin: 'jie yang' },
  { name: '金华', pinyin: 'jin hua' },
  { name: '九江', pinyin: 'jiu jiang' },
  { name: '昆明', pinyin: 'kun ming' },
  { name: '拉萨', pinyin: 'la sa' },
  { name: '兰州', pinyin: 'lan zhou' },
  { name: '廊坊', pinyin: 'lang fang' },
  { name: '临沂', pinyin: 'lin yi' },
  { name: '临汾', pinyin: 'lin fen' },
  { name: '柳州', pinyin: 'liu zhou' },
  { name: '洛阳', pinyin: 'luo yang' },
  { name: '茂名', pinyin: 'mao ming' },
  { name: '绵阳', pinyin: 'mian yang' },
  { name: '南昌', pinyin: 'nan chang' },
  { name: '南京', pinyin: 'nan jing' },
  { name: '南宁', pinyin: 'nan ning' },
  { name: '南通', pinyin: 'nan tong' },
  { name: '宁波', pinyin: 'ning bo' },
  { name: '齐齐哈尔', pinyin: 'qi qi ha er' },
  { name: '青岛', pinyin: 'qing dao' },
  { name: '泉州', pinyin: 'quan zhou' },
  { name: '日照', pinyin: 'ri zhao' },
  { name: '三亚', pinyin: 'san ya' },
  { name: '汕头', pinyin: 'shan tou' },
  { name: '上海', pinyin: 'shang hai' },
  { name: '绍兴', pinyin: 'shao xing' },
  { name: '深圳', pinyin: 'shen zhen' },
  { name: '沈阳', pinyin: 'shen yang' },
  { name: '石家庄', pinyin: 'shi jia zhuang' },
  { name: '苏州', pinyin: 'su zhou' },
  { name: '台州', pinyin: 'tai zhou' },
  { name: '泰安', pinyin: 'tai an' },
  { name: '太原', pinyin: 'tai yuan' },
  { name: '泰州', pinyin: 'tai zhou' },
  { name: '唐山', pinyin: 'tang shan' },
  { name: '天津', pinyin: 'tian jin' },
  { name: '潍坊', pinyin: 'wei fang' },
  { name: '威海', pinyin: 'wei hai' },
  { name: '温州', pinyin: 'wen zhou' },
  { name: '乌鲁木齐', pinyin: 'wu lu mu qi' },
  { name: '武汉', pinyin: 'wu han' },
  { name: '无锡', pinyin: 'wu xi' },
  { name: '西安', pinyin: 'xi an' },
  { name: '西宁', pinyin: 'xi ning' },
  { name: '襄阳', pinyin: 'xiang yang' },
  { name: '香港', pinyin: 'xiang gang' },
  { name: '厦门', pinyin: 'xia men' },
  { name: '咸阳', pinyin: 'xian yang' },
  { name: '徐州', pinyin: 'xu zhou' },
  { name: '烟台', pinyin: 'yan tai' },
  { name: '盐城', pinyin: 'yan cheng' },
  { name: '扬州', pinyin: 'yang zhou' },
  { name: '宜昌', pinyin: 'yi chang' },
  { name: '银川', pinyin: 'yin chuan' },
  { name: '岳阳', pinyin: 'yue yang' },
  { name: '运城', pinyin: 'yun cheng' },
  { name: '湛江', pinyin: 'zhan jiang' },
  { name: '郑州', pinyin: 'zheng zhou' },
  { name: '镇江', pinyin: 'zhen jiang' },
  { name: '中山', pinyin: 'zhong shan' },
  { name: '珠海', pinyin: 'zhu hai' },
  { name: '株洲', pinyin: 'zhu zhou' },
  { name: '淄博', pinyin: 'zi bo' },
  { name: '遵义', pinyin: 'zun yi' },
]

const key = (c: City) => c.pinyin.replace(/\s+/g, '')

/**
 * 全部城市，**按拼音排序**。
 * 长列表（90+ 项）里逐行找比按行政级别排更好找，选择页直接按这个顺序渲染。
 */
export const ALL_CITIES: City[] = [...CITIES].sort((a, b) => key(a).localeCompare(key(b)))

/** 全部城市的名字（搜索结果、校验用） */
export const ALL_CITY_NAMES = ALL_CITIES.map((c) => c.name)
