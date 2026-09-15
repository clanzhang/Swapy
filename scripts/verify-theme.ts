/**
 * 设计变量的验证。
 *
 * 色板在项目里有两份：`src/styles/variables.scss`（给样式用）
 * 和 `src/constants/index.ts` 的 THEME（给组件的 color 属性用）。
 * 两份必然会漂移，症状是「图标和文字颜色对不上」——
 * 不报错、不崩溃，只是看着别扭，很难归因。
 *
 * 另外顺便守住「不能再出现旧配色」这条线：换肤之后残留一个橙色按钮，
 * 视觉上非常刺眼但很容易漏。
 *
 * 运行：pnpm verify:theme
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { THEME } from '@/constants'

const root = process.cwd()
const scssFile = path.join(root, 'src/styles/variables.scss')

/** SCSS 变量名 -> THEME 字段名 */
const PAIRS: [string, keyof typeof THEME][] = [
  ['brand', 'primary'],
  ['brand-deep', 'primaryDeep'],
  ['accent', 'accent'],
  ['gold', 'gold'],
  ['sage', 'sage'],
  ['text', 'text'],
  ['text-sub', 'textSub'],
  ['bg', 'bg'],
]

/** 换肤前的旧配色，出现任何一个都说明有地方漏改了 */
const LEGACY_COLORS = [
  '#FF6B35',
  '#E2551F',
  '#FFF3E0',
  '#F7F7F9',
  '#8A8A8E',
  '#B8B8BD',
  '#1F1F1F',
  '#F0F0F0',
  '#999999',
]

function readScssVar(name: string): string | null {
  const src = fs.readFileSync(scssFile, 'utf8')
  const m = src.match(new RegExp(`\\$${name}:\\s*(#[0-9a-fA-F]{3,8});`))
  return m ? m[1].toUpperCase() : null
}

function collectFiles(dir: string, exts: string[], out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(full, exts, out)
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full)
  }
  return out
}

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

function main() {
  console.log('\n换换 · 设计变量验证\n')

  step('SCSS 色板和 THEME 完全一致', () => {
    const diff: string[] = []

    for (const [scssName, themeKey] of PAIRS) {
      const scss = readScssVar(scssName)
      const ts = String(THEME[themeKey]).toUpperCase()

      if (!scss) {
        diff.push(`$${scssName} 在 variables.scss 里找不到`)
        continue
      }
      if (scss !== ts) {
        diff.push(`$${scssName}=${scss}  但 THEME.${themeKey}=${ts}`)
      }
    }

    assert.equal(
      diff.length,
      0,
      `两份色板已经不一致（改一处要一起改）：\n    ${diff.join('\n    ')}`,
    )
  })

  step('不能再出现换肤前的旧配色', () => {
    const files = collectFiles(path.join(root, 'src'), ['.scss', '.tsx', '.ts']).filter(
      // 变量文件本身要定义新色板，允许它出现（虽然现在也没有旧色）
      (f) => !f.endsWith('variables.scss'),
    )

    const hits: string[] = []
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      for (const color of LEGACY_COLORS) {
        if (content.toUpperCase().includes(color.toUpperCase())) {
          hits.push(`${path.relative(root, file)} 含 ${color}`)
        }
      }
    }

    assert.equal(hits.length, 0, `发现旧配色残留：\n    ${hits.join('\n    ')}`)
  })

  step('TabBar 图标用的就是色板里的颜色', () => {
    const config = fs.readFileSync(path.join(root, 'src/app.config.ts'), 'utf8')
    const color = config.match(/color:\s*'(#[0-9a-fA-F]{6})'/)?.[1].toUpperCase()
    const selected = config.match(/selectedColor:\s*'(#[0-9a-fA-F]{6})'/)?.[1].toUpperCase()

    assert.equal(color, THEME.textSub.toUpperCase(), 'tabBar 未选中色应该是灰绿')
    assert.equal(selected, THEME.primary.toUpperCase(), 'tabBar 选中色应该是深墨绿')
  })

  step('主色是深墨绿，不是高饱和的电商色', () => {
    // 规范要求「温暖自然、环保循环感」，深墨绿的 G 通道应当明显高于 R 和 B。
    // 这条断言防止有人手滑换回橙红系。
    const rgb = THEME.primary
      .replace('#', '')
      .match(/.{2}/g)!
      .map((h) => parseInt(h, 16))

    assert.ok(rgb[1] > rgb[0], `主色 ${THEME.primary} 的绿通道应该高于红通道`)
    assert.ok(rgb[1] > rgb[2], `主色 ${THEME.primary} 的绿通道应该高于蓝通道`)
    assert.ok(rgb[0] < 120 && rgb[1] < 120, `主色 ${THEME.primary} 应该是低饱和的深色`)
  })

  console.log('\n全部通过 ✅\n')
}

main()
