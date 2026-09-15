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

console.log('✓ 产物体检通过：没有残留的 process 引用')
