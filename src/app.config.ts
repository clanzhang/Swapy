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
})
