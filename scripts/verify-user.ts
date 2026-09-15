/**
 * 登录注册模块的验证。
 *
 * 这一块看起来简单，但错法都很隐蔽：
 * - isNew 永远为 true（用户缓存没落盘）
 * - 新用户没有城市 → 同城筛选把首页筛成空白
 * - 默认昵称规则两边不一致 → 引导弹窗永远不出现 / 永远出现
 *
 * 运行：pnpm verify:user
 */
import assert from 'node:assert/strict'

import Taro from '@tarojs/taro'

import { SEED_ITEMS, SEED_ME, SEED_SWIPES, SEED_USERS, SEED_VERSION } from '@/constants/seed'
import { createMockApi } from '@/services/mock'
import { useUserStore } from '@/store/userStore'
import { defaultNickname, isDefaultNickname, needsProfileSetup } from '@/utils/profile'

const DB_KEY = 'swapy:mock-db:v1'
const USER_KEY = 'swapy:mock-user:v1'
const storage = (Taro as any).__store as Map<string, string>

function resetStorage() {
  storage.delete(DB_KEY)
  storage.delete(USER_KEY)
  // userStore 是模块单例，init() 有 ready 守卫（整个生命周期只登录一次）。
  // 测试之间必须显式重置，否则第二次 init() 是空操作。
  useUserStore.setState({ user: null, isNew: false, ready: false })
}

async function step(title: string, fn: () => Promise<void> | void) {
  await fn()
  console.log(`  ✓ ${title}`)
}

async function main() {
  console.log('\n换换 · 登录注册验证\n')

  await step('首次登录 isNew=true，再次登录 isNew=false', async () => {
    resetStorage()

    const first = createMockApi()
    const a = await first.login()
    assert.equal(a.isNew, true, '全新设备第一次登录应该是新用户')

    // 换一个实例模拟「重新打开小程序」：应从缓存里认出老用户
    const second = createMockApi()
    const b = await second.login()
    assert.equal(b.isNew, false, '再次登录不该被当成新用户')
    assert.equal(b.user._id, a.user._id, '应该是同一个账号')
  })

  await step('登录会更新 lastActiveAt', async () => {
    resetStorage()
    const api = createMockApi()
    const before = (await api.login()).user.lastActiveAt

    await new Promise((r) => setTimeout(r, 15))
    const after = (await api.login()).user.lastActiveAt
    assert.ok(after >= before, 'lastActiveAt 不该倒退')
  })

  await step('默认昵称 = 前缀 + openid 后四位', () => {
    assert.equal(defaultNickname('openid_abcd'), '换换用户abcd')
    assert.equal(defaultNickname(''), '换换用户')
    assert.ok(isDefaultNickname('换换用户abcd'))
    assert.ok(!isDefaultNickname('阿哲'), '用户自己起的名字不该被当成默认值')
    assert.ok(isDefaultNickname(''), '空昵称也算没设置')
  })

  await step('needsProfile：默认昵称或没头像都算需要完善', () => {
    const base = { ...SEED_ME }

    assert.equal(
      needsProfileSetup({ ...base, nickname: '换换用户abcd', avatarUrl: 'x' }),
      true,
      '还是默认昵称 → 需要完善',
    )
    assert.equal(
      needsProfileSetup({ ...base, nickname: '阿哲', avatarUrl: '' }),
      true,
      '没有头像 → 需要完善',
    )
    assert.equal(
      needsProfileSetup({ ...base, nickname: '阿哲', avatarUrl: 'cloud://x' }),
      false,
      '都完善了就不该再问',
    )
    assert.equal(needsProfileSetup(null), false, '没登录时不弹')
  })

  await step('userStore 提供 setUser / isNew / needsProfile', async () => {
    resetStorage()
    await useUserStore.getState().init()

    const state = useUserStore.getState()
    assert.equal(state.ready, true, 'init 之后 ready 应该为 true')
    assert.ok(state.user, '应该有用户信息')
    assert.equal(state.isNew, true, '全新设备应该是新用户')

    // setUser 应该能直接改状态
    state.setUser({ ...state.user!, nickname: '阿哲', avatarUrl: 'cloud://a' }, false)
    const after = useUserStore.getState()
    assert.equal(after.user?.nickname, '阿哲')
    assert.equal(after.isNew, false)
    assert.equal(after.needsProfile(), false, '完善之后不该再引导')
  })

  await step('城市为空时不做同城过滤（否则新用户首页是空白）', async () => {
    resetStorage()
    // 造一个还没设置城市的新用户
    storage.set(
      DB_KEY,
      JSON.stringify({
        users: SEED_USERS.map((u) => (u._id === SEED_ME._id ? { ...u, city: '' } : u)),
        items: SEED_ITEMS,
        swipes: SEED_SWIPES,
        matches: [],
        messages: [],
        meId: SEED_ME._id,
        quota: { dayKey: '2000-01-01', used: 0 },
        seedVersion: SEED_VERSION,
      }),
    )
    storage.set(USER_KEY, JSON.stringify({ ...SEED_ME, city: '' }))

    const api = createMockApi()
    const me = (await api.login()).user
    assert.equal(me.city, '', '前置条件：这个用户没有城市')

    const res = await api.getCards({ page: 1, pageSize: 999 })
    assert.ok(res.cards.length > 0, '没有城市也必须能拿到卡片，否则首页一片空白')

    const cities = new Set(res.cards.map((c) => c.owner.city))
    assert.ok(cities.size > 1, `应该跨城市推荐，实际只有 ${[...cities].join('/')}`)
  })

  await step('设置了城市之后只看同城', async () => {
    resetStorage()
    const api = createMockApi()
    await api.login()
    await api.updateProfile({ city: '上海' })

    const res = await api.getCards({ page: 1, pageSize: 999 })
    assert.ok(res.cards.length > 0, '上海应该有大量物品')
    for (const card of res.cards) {
      assert.equal(card.owner.city, '上海', `${card.title} 不在同城`)
    }
  })

  await step('演示账号确实处于「需要完善资料」的状态', async () => {
    // 规格要求引导弹窗延到「第一次右滑」再弹。
    // 演示账号没有头像，所以这条路径是真能被走到的 ——
    // 否则这个功能就是写了但永远不触发。
    resetStorage()
    await useUserStore.getState().init()

    const state = useUserStore.getState()
    assert.equal(state.isNew, true, '全新设备应该是新用户')
    assert.equal(
      state.needsProfile(),
      true,
      '演示账号没有头像，应该处于待完善状态，否则引导永远不会弹',
    )
  })

  console.log('\n全部通过 ✅\n')
}

main().catch((err) => {
  console.error('\n❌ 验证失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})
