/**
 * 图标验证。
 *
 * 这三件事都没法靠肉眼在 CI 里确认，但任何一件错了，表现出来都是
 * 「图标区域一片空白」，而且不报错：
 *
 * 1. 组件渲染出来的是不是 `<view>` —— NutUI 图标默认渲染成 `<i>`，
 *    而 Taro 没有注册 i 这个内置组件，小程序会当成未知标签丢掉。
 * 2. app.config 里写的 iconPath，产物里到底有没有这个文件。
 * 3. TabBar 的 PNG 是不是 81×81、透明背景、颜色正确。
 *    （qlmanage 转出来的 SVG 会带白色不透明底，肉眼在浅色 tabBar 上很难发现）
 *
 * 运行：pnpm verify:icons
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { renderToStaticMarkup } from 'react-dom/server'
import { toDashed } from '@tarojs/shared'

import {
  Book,
  Close,
  FaceMild,
  Gift,
  Heart,
  HeartFill,
  List,
  Microphone,
  Photograph,
  Plus,
  Setting,
  Star,
  User,
  ArrowUp,
} from '@/components/Icon'

// 验证脚本由 scripts/run-verify.cjs 打包成 ESM 后运行，没有 __dirname，
// 但那个 runner 固定把 cwd 设为项目根目录
const root = process.cwd()
const assetsDir = path.join(root, 'assets')
const configFile = path.join(root, 'src/app.config.ts')

const ICONS = {
  ArrowUp,
  Book,
  Close,
  FaceMild,
  Gift,
  Heart,
  HeartFill,
  List,
  Microphone,
  Photograph,
  Plus,
  Setting,
  Star,
  User,
}

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

// ------------------------------------------------------------------ PNG 解码

interface Png {
  width: number
  height: number
  colorType: number
  /** RGBA 像素，行优先 */
  pixels: Uint8Array
}

function decodePng(file: string): Png {
  const buf = fs.readFileSync(file)
  assert.ok(
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    `${file} 不是 PNG`,
  )

  let pos = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat: Buffer[] = []

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii')
    const body = buf.subarray(pos + 8, pos + 8 + len)

    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      colorType = body.readUInt8(9)
      assert.equal(body.readUInt8(12), 0, '不支持隔行扫描的 PNG')
    } else if (type === 'IDAT') {
      idat.push(body)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  assert.ok(bpp, `不支持的 colorType ${colorType}`)

  const stride = width * bpp
  const pixels = new Uint8Array(width * height * 4)
  let prev = new Uint8Array(stride)
  let offset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset]
    offset += 1
    const line = Uint8Array.from(raw.subarray(offset, offset + stride))
    offset += stride

    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let value = line[i]
      if (filter === 1) value = (value + a) & 255
      else if (filter === 2) value = (value + b) & 255
      else if (filter === 3) value = (value + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        value = (value + pr) & 255
      }
      line[i] = value
    }

    for (let x = 0; x < width; x += 1) {
      const s = x * bpp
      const d = (y * width + x) * 4
      pixels[d] = line[s]
      pixels[d + 1] = bpp >= 3 ? line[s + 1] : line[s]
      pixels[d + 2] = bpp >= 3 ? line[s + 2] : line[s]
      pixels[d + 3] = bpp === 4 ? line[s + 3] : 255
    }
    prev = line
  }

  return { width, height, colorType, pixels }
}

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`
}

function describePng(file: string) {
  const png = decodePng(file)
  const total = png.width * png.height
  const counts = new Map<string, number>()
  let opaque = 0

  for (let i = 0; i < total; i += 1) {
    const o = i * 4
    if (png.pixels[o + 3] > 200) {
      opaque += 1
      const key = hex(png.pixels[o], png.pixels[o + 1], png.pixels[o + 2])
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    width: png.width,
    height: png.height,
    colorType: png.colorType,
    opaqueRatio: opaque / total,
    dominant: dominant?.[0] ?? null,
  }
}

// -------------------------------------------------------------------- 断言

function main() {
  console.log('\n换换 · 图标验证\n')

  step('图标渲染成 <view> 而不是 <i>', () => {
    for (const [name, Icon] of Object.entries(ICONS)) {
      const html = renderToStaticMarkup(Icon({ size: 24, color: '#FF6B35' }))
      assert.ok(
        html.startsWith('<view'),
        `${name} 渲染成了 ${html.slice(0, 12)}…，Taro 没有注册这个标签，小程序里会什么都不显示`,
      )
      assert.ok(
        !html.startsWith('<i'),
        `${name} 仍然渲染成 <i>，globalConfig.tag 没生效`,
      )
      // 颜色是走 background-color + mask 的，要确认真的带上了
      assert.ok(
        html.includes('#FF6B35'),
        `${name} 的 color 属性没有落到样式里`,
      )
      assert.ok(
        html.includes('mask'),
        `${name} 没有生成 mask 样式，图标会是一个实心色块`,
      )
    }
  })

  step('图标样式能被 Taro 序列化成合法的 CSS', () => {
    // 整个图标方案都建立在「CSS mask + background-color」上。
    // NutUI 传进来的键是 `-webkitMask`（驼峰带前导横线），如果 Taro 原样输出，
    // 小程序拿到的是非法属性名 —— 图标会直接退化成一块纯色方块。
    // 这里复刻 @tarojs/runtime 的序列化逻辑跑一遍。
    const isCssVariable = (p: string) => /^--/.test(p)
    const serialize = (obj: Record<string, string>) =>
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([key, val]) => {
          let name = isCssVariable(key) ? key : toDashed(key)
          if (name.indexOf('webkit') === 0 || name.indexOf('Webkit') === 0) {
            name = `-${name}`
          }
          return `${name}: ${val};`
        })
        .join(' ')

    const css = serialize({
      backgroundColor: '#FF6B35',
      mask: "url('data:image/svg+xml;base64,AAA') 0 0/100% 100% no-repeat",
      '-webkitMask': "url('data:image/svg+xml;base64,AAA') 0 0/100% 100% no-repeat",
      width: '24px',
      height: '24px',
    })

    assert.ok(
      css.includes('-webkit-mask: url('),
      `-webkitMask 没有转换成 -webkit-mask，图标会变成纯色方块。实际：${css}`,
    )
    assert.ok(css.includes('background-color: #FF6B35'), '背景色没有输出')
  })

  step('app.config 里的 tabBar 图标在产物目录里都存在', () => {
    const source = fs.readFileSync(configFile, 'utf8')
    const paths = [...source.matchAll(/(?:iconPath|selectedIconPath):\s*'([^']+)'/g)].map(
      (m) => m[1],
    )
    assert.ok(paths.length === 8, `预期 8 个 tabBar 图标路径，实际 ${paths.length}`)

    for (const p of paths) {
      const file = path.join(assetsDir, p.replace(/^assets\//, ''))
      assert.ok(fs.existsSync(file), `产物里缺少 ${p}`)
    }
  })

  step('TabBar 图标：81×81、带透明通道、颜色正确', () => {
    const expected = [
      { file: 'tab/home.png', color: '#999999' },
      { file: 'tab/home-active.png', color: '#FF6B35' },
      { file: 'tab/publish.png', color: '#999999' },
      { file: 'tab/publish-active.png', color: '#FF6B35' },
      { file: 'tab/matches.png', color: '#999999' },
      { file: 'tab/matches-active.png', color: '#FF6B35' },
      { file: 'tab/profile.png', color: '#999999' },
      { file: 'tab/profile-active.png', color: '#FF6B35' },
    ]

    for (const { file, color } of expected) {
      const full = path.join(assetsDir, file)
      assert.ok(fs.existsSync(full), `缺少 ${file}`)

      const info = describePng(full)
      assert.equal(info.width, 81, `${file} 宽度应为 81`)
      assert.equal(info.height, 81, `${file} 高度应为 81`)
      assert.equal(info.colorType, 6, `${file} 应为 RGBA（需要透明背景）`)
      assert.ok(
        info.opaqueRatio < 0.6,
        `${file} 有 ${(info.opaqueRatio * 100).toFixed(1)}% 不透明像素，八成是带了白底`,
      )
      assert.ok(info.opaqueRatio > 0.01, `${file} 几乎全是透明像素，图标没画出来`)
      assert.equal(info.dominant, color, `${file} 主色应为 ${color}`)

      // 单文件不能超过小程序 40KB 限制
      assert.ok(
        fs.statSync(full).size < 40 * 1024,
        `${file} 超过 40KB 上限`,
      )
    }
  })

  console.log('\n全部通过 ✅\n')
}

main()
