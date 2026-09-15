import { useLaunch } from '@tarojs/taro'
import { type PropsWithChildren } from 'react'

import { useUserStore } from '@/store/userStore'

// NutUI 组件样式（按需），必须在业务样式之前引入
import '@/styles/nutui'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    // 只在这里触发一次登录，页面通过 userStore.ready 判断是否就绪
    void useUserStore.getState().init()
  })

  return children
}

export default App
