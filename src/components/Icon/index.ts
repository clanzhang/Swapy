import { globalConfig } from '@nutui/icons-react-taro/dist/es/icons/internal.js'

/**
 * 图标出口。
 *
 * 三件事，缺一个都会出问题：
 *
 * 1. **把 tag 从 `i` 改成 `view`。**
 *    NutUI 图标默认渲染成 `<i>`，但 Taro 的组件表里没有 `i`
 *    （见 @tarojs/components/types，只有 View/Text/Image 这些），
 *    小程序里它会变成一个未注册标签 —— 什么都不显示，也不报错。
 *
 * 2. **按单个图标引入，不要从包根导入。**
 *    包的 package.json 里，sideEffects 把 dist/es/index.es.js 标成了有副作用，
 *    导致 barrel 不能被 tree-shake —— 从根导入会把 232 个图标全部打进包。
 *
 * 3. **颜色靠 `color` 属性。**
 *    useSvg 模式下（默认）图标是「CSS mask + 内联 SVG」实现的，
 *    color 会被写进 background-color，所以任意颜色都能用。
 *
 * 新增图标时在这里补一行即可，仍然只打包用到的那些。
 */

globalConfig.tag = 'view'

export { default as ArrowDown } from '@nutui/icons-react-taro/dist/es/icons/ArrowDown'
export { default as ArrowLeft } from '@nutui/icons-react-taro/dist/es/icons/ArrowLeft'
export { default as ArrowUp } from '@nutui/icons-react-taro/dist/es/icons/ArrowUp'
export { default as Book } from '@nutui/icons-react-taro/dist/es/icons/Book'
export { default as Close } from '@nutui/icons-react-taro/dist/es/icons/Close'
export { default as FaceMild } from '@nutui/icons-react-taro/dist/es/icons/FaceMild'
export { default as Gift } from '@nutui/icons-react-taro/dist/es/icons/Gift'
export { default as Heart } from '@nutui/icons-react-taro/dist/es/icons/Heart'
export { default as HeartFill } from '@nutui/icons-react-taro/dist/es/icons/HeartFill'
export { default as Home } from '@nutui/icons-react-taro/dist/es/icons/Home'
export { default as List } from '@nutui/icons-react-taro/dist/es/icons/List'
// NutUI 没有 Music 图标，用 Microphone 代替「乐器」品类
export { default as Microphone } from '@nutui/icons-react-taro/dist/es/icons/Microphone'
export { default as Photograph } from '@nutui/icons-react-taro/dist/es/icons/Photograph'
export { default as Plus } from '@nutui/icons-react-taro/dist/es/icons/Plus'
export { default as Setting } from '@nutui/icons-react-taro/dist/es/icons/Setting'
export { default as Star } from '@nutui/icons-react-taro/dist/es/icons/Star'
export { default as User } from '@nutui/icons-react-taro/dist/es/icons/User'
export { default as Warning } from '@nutui/icons-react-taro/dist/es/icons/Warning'

export type { NutIconProps } from '@nutui/icons-react-taro/dist/es/icons/ArrowDown'
