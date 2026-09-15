# 换换 Swapy · 设计文档

- 日期：2026-09-15
- 状态：已实现（v0.1.0）

---

## 1. 背景与目标

闲置物品处理的痛点是「卖不值钱、扔了可惜」。换换用交换替代交易：
不涉及支付，双方各取所需。

核心假设：**交换的摩擦主要在「找到对的人」，而不是「谈价格」。**
因此产品把全部注意力压在一个动作上 —— 滑动。用户不需要搜索、不需要比价，
只需要对眼前的物品回答「想不想要」。

**成功标准**：新用户进来 60 秒内能滑完一批卡片，并且至少看到一次匹配成功。

### 非目标

- 不做支付、不做担保交易（规避小程序审核和资金风险）
- 不做 UGC 社区（聊天严格一对一，无广场、无评论）
- 不做物流（交换默认线下当面完成）

---

## 2. 核心流程

```
发布闲置 ──┐
           ├──> 匹配池 ──> 滑动卡片 ──左滑──> 跳过
浏览卡片 ──┘                   │
                               └──右滑──> 「想要」
                                            │
                              对方也右滑过我的物品？
                                   │              │
                                   否            是
                                   │              │
                                 继续滑      ──> 匹配成功
                                                  │
                                            一对一聊天
                                                  │
                                            线下完成交换
```

---

## 3. 架构

### 3.1 分层

```
┌──────────────────────────────────────────┐
│  pages/  (5 个页面)                       │
│      只依赖 store 和 components           │
├──────────────────────────────────────────┤
│  store/  (Zustand)                       │
│      userStore / deckStore               │
├──────────────────────────────────────────┤
│  services/adapter.ts  ← SwapyApi 接口     │
│      ┌────────────┬────────────┐         │
│      │ mock.ts    │ cloud.ts   │         │
│      │ 内存+Storage│ 云函数+DB  │         │
│      └────────────┴────────────┘         │
│            ↑ 二选一，由 config 决定        │
└──────────────────────────────────────────┘
```

### 3.2 为什么要有数据访问层

小程序开发最常见的时间浪费是：UI 写完了但后端没就绪，或者后端有了但
AppID / 云环境卡住了。这一层把两者解耦：

- 没有云环境时，`mock.ts` 用种子数据 + Storage 跑通全流程
- 有云环境时，切一个环境变量就换成 `cloud.ts`

**代价**：`swipe` 的匹配判定在两边各有一份实现。这是刻意的取舍 ——
换来的是一份**可以在 Node 里跑断言的匹配逻辑**（见 `scripts/verify-matching.ts`）。
匹配规则是本产品最容易悄悄写错的地方，值得为它付出这个代价。

### 3.3 状态管理边界

| Store | 职责 | 不负责 |
| --- | --- | --- |
| `userStore` | 当前用户、登录态、资料更新 | 任何列表数据 |
| `deckStore` | 牌堆、分页游标、品类筛选、匹配弹窗 | 匹配列表、聊天 |

匹配列表和聊天记录不进 store：它们是页面级数据，`useDidShow` 每次重新拉，
生命周期跟着页面走，放全局反而要处理失效问题。

---

## 4. 数据模型

### users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | |
| `_openid` | string | 微信 openid，登录唯一键 |
| `nickname` | string | ≤12 字 |
| `avatarUrl` | string | |
| `city` | string | 手选，用于兜底展示 |
| `location` | `{lat, lng}` | 距离计算依据，缺省时视为未知 |
| `createdAt` / `lastActiveAt` | number | 时间戳（ms） |

### items

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` / `ownerId` | string | |
| `images` | string[] | ≤9，`cloud://` fileID 或 `seed://` 占位标记 |
| `title` | string | ≤30 字 |
| `category` | enum | `digital` / `book` / `toy` / `instrument` / `sport` |
| `condition` | enum | `new` / `95` / `90` / `80` |
| `priceRange` | enum | `0-50` / `50-200` / `200-500` / `500-2000` |
| `description` | string | ≤200 字 |
| `status` | enum | `active` / `swapped` / `off` |
| `createdAt` | number | |

### swipes

`{ _id, fromUserId, toItemId, toUserId, direction: 'left'|'right', createdAt }`

只由云函数写入。客户端不能直接写 —— 否则可以伪造匹配。

### matches

`{ _id, userA, userB, itemA, itemB, messages[], createdAt, lastMessageAt }`

- `userA` 是先右滑的一方
- `itemA` 是 `userA` 右滑的物品（属于 `userB`）
- `itemB` 是 `userB` 右滑的物品（属于 `userA`）

这个结构是对称的，客户端读的时候统一翻译成「我」的视角
（`myItem` / `peerItem`），页面不需要知道自己是 A 还是 B。

### 时间戳统一用 number

不用 `Date` / `serverDate`：跨端序列化行为不一致，且比较大小需要额外转换。

---

## 5. 匹配算法

### 5.1 命中判定

用户 A 右滑物品 X（属于用户 B）时：

1. 写入 `swipes{fromUserId: A, toItemId: X, direction: 'right'}`（幂等）
2. 查 B 是否右滑过 A 的任一物品 → `swipes{fromUserId: B, toItemId ∈ A的物品, direction: 'right'}`
3. 命中则创建 `match{userA: A, itemA: X, userB: B, itemB: 查到的那个物品}`
4. 推订阅消息通知双方

**去重**：同一对用户只保留一条 match，重复右滑不会产生第二条。

### 5.2 匹配池筛选（首页拉卡片）

按顺序过滤：

1. `status === 'active'`
2. `ownerId !== 我`
3. 我没滑过这件物品
4. 品类在用户筛选范围内（空 = 不限）
5. 距离 ≤ 50km
6. 估值区间与我的在架物品有交集

第 6 条的用意：估值差太远的交换谈不成。0-50 的书和 500-2000 的耳机
即使匹配了也大概率聊不下去。

**例外**：第 6 条只在「我有在架物品」时生效。新用户还没发布任何东西，
不该被这条规则挡到无卡可滑。

排序：距离近的优先，同距离按新鲜度。

### 5.3 冷启动

匹配池空掉是这类产品最致命的体验。两道保险：

1. **种子数据**：内置 8 个用户、16 件物品（含 2 件自己的），
   其中苏州 / 杭州的物品故意超出 50km，用来验证距离过滤真的生效
2. **预置一条对方的右滑记录**：新用户滑第一张卡就能命中匹配、看到
   完整闭环（撒花动画 → 聊天）。滑几十张毫无反馈是最劝退的

---

## 6. 接口契约

```ts
interface SwapyApi {
  init(): Promise<User>
  getCachedUser(): User | null
  updateProfile(patch: ProfilePatch): Promise<User>

  getCards(query: CardQuery): Promise<Page<CardItem>>
  swipe(toItemId: string, direction: SwipeDirection): Promise<SwipeResult>

  publishItem(input: PublishItemInput): Promise<Item>
  getMyItems(): Promise<Item[]>
  getWantedItems(): Promise<CardItem[]>
  updateItemStatus(itemId: string, status: ItemStatus): Promise<void>

  getMatches(): Promise<MatchView[]>
  getMatch(matchId: string): Promise<MatchView | null>
  getChatHistory(matchId: string): Promise<ChatMessage[]>
  sendMessage(matchId: string, type: MessageType, content: string): Promise<ChatMessage>
  subscribe(matchId: string, handler: (msg: ChatMessage) => void): () => void

  uploadImage(filePath: string): Promise<string>
}
```

云函数统一返回 `{ ok, data?, message? }`，由 `cloud.ts` 的 `call()` 拆包。

实时推送：客户端 `subscribe()` 在云开发下是
`db.collection('matches').doc(id).watch()`；Mock 下是一个进程内的
EventEmitter。两者签名一致，聊天页不需要区分。

---

## 7. 界面设计

### 首页（滑动匹配）

```
┌─────────────────────────────┐
│ 附近好物        上海 · 50km内 │
│ [全部][📱数码][📚书籍][🧸潮玩] │  ← 品类筛选，横滑
├─────────────────────────────┤
│  ╭───────────────────────╮  │
│  │ ▬▬▬▬ ▬▬ ──  ← 图片进度 │  │  ← 点左侧 32% 上一张
│  │                       │  │     点右侧 68% 下一张
│  │      物品大图          │  │
│  │                       │  │
│  ├───────────────────────┤  │
│  │ Switch OLED 白色 日版   │  │
│  │ [📱数码][95新][¥500-2000]│ │
│  │ 描述两行截断…           │  │
│  │ (阿) 阿哲     320m · 2h前│  │
│  ╰───────────────────────╯  │
│         ↑ 上滑看详情          │
├─────────────────────────────┤
│      ( ✕ )      ( ❤ )        │
└─────────────────────────────┘
```

- 左滑 / 点 ✕ → 跳过，卡片向左飞出并旋转
- 右滑 / 点 ❤ → 想要，卡片向右飞出并放大
- 上滑 → 半屏详情面板
- 拖动时卡片按位移比例旋转（最多 ±13°），并淡入「想要 / 跳过」印章

### 匹配成功

全屏橙色渐变遮罩 + 28 片 CSS 撒花粒子（位置/延迟/颜色固定，不随机闪烁）
+ 两件物品并排 + 跳动的心。两个出口：去聊天 / 继续滑。

### 其他页面

- **发布**：9 宫格图片上传（首图为封面）、名称、品类/成色/估值区间chips、描述
- **匹配列表**：双方物品并排 + 最近一条消息
- **聊天**：顶部常驻双方物品（提醒交换目标）、气泡消息、文字 + 图片
- **我的**：资料卡（可展开编辑昵称/城市）、我的发布（可下架/重新上架）、我的想要

### 设计 token

| 项 | 值 |
| --- | --- |
| 主色 | `#FF6B35` |
| 辅色 | `#FFF3E0` |
| 成功 / 危险 | `#2FBF71` / `#FF4D4F` |
| 卡片圆角 / 阴影 | `16px` / `0 8px 24px rgba(24,24,32,.1)` |
| 设计稿宽度 | 375（写 px，Taro 转 rpx） |

---

## 8. 关键技术决策

### 8.1 图片切图改成「点击」而不是「横滑」

**冲突**：简报要求图片支持左右滑动切换，同时要求左滑/右滑触发跳过/想要。
这是同一个手势，无法共存。

**决策**：采用 Tinder 的成熟做法 —— 点击图片左右区域切图，顶部加分段进度条。
横滑手势完整留给决策动作。

**理由**：滑动决策是这个产品唯一的核心动作，不能和任何其他交互抢手势。

### 8.2 `movable-view` 必须开 `out-of-bounds`

可移动范围 = 区域尺寸 − 视图尺寸。卡片和区域等大时范围是 0，根本拖不动。

开了 `out-of-bounds` 之后松手会自动回弹，于是把 `x`/`y` 做成**受控属性**：
在 `onChange` 里同步成手指当前位置，属性值恒等于实际位置，回弹被自然抵消，
松手后接着跑我们自己的「归位 / 飞出」动画。

`onChange` 里还要挡住 `source !== 'touch'` 的事件，否则程序化动画会被
自己的回写打断。

### 8.3 拖拽结束判断挂在 `onTouchEnd` 上

Taro 类型定义显示 `MovableView.onChangeEnd` 只标注支持 alipay，
weapp 不触发。所以判定逻辑挂在外层 `MovableArea` 的 `onTouchEnd`，
配合 ref 读取最新位移（ref 而非 state，避免闭包拿到旧值）。

### 8.4 `movable-area` 的祖先不能有 `transform`

祖先节点的 `transform` 会让微信的触摸坐标映射错位。所以牌堆下层卡片的
`scale` 和 `translateY` 只加在 depth > 0 的 slot 上，最上面那张不带 transform。

### 8.5 NutUI 按需引入

全量 `dist/style.css` 是 208KB，编译出的 `app.wxss` 259KB。
实际只用到 Button / Input / TextArea，改成逐个引
`dist/esm/<组件>/style/style.css` 后，`app.wxss` 降到 24KB。

代价：新增组件时要手动在 `src/styles/nutui.ts` 补一行。

### 8.6 头像用自绘而不是 NutUI Avatar

需要「无头像时显示昵称首字」的兜底。自绘 6 行样式比适配组件行为更可控。

### 8.7 小程序里不能出现裸的 `process.env`

**症状**：小程序一启动就白屏，报 `ReferenceError: process is not defined`。

**原因**：小程序运行时没有 `process` 对象。Taro 只会自动替换它已知的 env key
（即 `.env` 文件里出现过的），没声明过的 `process.env.TARO_APP_X` 会原样
留在产物里，变成一次真实的属性访问。

**为什么 CI / 构建发现不了**：webpack 构建完全成功，只有真机或开发者工具
才会执行到那一行。属于「构建绿了但产品是坏的」。

**修法**：在 `config/index.ts` 的 `defineConstants` 里显式声明，让它在编译期
就被替换成字符串字面量（`config/index.ts` 本身跑在 Node 里，`process` 是存在的）。

**防回归**：`scripts/check-dist.cjs` 在每次构建后扫产物里有没有残留的
`process.*`，有就 fail。这类「只在运行时暴露」的问题只能靠静态闸门挡住。

### 8.8 验证分三层

| 层 | 手段 | 挡住的错误 |
| --- | --- | --- |
| 类型 | `pnpm typecheck` | 接口不匹配、拼写错误 |
| 行为 | `pnpm verify:matching` | 匹配规则写错（不会报错，只会让产品慢慢失效） |
| 产物 | `pnpm verify:dist` | 构建成功但运行时必崩的模式 |

这三层都跑得起来，是因为它们都不依赖微信运行时 —— 这也是引入数据访问层
（Mock 实现可在 Node 里跑）的附带收益。

---

## 9. 测试策略

### 匹配算法的行为验证

`pnpm verify:matching` —— 用 esbuild 把验证脚本打包（顺带解析 `@/` 别名），
把 `@tarojs/taro` 换成 Node 替身，然后在 Node 里跑 12 项断言：

```
✓ 匹配池只包含 50km 内、非本人、在架的物品
✓ 左滑不产生匹配，且该物品不再出现
✓ 单向右滑不匹配（对方没想要我的东西）
✓ 互相右滑才匹配成功
✓ 重复右滑同一对用户不会产生第二个 match
✓ 估价区间无交集的物品不进池子
✓ 品类筛选生效
✓ 发布后进入自己的物品列表，并参与匹配池
✓ 自己发布的物品不会出现在自己的牌堆里
✓ 下架后状态变为 off
✓ 聊天：发消息、拉历史、双方消息都在
✓ 「我的想要」只记录右滑过的物品
```

选这个范围的依据：这些是**错了也不会报错、只会让产品慢慢失效**的逻辑。
UI 层有 bug 肉眼可见，匹配层有 bug 要等用户投诉。

### 未被自动化覆盖的部分

- 滑动卡片的物理手感（需要真机 / 开发者工具人工验证）
- 云函数（需要真实云环境，本地无法跑）
- 页面渲染

---

## 10. 已知限制与演进路径

| 限制 | 触发条件 | 演进方案 |
| --- | --- | --- |
| `getCards` 的距离/估值筛选在内存做 | 候选物品 > 100 条 | 按城市分片查询 + 定时任务预计算推荐池 |
| `swipes` 单次查询上限 1000 | 用户滑过 1000 件 | 按 `createdAt` 游标分批查 |
| 聊天消息存在 match 文档数组里 | 单会话约 8 万条（16MB） | 拆独立 `messages` 集合，match 上只冗余最近一条 |
| 订阅消息一次性订阅只能推一条 | — | 引导用户在关键节点重新授权 |
| 交换完成无闭环确认 | — | 双方确认后 `items.status → swapped`（数据模型已预留） |
| 无举报/拉黑 | — | 上架前补，一对一会话也有骚扰风险 |

---

## 11. 审核与合规

- 不涉及支付、不涉及虚拟货币 → 避开资金类目审核
- 聊天严格一对一，无公开内容流 → 不算 UGC 社区，审核压力小
- 但仍需：内容安全接口（`security.msgSecCheck` / `imgSecCheck`）
  校验聊天文本和图片，以及用户协议 + 隐私政策
- 建议在聊天页与详情页加「建议线下公共场所当面交换」提示（已实现）
