/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.gif'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'
declare module '*.css'
declare module '*.less'
declare module '*.scss'
declare module '*.sass'
declare module '*.styl'

declare module '@nutui/icons-react-taro/dist/es/icons/internal.js' {
  export const globalConfig: {
    useSvg: boolean
    classPrefix: string
    tag: string
    fontClassName: string
  }
}

// NutUI 图标没有类型声明文件（包里 types 指向的是 barrel），
// 而我们必须按单个图标引入，所以在这里补一层。
declare module '@nutui/icons-react-taro/dist/es/icons/*' {
  import type { FunctionComponent, CSSProperties } from 'react'

  export interface NutIconProps {
    /** 数字按 px 处理 */
    size?: string | number
    color?: string
    className?: string
    style?: CSSProperties
    onClick?: (e: unknown) => void
  }

  const Icon: FunctionComponent<NutIconProps>
  export default Icon
}

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production'
    /** 当前构建的平台 */
    TARO_ENV:
      | 'weapp'
      | 'swan'
      | 'alipay'
      | 'h5'
      | 'rn'
      | 'tt'
      | 'quickapp'
      | 'qq'
      | 'jd'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid，而不必手动去修改 dist/project.config.json 文件
     */
    TARO_APP_ID: string
  }
}
