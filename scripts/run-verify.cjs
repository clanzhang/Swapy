/**
 * 用 esbuild 把验证脚本打成单文件（顺带解析 tsconfig 的 @ 路径别名），
 * 再把 @tarojs/taro 换成 Node 替身，最后丢给 node 执行。
 *
 * 之所以要绕这一圈：源码里用了 `@/` 别名，而 Node 原生不认 tsconfig paths。
 *
 * 用法：node scripts/run-verify.cjs [脚本名，默认 verify-matching]
 */
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const root = path.resolve(__dirname, '..')
const name = process.argv[2] || 'verify-matching'
const entry = path.join(root, 'scripts', `${name}.ts`)

if (!fs.existsSync(entry)) {
  console.error(`✗ 找不到验证脚本：scripts/${name}.ts`)
  process.exit(1)
}

const esbuild = require('esbuild')

const out = path.join(root, '.tmp', `${name}.mjs`)

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: out,
  logLevel: 'warning',
  // 这些包内部走 CJS（会 require('react') / require('stream')），
  // 打进 ESM 后运行时拿不到 require，所以留给 Node 自己解析
  external: [
    'react',
    'react-dom',
    'react-dom/server',
    'zustand',
    'use-sync-external-store',
    'use-sync-external-store/shim/with-selector',
  ],
  alias: {
    '@tarojs/taro': path.join(root, 'scripts/stub-taro.ts'),
  },
})

try {
  execFileSync(process.execPath, [out], { stdio: 'inherit', cwd: root })
} catch {
  process.exit(1)
} finally {
  fs.rmSync(out, { force: true })
}
