export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/matches/index',
    'pages/publish/index',
    'pages/profile/index',
    'pages/chat/index',
    // 「我的」只做入口，资料编辑和城市选择各是一个独立页
    'pages/settings/index',
    'pages/city/index',
  ],
  tabBar: {
    color: '#9FA199',
    selectedColor: '#3C5434',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    // 原生 tabBar 不支持图标组件，也不支持 SVG，只能用本地 PNG。
    // 图片由 pnpm gen:tab-icons 从 NutUI 图标包里解出 SVG 后再栅格化。
    list: [
      {
        pagePath: 'pages/index/index',
        text: '换换',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png',
      },
      {
        pagePath: 'pages/publish/index',
        text: '发布',
        iconPath: 'assets/tab/publish.png',
        selectedIconPath: 'assets/tab/publish-active.png',
      },
      {
        pagePath: 'pages/matches/index',
        text: '匹配',
        iconPath: 'assets/tab/matches.png',
        selectedIconPath: 'assets/tab/matches-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'dark',
    backgroundColor: '#FEFDFC',
    navigationBarBackgroundColor: '#FEFDFC',
    navigationBarTitleText: '换换',
    navigationBarTextStyle: 'black',
  },
  /**
   * 「选择城市」页的「使用当前定位」要用定位接口。
   *
   * 自 2022-07-14 起，没在这里声明的定位接口调用会直接失败
   * （getLocation:fail the api need to be declared in the requiredPrivateInfos field）。
   *
   * 只能声明一个：`getLocation`（精确）和 `getFuzzyLocation`（模糊）
   * 在 requiredPrivateInfos 里互斥 —— 两个都写，微信开发者工具会直接报
   * “requiredPrivateInfos 'getFuzzyLocation' 与 'getLocation' 互斥”，
   * 而构建本身是成功的（`pnpm verify:dist` 会拦下来）。
   *
   * 这里选模糊定位：同城匹配只需要城市级精度，而且它的接口审核门槛比
   * 精确位置低。声明之外还需要在「开发管理 → 接口设置」里申请开通，
   * 并在后台「用户隐私保护指引」里勾选地理位置 —— 少一个都会 fail，
   * 客户端已做降级（提示手动选城市）。
   */
  requiredPrivateInfos: ['getFuzzyLocation'],
  permission: {
    'scope.userLocation': {
      desc: '用于推荐和你同城的物品',
    },
  },
})
