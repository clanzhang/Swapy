/**
 * 发布内容的规则校验。
 *
 * 分三类：违法违禁、平台外内容、联系方式。
 *
 * 这里最容易坏的地方不是「漏拦」而是「误伤」—— 一个合法书名被拦下来，
 * 用户就直接流失了。所以规则必须带上下文，不能用裸关键词：
 *
 *   ✗ /微信/                → 《微信小程序开发实战》被误拦
 *   ✓ /微信\s*[:：号]?\s*[a-zA-Z][\w-]{5,}/  → 只拦真正的微信号形态
 *
 * 另外带一个否定语境的豁免：「非微商货源」不该被拦。
 *
 * 改动规则后跑 `pnpm verify:moderation`，那里有一组「该拦 / 不该拦」的样例。
 */

export type ModerationCategory = 'illegal' | 'offplatform' | 'contact'

export interface ModerationHit {
  category: ModerationCategory
  /** 命中的原文片段，用来告诉用户具体是哪里有问题 */
  term: string
  /** 面向用户的提示 */
  message: string
}

export interface ModerationResult {
  ok: boolean
  hits: ModerationHit[]
}

interface Rule {
  category: ModerationCategory
  pattern: RegExp
}

const MESSAGES: Record<ModerationCategory, (term: string) => string> = {
  illegal: (t) => `「${t}」属于违法违禁内容，换换不能发布这类物品。`,
  offplatform: (t) => `「${t}」看起来不是实物闲置。换换只支持实物闲置的物物交换。`,
  contact: (t) =>
    `物品信息里不要留联系方式（「${t}」）。匹配成功后可以在聊天里沟通，这样双方都更安全。`,
}

const RULES: Rule[] = [
  // ------------------------------------------------------------ A 违法违禁
  { category: 'illegal', pattern: /冰毒|海洛因|大麻|摇头丸|麻古|氯胺酮|K粉|甲卡西酮|可卡因|毒品|吸毒/ },
  { category: 'illegal', pattern: /枪支|弹药|手枪|步枪|冲锋枪|仿真枪|钢珠枪|弓弩|军火/ },
  { category: 'illegal', pattern: /管制刀具|弹簧刀|跳刀|三棱刮刀|军刺|甩棍|指虎/ },
  { category: 'illegal', pattern: /办证|假证|假身份证|假文凭|假学历|刻章|代开发票|假发票|假币|洗钱/ },
  { category: 'illegal', pattern: /处方药|违禁药|麻醉药|精神药品|迷药|听话水/ },
  { category: 'illegal', pattern: /香烟|烟草|电子烟|烟弹|雪茄|卷烟/ },
  { category: 'illegal', pattern: /象牙|犀牛角|虎骨|穿山甲|野生动物制品|玳瑁/ },
  { category: 'illegal', pattern: /赌博|赌具|老虎机|筹码|六合彩|博彩/ },
  { category: 'illegal', pattern: /色情|成人视频|情色|原味内裤|原味丝袜|裸聊/ },
  { category: 'illegal', pattern: /银行卡|身份证正反面|实名账号|账号出租|账号出售|代实名/ },
  { category: 'illegal', pattern: /人体器官|代孕|卵子|精子/ },

  // ------------------------------------------------------------ B 平台外内容
  { category: 'offplatform', pattern: /招聘|招工|招人|兼职|日结|小时工|实习内推|面试/ },
  { category: 'offplatform', pattern: /租房|合租|转租|出租单间|房东直租|找室友/ },
  { category: 'offplatform', pattern: /招生|培训班|网课|家教|一对一辅导/ },
  { category: 'offplatform', pattern: /代购|微商|加盟|招代理|代理招募|分销/ },
  { category: 'offplatform', pattern: /刷单|刷量|涨粉|引流|广告位|付费推广|水军/ },
  { category: 'offplatform', pattern: /贷款|借钱|套现|信用卡代还|网贷|虚拟货币|比特币|以太坊|挖矿|USDT/i },
  { category: 'offplatform', pattern: /充值卡|点卡|游戏币|优惠券|代金券|兑换码|会员账号|激活码/ },
  { category: 'offplatform', pattern: /代写|代做|上门服务|跑腿|家政服务/ },

  // ------------------------------------------------------------ C 联系方式
  // 手机号，允许中间有空格或短横线
  { category: 'contact', pattern: /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/ },
  // 微信号：必须跟着一串字母数字，「微信小程序」这种不会命中
  {
    category: 'contact',
    pattern: /(微信号|微信|威信|薇信|weixin|vx|wx|v信)\s*[:：号]?\s*[a-zA-Z][a-zA-Z0-9_-]{5,}/i,
  },
  // QQ 号
  { category: 'contact', pattern: /(QQ号|QQ|扣扣)\s*[:：号]?\s*[1-9]\d{4,11}/i },
  // 站外链接
  {
    category: 'contact',
    pattern: /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(com|cn|net|org|xyz|top)\b/i,
  },
  // 邮箱
  { category: 'contact', pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  // 引流话术
  { category: 'contact', pattern: /扫码|扫我|二维码|加我|私聊|私信我|加好友|备注换换/ },
]

/**
 * 命中处前面两个字内出现否定词时豁免。
 * 看两个字而不是一个字，是为了盖住「没有二维码」「不是微商」这种说法。
 */
const NEGATION = /[非不无没别]/

function isNegated(text: string, index: number): boolean {
  return NEGATION.test(text.slice(Math.max(0, index - 2), index))
}

/**
 * 位置是否落在书名号内。
 *
 * 「《招聘管理实务》」是本书，不是招工广告。所以「平台外内容」这一类在
 * 书名号内豁免。**违法违禁和联系方式不豁免** —— 那是审核红线，
 * 不能靠一个书名号绕过去。
 */
function insideBookTitle(text: string, index: number): boolean {
  const open = text.lastIndexOf('《', index)
  if (open === -1) return false
  const close = text.indexOf('》', open)
  return close !== -1 && index > open && index < close
}

function matchAll(text: string, pattern: RegExp): RegExpExecArray[] {
  // 每次新建实例，避免 g 标志的 lastIndex 在多次调用间残留
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  const out: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(m)
    if (m.index === re.lastIndex) re.lastIndex += 1
  }
  return out
}

/** 校验一段文本。同一分类只报第一次命中，避免刷屏 */
export function moderateText(text: string): ModerationHit[] {
  if (!text) return []

  const hits: ModerationHit[] = []
  const reported = new Set<ModerationCategory>()

  for (const rule of RULES) {
    if (reported.has(rule.category)) continue

    for (const m of matchAll(text, rule.pattern)) {
      if (isNegated(text, m.index)) continue
      if (rule.category === 'offplatform' && insideBookTitle(text, m.index)) continue

      hits.push({
        category: rule.category,
        term: m[0].trim(),
        message: MESSAGES[rule.category](m[0].trim()),
      })
      reported.add(rule.category)
      break
    }
  }

  return hits
}

/** 校验一件待发布的物品（标题 + 描述一起看） */
export function moderateItem(input: { title?: string; description?: string }): ModerationResult {
  const hits = moderateText(`${input.title ?? ''}\n${input.description ?? ''}`)
  return { ok: hits.length === 0, hits }
}

/** 把命中结果拼成给用户看的一整段话 */
export function describeHits(hits: ModerationHit[]): string {
  return hits.map((h) => h.message).join('\n')
}
