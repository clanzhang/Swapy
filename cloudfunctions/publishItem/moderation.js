/**
 * 发布内容校验（云函数侧）。
 *
 * 这份规则列表和 src/utils/moderation.ts 是**同一套**，改动必须两边同步。
 * 云函数各自独立打包，没法直接共享代码。
 *
 * 为什么客户端校验过了还要再校验一次：客户端可以被绕过（改请求、用脚本），
 * 真正的门必须在这里。
 *
 * 除了本地规则，还会调微信的内容安全接口：
 * - security.msgSecCheck  文本（审核要求，也是挡政治/色情/辱骂的主力）
 * - security.imgSecCheck  图片
 * 这两个接口都是「尽力而为」：调用失败只记日志，不能因为接口抖动就让用户发不出去。
 */

const MESSAGES = {
  illegal: (t) => `「${t}」属于违法违禁内容，换换不能发布这类物品。`,
  offplatform: (t) => `「${t}」看起来不是实物闲置。换换只支持实物闲置的物物交换。`,
  contact: (t) =>
    `物品信息里不要留联系方式（「${t}」）。匹配成功后可以在聊天里沟通，这样双方都更安全。`,
}

const RULES = [
  // ---------------- 违法违禁
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

  // ---------------- 平台外内容
  { category: 'offplatform', pattern: /招聘|招工|招人|兼职|日结|小时工|实习内推|面试/ },
  { category: 'offplatform', pattern: /租房|合租|转租|出租单间|房东直租|找室友/ },
  { category: 'offplatform', pattern: /招生|培训班|网课|家教|一对一辅导/ },
  { category: 'offplatform', pattern: /代购|微商|加盟|招代理|代理招募|分销/ },
  { category: 'offplatform', pattern: /刷单|刷量|涨粉|引流|广告位|付费推广|水军/ },
  { category: 'offplatform', pattern: /贷款|借钱|套现|信用卡代还|网贷|虚拟货币|比特币|以太坊|挖矿|USDT/i },
  { category: 'offplatform', pattern: /充值卡|点卡|游戏币|优惠券|代金券|兑换码|会员账号|激活码/ },
  { category: 'offplatform', pattern: /代写|代做|上门服务|跑腿|家政服务/ },

  // ---------------- 联系方式
  { category: 'contact', pattern: /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/ },
  {
    category: 'contact',
    pattern: /(微信号|微信|威信|薇信|weixin|vx|wx|v信)\s*[:：号]?\s*[a-zA-Z][a-zA-Z0-9_-]{5,}/i,
  },
  { category: 'contact', pattern: /(QQ号|QQ|扣扣)\s*[:：号]?\s*[1-9]\d{4,11}/i },
  {
    category: 'contact',
    pattern: /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(com|cn|net|org|xyz|top)\b/i,
  },
  { category: 'contact', pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  { category: 'contact', pattern: /扫码|扫我|二维码|加我|私聊|私信我|加好友|备注换换/ },
]

/** 命中处前两个字内出现否定词时豁免 */
const NEGATION = /[非不无没别]/

function isNegated(text, index) {
  return NEGATION.test(text.slice(Math.max(0, index - 2), index))
}

/** 书名号内的「平台外内容」豁免，但违法违禁和联系方式不豁免 */
function insideBookTitle(text, index) {
  const open = text.lastIndexOf('《', index)
  if (open === -1) return false
  const close = text.indexOf('》', open)
  return close !== -1 && index > open && index < close
}

function matchAll(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  const out = []
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m)
    if (m.index === re.lastIndex) re.lastIndex += 1
  }
  return out
}

function moderateText(text) {
  if (!text) return []

  const hits = []
  const reported = new Set()

  for (const rule of RULES) {
    if (reported.has(rule.category)) continue

    for (const m of matchAll(text, rule.pattern)) {
      if (isNegated(text, m.index)) continue
      if (rule.category === 'offplatform' && insideBookTitle(text, m.index)) continue

      const term = m[0].trim()
      hits.push({ category: rule.category, term, message: MESSAGES[rule.category](term) })
      reported.add(rule.category)
      break
    }
  }

  return hits
}

function moderateItem(input) {
  const hits = moderateText(`${(input && input.title) || ''}\n${(input && input.description) || ''}`)
  return { ok: hits.length === 0, hits }
}

function describeHits(hits) {
  return hits.map((h) => h.message).join('\n')
}

// ------------------------------------------------------------------ 微信接口

/**
 * 文本内容安全。返回拦下的提示，没问题返回 null。
 * 接口本身出错（额度、网络、openid 不在有效期内）只记日志，不阻断发布。
 */
async function secCheckText(cloud, { content, openid }) {
  if (!content || !content.trim()) return null
  if (!openid) return null

  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      openid,
      // 2 = 资料场景
      scene: 2,
      content: content.slice(0, 2500),
    })
    const suggest = res && res.result && res.result.suggest
    if (suggest === 'risky') {
      return '内容未通过安全检测，请检查是否含有违规信息后重试。'
    }
    return null
  } catch (err) {
    console.warn('msgSecCheck 调用失败，跳过', err && err.errCode, err && err.errMsg)
    return null
  }
}

/**
 * 图片内容安全。
 * imgSecCheck 限制单张 1MB / 750px，超了会报错，这里同样只记日志。
 */
async function secCheckImages(cloud, fileIDs) {
  if (!Array.isArray(fileIDs) || !fileIDs.length) return null

  for (const fileID of fileIDs) {
    // 只检查云存储里的图，本地临时路径传不上来
    if (typeof fileID !== 'string' || !fileID.startsWith('cloud://')) continue

    try {
      const { fileContent } = await cloud.downloadFile({ fileID })
      await cloud.openapi.security.imgSecCheck({
        media: { contentType: 'image/png', value: fileContent },
      })
    } catch (err) {
      // 87014 = 内容违规，这个必须拦；其余（超限、网络）放行
      if (err && Number(err.errCode) === 87014) {
        return '有图片未通过安全检测，请更换后重试。'
      }
      console.warn('imgSecCheck 调用失败，跳过', err && err.errCode, err && err.errMsg)
    }
  }

  return null
}

module.exports = { moderateText, moderateItem, describeHits, secCheckText, secCheckImages }
