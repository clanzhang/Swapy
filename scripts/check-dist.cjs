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

/**
 * 闸门三：scroll-view 在 webview 渲染模式下不支持 padding。
 *
 * 它只打一条 warning、不报错，结果是内容直接贴到屏幕边缘，很难发现。
 *
 * 只检查 scroll-view **自身**的类名 —— 那确定会触发。
 * 内层包装元素的 padding 是推荐的修法，不查（它是否也会告警目前无法
 * 在本地验证，所以不当作错误，避免把正确写法标红）。
 */
function checkScrollViewPadding() {
  const srcDir = path.resolve(__dirname, '..', 'src')
  const offenders = []

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.tsx')) {
        collect(full)
      }
    }
  }

  const collect = (file) => {
    const src = fs.readFileSync(file, 'utf8')
    const rel = path.relative(path.resolve(__dirname, '..'), file)

    const re = /<ScrollView\b[\s\S]*?className=(?:'([^']+)'|"([^"]+)")/g
    let m
    while ((m = re.exec(src)) !== null) {
      const own = m[1] || m[2]
      if (classHasPadding(own)) {
        offenders.push({ file: rel, cls: own })
      }
    }
  }

  const classHasPadding = (cls) => {
    for (const file of collectWxss(distDir)) {
      const css = fs.readFileSync(file, 'utf8')
      const rule = new RegExp(`\\.${cls.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
      const hit = css.match(rule)
      if (hit && /(^|;|\s)padding/.test(hit[1])) return true
    }
    return false
  }

  walk(srcDir)

  return offenders
}

function collectWxss(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectWxss(full, out)
    else if (entry.name.endsWith('.wxss')) out.push(full)
  }
  return out
}

const scrollViewOffenders = checkScrollViewPadding()
if (scrollViewOffenders.length) {
  console.error('\n✗ scroll-view 自身的类名上不能有 padding：\n')
  for (const o of scrollViewOffenders) {
    console.error(`  ${o.file}  .${o.cls}`)
  }
  console.error(
    '\n  webview 模式下会被静默忽略（只打一条 warning），内容会贴到屏幕边缘。' +
      '\n  改用 margin，或者再包一层 View 承载内边距。\n',
  )
  process.exit(1)
}

/**
 * 闸门四：源码里用的现代 CSS 特性必须活着进到产物。
 *
 * 构建链路上有 postcss / autoprefixer / cssnano，理论上不会动 display:grid，
 * 但真被吃掉的话布局会在真机上直接崩掉，而构建和类型检查都是绿的 ——
 * 本地跑不了模拟器，只能靠比对源码和产物。
 */
function checkModernCssSurvives() {
  const features = ['display: grid', 'grid-template-rows:', 'grid-template-columns:']
  const missing = []

  const walkScss = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walkScss(full, out)
      else if (entry.name.endsWith('.scss')) out.push(full)
    }
    return out
  }

  const srcDir = path.resolve(__dirname, '..', 'src')
  const used = new Set()
  for (const file of walkScss(srcDir)) {
    const css = fs.readFileSync(file, 'utf8')
    for (const f of features) {
      if (css.includes(f)) used.add(f)
    }
  }
  if (!used.size) return missing

  const distCss = collectWxss(distDir)
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n')

  for (const f of used) {
    // 产物里是压缩过的，去掉空格再比
    const needle = f.replace(/\s+/g, '')
    if (!distCss.replace(/\s+/g, '').includes(needle)) missing.push(f)
  }

  return missing
}

const missingCss = checkModernCssSurvives()
if (missingCss.length) {
  console.error('\n✗ 源码里用了这些 CSS 特性，但产物里找不到：\n')
  for (const f of missingCss) console.error(`  ${f}`)
  console.error('\n  构建链路把它们改掉或丢掉了，真机上布局会直接崩。\n')
  process.exit(1)
}

/**
 * 闸门五：定位接口的声明。
 *
 * 这里的坑全是「构建成功、微信那边才报」的类型：
 *
 * 1. 声明了定位接口但账号没拿到该接口权限 → **预览和上传直接被微信拒**：
 *    `[getFuzzyLocation] is not authorized（-80424）`。卡住的是整个小程序，
 *    不只是定位能用不能用。所以声明绑在 `LOCATION_ENABLED` 开关上，默认关。
 * 2. `getLocation`（精确）和 `getFuzzyLocation`（模糊）互斥，两个都写会被
 *    开发者工具报「文件内容错误」，而且定位接口全不可用。
 * 3. 开关和 app.json 必须一致：开了没声明 → 接口 fail；声明了没开 →
 *    城市选择页不渲染定位按钮，白声明。
 */
function checkLocationDeclaration() {
  const appJsonPath = path.join(distDir, 'app.json')
  const flagFile = path.resolve(__dirname, '..', 'src/config/location.ts')
  if (!fs.existsSync(appJsonPath) || !fs.existsSync(flagFile)) return null

  const declared = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).requiredPrivateInfos || []

  if (declared.includes('getLocation') && declared.includes('getFuzzyLocation')) {
    return 'requiredPrivateInfos 里同时声明了 getLocation 和 getFuzzyLocation —— 这两个接口互斥，只能留一个'
  }

  const enabled = /LOCATION_ENABLED\s*=\s*true/.test(fs.readFileSync(flagFile, 'utf8'))
  const declaredFuzzy = declared.includes('getFuzzyLocation')

  if (enabled !== declaredFuzzy) {
    return enabled
      ? 'LOCATION_ENABLED=true，但 dist/app.json 没声明 getFuzzyLocation（运行时接口会直接 fail）'
      : 'dist/app.json 声明了 getFuzzyLocation，但 LOCATION_ENABLED=false —— 预览和上传会被微信拒（-80424），要么改回 false 要么把开关打开'
  }

  return null
}

const locationProblem = checkLocationDeclaration()
if (locationProblem) {
  console.error('\n✗ 定位接口声明有问题：\n')
  console.error(`  ${locationProblem}\n`)
  console.error(
    '  修法：开关在 src/config/location.ts（LOCATION_ENABLED），\n' +
      '  app.json 的声明由 src/app.config.ts 根据它生成，两边必须一致。\n',
  )
  process.exit(1)
}

const locationDeclared = JSON.parse(
  fs.readFileSync(path.join(distDir, 'app.json'), 'utf8'),
).requiredPrivateInfos?.length

console.log(
  '✓ 产物体检通过：process 引用 / HTML 标签映射 / scroll-view padding / 现代 CSS 特性 / 定位声明',
)
console.log(
  locationDeclared
    ? '  · 定位接口：已启用（getFuzzyLocation，城市选择页有「使用当前定位」）'
    : '  · 定位接口：未启用（LOCATION_ENABLED=false，城市选择页不显示定位按钮）',
)
