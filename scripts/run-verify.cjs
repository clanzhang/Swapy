/**
 * 用 esbuild 把验证脚本打成单文件（顺带解析 tsconfig 的 @ 路径别名），
 * 再把 @tarojs/taro 换成 Node 替身，最后丢给 node 执行。
 *
 * 之所以要绕这一圈：源码里用了 `@/` 别名，而 Node 原生不认 tsconfig paths。
 */
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const root = path.resolve(__dirname, '..')
const out = path.join(root, '.tmp', 'verify-matching.mjs')

const esbuild = require('esbuild')

esbuild.buildSync({
  entryPoints: [path.join(root, 'scripts/verify-matching.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: out,
  logLevel: 'warning',
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
