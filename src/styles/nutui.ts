/**
 * NutUI 样式按需引入。
 *
 * 直接 `import '@nutui/nutui-react-taro/dist/style.css'` 会带进 208KB 的全部组件样式，
 * 而本产品只用到这几个组件，所以逐个引它们已编译好的 style.css（用到的变量都有
 * `var(--nutui-x, fallback)` 兜底，不需要额外引主题变量文件）。
 *
 * 新增 NutUI 组件时，记得在这里补一行。总量对比：20KB vs 208KB。
 *
 * 注意每个 .css 是独立的，不会带上它自己的依赖：
 *   Cell → 需要 CellGroup 的样式；Dialog → 需要 Button / Overlay 的样式。
 */
import '@nutui/nutui-react-taro/dist/esm/avatar/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/badge/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/button/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/cell/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/cellgroup/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/dialog/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/input/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/overlay/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/textarea/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/popup/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/searchbar/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/tag/style/style.css'
import '@nutui/nutui-react-taro/dist/esm/uploader/style/style.css'
// NutUI 图标的基础样式（7.4KB）。图标本身是 useSvg 模式：
// 内联 SVG + CSS mask，不需要那份 189KB 的 iconfont 样式。
import '@nutui/icons-react-taro/dist/style_icon.css'
