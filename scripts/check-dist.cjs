/**
 * 构建产物体检。
 *
 * 背景：小程序运行时没有 `process` 对象。任何没被编译期替换掉的
 * `process.env.X` 都会在 app 启动瞬间抛 “process is not defined”，
 * 而且这个错误只在开发者工具/真机里才暴露 —— 构建本身是成功的。
 *
 * 这个坑已经踩过一次（Taro 只自动替换它已知的 env key，需要显式写进
 * defineConstants）。所以在这里加一道静态闸门。
 */
const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '..', 'dist')

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

if (!fs.existsSync(distDir)) {
  console.error('✗ 找不到 dist/，先跑一次构建')
  process.exit(1)
}

/**
 * 闸门二：NutUI 的组件渲染的是 HTML 标签（div / span / input）。
 * Taro 的内置组件表里没有这些，必须靠 @tarojs/plugin-html 在运行时
 * 把它们映射成 view / text。少了这个插件，小程序会在控制台抛
 * `Template tmpl_0_div not found`，对应区域直接不渲染 —— 而且构建是成功的。
 *
 * 注意：装了插件之后产物里依然会有 createElement("div")，
 * 插件是在运行时改写节点名的，所以这里只能查「配置里有没有插件」。
 */
const HTML_TAGS = [
  'div', 'span', 'p', 'ul', 'ol', 'li', 'table', 'form', 'label',
  'section', 'header', 'footer', 'article', 'nav', 'svg', 'body',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'samp', 'cite',
]

function collectJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectJsFiles(full, out)
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

function checkHtmlPlugin() {
  const found = new Set()
  for (const file of collectJsFiles(distDir)) {
    const code = fs.readFileSync(file, 'utf8')
    for (const tag of HTML_TAGS) {
      if (code.includes(`createElement("${tag}"`)) found.add(tag)
    }
  }
  if (!found.size) return null

  const config = fs.readFileSync(
    path.resolve(__dirname, '..', 'config/index.ts'),
    'utf8',
  )
  if (config.includes('@tarojs/plugin-html')) return null

  return [...found].sort()
}

const missingHtmlPlugin = checkHtmlPlugin()
if (missingHtmlPlugin) {
  console.error(
    '\n✗ 产物里有 HTML 标签，但 config/index.ts 里没启用 @tarojs/plugin-html：\n',
  )
  console.error(`  ${missingHtmlPlugin.join(', ')}`)
  console.error(
    '\n  Taro 没有注册这些标签，小程序会抛 `Template tmpl_0_xxx not found`，' +
      '\n  对应区域直接不渲染，而且构建是成功的、只在控制台报错。\n',
  )
  process.exit(1)
}

const offenders = []

for (const file of walk(distDir)) {
  const code = fs.readFileSync(file, 'utf8')
  const matches = code.match(/process\.[A-Za-z_$][\w$]*/g)
  if (matches) {
    offenders.push({
      file: path.relative(distDir, file),
      hits: [...new Set(matches)],
    })
  }
}

if (offenders.length) {
  console.error('\n✗ 构建产物里残留了 process 引用，小程序运行时会崩：\n')
  for (const o of offenders) {
    console.error(`  ${o.file}: ${o.hits.join(', ')}`)
  }
  console.error(
    '\n  修法：把对应的 process.env.X 加进 config/index.ts 的 defineConstants。\n',
  )
  process.exit(1)
}

console.log('✓ 产物体检通过：无残留 process 引用，HTML 标签映射已启用')
