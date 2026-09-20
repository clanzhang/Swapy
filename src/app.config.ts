import { LOCATION_ENABLED } from './config/location'

/**
 * 定位接口的声明。
 *
 * **默认不声明**（`LOCATION_ENABLED = false`）——只要声明了
 * `getFuzzyLocation` 而账号还没拿到该接口权限，微信会拒绝预览和上传：
 * `[getFuzzyLocation] is not authorized（-80424）`。
 * 那卡住的是整个小程序，不只是定位。开关在 src/config/location.ts。
 *
 * 两个注意点（`pnpm verify:dist` 会拦）：
 * 1. `getLocation`（精确）和 `getFuzzyLocation`（模糊）在这里**互斥**，
 *    同时写会被开发者工具报「文件内容错误」，且定位接口全不可用。
 *    同城匹配只要城市级精度，所以用模糊定位。
 * 2. 开关和 app.json 必须一致：开了没声明 → 接口 fail；声明了没开 →
 *    城市选择页不显示定位按钮，白声明。
 */
const locationConfig = LOCATION_ENABLED
  ? {
      requiredPrivateInfos: ['getFuzzyLocation'] as ('getFuzzyLocation' | 'getLocation')[],
      permission: { 'scope.userLocation': { desc: '用于推荐和你同城的物品' } },
    }
  : {}

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
  ...locationConfig,
})
