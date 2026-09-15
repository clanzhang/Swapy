/**
 * 生成 TabBar 用的 PNG 图标。
 *
 * 为什么需要这一步：小程序**原生 tabBar 只能用本地图片**，不支持图标组件，
 * 也不支持 SVG。而页面内的图标是组件化的（矢量、可换色），两者不能共用同一份资源。
 *
 * NutUI 的图标包里，每个图标都内联了一份 base64 SVG（不是 CDN 字体，
 * 所以不违反小程序的外链限制）。这里把 SVG 解出来、换成目标颜色、
 * 用 resvg 栅格化成 81×81 的透明 PNG。
 *
 * 为什么不用 qlmanage / sips：qlmanage 能转 SVG，但输出**带白色不透明底**，
 * 放进 tabBar 会是一个白方块。resvg 输出的是透明背景。
 *
 * 运行：pnpm gen:tab-icons
 */
const fs = require('node:fs')
const path = require('node:path')

const { Resvg } = require('@resvg/resvg-js')

const root = path.resolve(__dirname, '..')
const iconDir = path.join(
  root,
  'node_modules/@nutui/icons-react-taro/dist/es/icons',
)
const outDir = path.join(root, 'assets/tab')

/** 尺寸建议值，见微信 tabBar 文档 */
const SIZE = 81
/** 字形四周留白比例，贴边会显得很挤 */
const INSET = 0.1

const COLORS = {
  normal: '#999999',
  active: '#FF6B35',
}

/**
 * 规格里写的是 Home / HomeActive 这样成对的图标，但 NutUI 只提供单色图标，
 * 没有 *Active 变体。所以未选中/选中用同一个字形、两种颜色。
 */
const ICONS = [
  { file: 'home', icon: 'Home' },
  { file: 'publish', icon: 'Plus' },
  { file: 'matches', icon: 'Heart' },
  { file: 'profile', icon: 'User' },
]

/** 从 NutUI 图标模块里把内联的 base64 SVG 抠出来 */
function readSvg(iconName) {
  const file = path.join(iconDir, `${iconName}.js`)
  if (!fs.existsSync(file)) {
    throw new Error(`找不到图标 ${iconName}：${file}`)
  }
  const source = fs.readFileSync(file, 'utf8')
  const match = source.match(/svg64:\s*"data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/)
  if (!match) {
    throw new Error(`图标 ${iconName} 里没有解析到内联 SVG`)
  }
  return Buffer.from(match[1], 'base64').toString('utf8')
}

/**
 * 给图标换色并留出内边距。
 *
 * 做法是把所有子元素的 fill 删掉，改成根节点统一 fill —— 这样深浅两种颜色
 * 用同一份路径就不会有漏改的。再包一层 g 做缩放，避免字形贴边。
 */
function paint(svg, color) {
  const stripped = svg.replace(/\sfill="[^"]*"/g, '')
  const inset = (1024 * INSET) / 1
  const scale = 1 - INSET * 2

  return stripped.replace(
    /(<svg[^>]*>)([\s\S]*)(<\/svg>)/,
    (_m, open, body, close) =>
      `${open}<g fill="${color}" transform="translate(${inset} ${inset}) scale(${scale})">${body}</g>${close}`,
  )
}

function render(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: SIZE },
    // 明确不设背景色，保持透明
    background: 'rgba(0,0,0,0)',
  })
  return resvg.render().asPng()
}

function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const written = []

  for (const { file, icon } of ICONS) {
    const raw = readSvg(icon)

    for (const [state, color] of Object.entries(COLORS)) {
      const name = state === 'normal' ? `${file}.png` : `${file}-active.png`
      const target = path.join(outDir, name)
      const png = render(paint(raw, color))
      fs.writeFileSync(target, png)

      if (png.length > 40 * 1024) {
        throw new Error(`${name} 有 ${(png.length / 1024).toFixed(1)}KB，超过小程序 40KB 限制`)
      }
      written.push({ name, bytes: png.length, color })
    }
  }

  console.log(`\n已生成 ${written.length} 个 TabBar 图标 → assets/tab/\n`)
  for (const w of written) {
    console.log(`  ${w.name.padEnd(20)} ${String(w.bytes).padStart(6)} B   ${w.color}`)
  }
  console.log('')
}

main()
