/**
 * 发布内容规则校验的验证。
 *
 * 这里真正要防的不是「漏拦」而是「误伤」——
 * 一个合法书名被拦下来，用户就直接流失了。
 * 所以「不该拦」的样例比「该拦」的样例更重要。
 *
 * 运行：pnpm verify:moderation
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { describeHits, moderateItem, moderateText } from '@/utils/moderation'
import type { ModerationCategory, ModerationHit } from '@/utils/moderation'

/**
 * 云函数那份规则是同一套逻辑的另一份拷贝（云函数各自独立打包，无法共享代码）。
 * 两份必然会漂移，所以用同一组样例把它们钉在一起。
 */
const cloudRequire = createRequire(`${process.cwd()}/`)
const cloudModeration = cloudRequire('./cloudfunctions/publishItem/moderation.js')

/** 必须拦下 */
const SHOULD_BLOCK: { text: string; category: ModerationCategory; why: string }[] = [
  // ---- A 违法违禁
  { text: '出 一把管制刀具，自提', category: 'illegal', why: '管制刀具' },
  { text: '代开发票，长期有效', category: 'illegal', why: '假发票' },
  { text: '电子烟弹 一批', category: 'illegal', why: '电子烟' },
  { text: '象牙手串 保真', category: 'illegal', why: '野生动物制品' },
  { text: '六合彩资料 内部', category: 'illegal', why: '赌博' },
  { text: '银行卡 一套 转让', category: 'illegal', why: '银行卡买卖' },

  // ---- B 平台外内容
  { text: '招聘兼职 日结200', category: 'offplatform', why: '招聘' },
  { text: '合租单间 拎包入住', category: 'offplatform', why: '租房' },
  { text: '网课资源 打包出', category: 'offplatform', why: '虚拟内容' },
  { text: '接单刷单 一单20', category: 'offplatform', why: '刷单' },
  { text: '贷款秒批 不看征信', category: 'offplatform', why: '贷款' },
  { text: '游戏点卡 充值卡 9折', category: 'offplatform', why: '虚拟商品' },

  // ---- C 联系方式
  { text: 'iPhone 12 微信同号 13800138000', category: 'contact', why: '手机号' },
  { text: '详情加我 微信号：abc12345', category: 'contact', why: '微信号' },
  { text: '有意 QQ：12345678', category: 'contact', why: 'QQ 号' },
  { text: '扫码加我 有惊喜', category: 'contact', why: '引流话术' },
  { text: '详见 http://taobao.com/abc', category: 'contact', why: '站外链接' },
  { text: '联系邮箱 hello@example.com', category: 'contact', why: '邮箱' },

  // 书名号不能成为绕过审核的后门
  { text: '《电子烟使用指南》 出', category: 'illegal', why: '书名号不豁免违法违禁' },
  { text: '《微信 abc12345》 加我', category: 'contact', why: '书名号不豁免联系方式' },
]

/**
 * 一条都不能拦。这些是真实场景里会出现的写法，
 * 尤其是含「微信」的书名和带否定词的说法。
 */
const SHOULD_PASS: { text: string; why: string }[] = [
  { text: '《微信小程序开发实战》 九成新', why: '书名含「微信」，后面不是账号形态' },
  { text: '非微商货源，专柜正品', why: '否定语境' },
  { text: '原装充电器，不是山寨', why: '否定语境' },
  { text: '没有二维码，纯线下当面交易', why: '否定语境（前两个字）' },
  { text: 'iPhone 12 128G 蓝色 95新 可当面验机', why: '正常描述' },
  { text: '乐高 10295 保时捷 911，零件齐全，说明书和原盒都在', why: '正常描述' },
  { text: '雅马哈 F310 民谣吉他，换了达达里奥琴弦，带琴包和变调夹', why: '正常描述' },
  { text: '《人类简史》三部曲，只翻过一遍，无笔记无划线', why: '正常描述' },
  { text: '自提优先，非诚勿扰', why: '常见口语' },
  { text: '不支持邮寄，只接受当面交换', why: '否定语境 + 正常描述' },
  { text: '无划痕无磕碰，功能一切正常', why: '正常描述' },
  { text: '原味奶茶机 未拆封', why: '「原味」单独出现不算违规' },
  { text: '烟灰缸 陶瓷 全新', why: '「烟」在别的词里' },
  { text: '不抽烟，物品无烟味', why: '否定语境' },
  { text: '《招聘管理实务》 第二版', why: '书名号内的词不该按招工广告拦' },
  { text: '《网络营销推广实务》教材', why: '书名号豁免' },
  { text: '《租房经济学》 有笔记', why: '书名号豁免' },
  { text: '《微商思维》 只看了一遍', why: '书名号豁免' },
]

function step(title: string, fn: () => void) {
  fn()
  console.log(`  ✓ ${title}`)
}

function main() {
  console.log('\n换换 · 发布内容校验\n')

  step('违法违禁 / 平台外内容 / 联系方式都能拦下', () => {
    const missed: string[] = []
    for (const c of SHOULD_BLOCK) {
      const hits = moderateText(c.text)
      if (!hits.length) {
        missed.push(`${c.text}（应为 ${c.category}）`)
        continue
      }
      assert.equal(
        hits[0].category,
        c.category,
        `「${c.text}」判成了 ${hits[0].category}，应为 ${c.category}`,
      )
      assert.ok(hits[0].term, `「${c.text}」没给出命中片段`)
      assert.ok(hits[0].message.length > 10, `「${c.text}」的提示文案太短`)
    }
    assert.equal(missed.length, 0, `漏拦：\n    ${missed.join('\n    ')}`)
  })

  step('正常闲置描述一条都不能误拦', () => {
    const wrong: string[] = []
    for (const c of SHOULD_PASS) {
      const hits = moderateText(c.text)
      if (hits.length) {
        wrong.push(`${c.text} → ${hits[0].category}「${hits[0].term}」`)
      }
    }
    assert.equal(wrong.length, 0, `误拦：\n    ${wrong.join('\n    ')}`)
  })

  step('同一分类只报一次，不刷屏', () => {
    const hits = moderateText('招聘 招工 兼职 日结 小时工')
    assert.equal(hits.length, 1, `同一分类报了 ${hits.length} 条`)
    assert.equal(hits[0].category, 'offplatform')
  })

  step('多个分类同时命中时都能报出来', () => {
    const hits = moderateText('招聘兼职，微信 abc12345，还卖电子烟')
    const cats = hits.map((h) => h.category).sort()
    assert.deepEqual(cats, ['contact', 'illegal', 'offplatform'])
  })

  step('标题和描述一起校验', () => {
    assert.equal(moderateItem({ title: 'iPhone 12', description: '正常' }).ok, true)
    assert.equal(
      moderateItem({ title: 'iPhone 12', description: '微信 abc12345' }).ok,
      false,
      '违规内容藏在描述里也要能拦到',
    )
    assert.equal(
      moderateItem({ title: '招聘兼职', description: '' }).ok,
      false,
      '标题里违规也要能拦到',
    )
    assert.equal(moderateItem({}).ok, true, '空输入不该报错')
  })

  step('前端与云函数两份规则行为完全一致', () => {
    const all = [
      ...SHOULD_BLOCK.map((c) => c.text),
      ...SHOULD_PASS.map((c) => c.text),
      // 再撒一些混合文本，覆盖面广一点
      '《招聘管理实务》第二版，非微商',
      '出 管制刀具 微信 abc12345',
      '全新未拆，没有二维码',
      'https://example.com/x 扫码加我',
    ]

    const diff: string[] = []
    for (const text of all) {
      const mine = moderateText(text).map((h: ModerationHit) => `${h.category}:${h.term}`)
      const theirs = cloudModeration
        .moderateText(text)
        .map((h: ModerationHit) => `${h.category}:${h.term}`)
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
        diff.push(`${text}\n      前端: ${mine.join(', ') || '—'}\n      云函数: ${theirs.join(', ') || '—'}`)
      }
    }

    assert.equal(
      diff.length,
      0,
      `两份规则已经不一致，改 src/utils/moderation.ts 时要同步 cloudfunctions/publishItem/moderation.js：\n    ${diff.join('\n    ')}`,
    )
  })

  step('提示文案可直接展示给用户', () => {
    const hits = moderateText('详情加我 微信号：abc12345')
    const text = describeHits(hits)
    assert.ok(text.includes('abc12345'), '应该告诉用户具体命中在哪')
    assert.ok(text.includes('聊天'), '应该给出替代做法')
  })

  // ------------------------------------------------------------------ 输出
  console.log('\n  ── 该拦样例 ──')
  for (const c of SHOULD_BLOCK) {
    const hits = moderateText(c.text)
    console.log(`  [${hits[0]?.category ?? '漏'}] ${c.text}`)
    console.log(`         ${c.why} → ${hits[0]?.term ?? '—'}`)
  }

  console.log('\n  ── 不该拦样例（误伤防线）──')
  for (const c of SHOULD_PASS) {
    console.log(`  ✓ ${c.text}`)
    console.log(`         ${c.why}`)
  }

  console.log('\n全部通过 ✅\n')
}

main()
