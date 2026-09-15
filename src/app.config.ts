export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/matches/index',
    'pages/publish/index',
    'pages/profile/index',
    'pages/chat/index',
  ],
  tabBar: {
    color: '#B8B8BD',
    selectedColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '换换' },
      { pagePath: 'pages/matches/index', text: '匹配' },
      { pagePath: 'pages/publish/index', text: '发布' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'dark',
    backgroundColor: '#F7F7F9',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: '换换',
    navigationBarTextStyle: 'black',
  },
})
