# 换换 Swapy

> 闲置物品滑动匹配交换小程序 — 右滑「想要」，双方互相想要就配对成功。

一个微信小程序：发布自己的闲置，左右滑动浏览附近人的物品，双方互相「想要」时匹配成功，然后一对一聊怎么换。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Taro 3.6 + React 18 + TypeScript |
| UI | NutUI React Taro 2.7（按需引入，只打进用到的 3 个组件） |
| 滑动交互 | 自研 touch 手势 + CSS transform（数学上的 1:1 跟手） |
| 状态管理 | Zustand |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） |

## 快速开始

```bash
pnpm install
pnpm dev:weapp      # 开发（watch）
pnpm build:weapp    # 构建到 dist/
```

用微信开发者工具打开项目根目录即可（`project.config.json` 已配好 `miniprogramRoot: dist/`）。

**默认跑在 Mock 模式**：不需要 AppID、不需要云环境，用内置种子数据就能
完整跑通「滑动 → 匹配 → 聊天」全流程。适合 UI 调试和演示。

### 其他命令

```bash
pnpm typecheck        # TypeScript 检查
pnpm verify           # 上面四项全跑一遍
pnpm verify:matching  # 匹配算法行为验证（12 项断言）
pnpm verify:gesture   # 滑动手势验证 + 参数表（12 项断言）
pnpm verify:dist      # 产物体检（扫残留的 process 引用）
```

> `build:weapp` 末尾已经串上了 `verify:dist`，构建产物有问题会直接报错。

## 切换到真实云开发

只改一个文件：

```bash
echo 'TARO_APP_CLOUD_ENV=你的云环境ID' > .env
```

`src/config/index.ts` 读到环境 ID 后，`src/services/index.ts` 会自动把
Mock 实现换成云开发实现，**业务代码一行都不用改**。详见
[cloudfunctions/README.md](./cloudfunctions/README.md)。

## 目录结构

```
src/
├── services/            # 数据访问层（本项目的核心抽象）
│   ├── adapter.ts       #   SwapyApi 接口 —— 页面只认这个
│   ├── mock.ts          #   本地实现：内存 + Storage 持久化 + 种子数据
│   ├── cloud.ts         #   云开发实现：云函数 + 数据库实时推送
│   └── index.ts         #   唯一的实现选择点
├── store/               # Zustand：userStore / deckStore
├── components/
│   ├── SwipeCard/       #   可拖动卡片
│   │   ├── gesture.ts   #     手势判定纯函数（阈值、甩动、旋转角度）
│   │   └── index.tsx    #     touch 事件 → transform 映射
│   ├── CardStack/       #   三张牌的堆叠与层次
│   ├── ItemImage/       #   统一图片组件（含渐变占位图兜底）
│   ├── ItemImagePager/  #   多图浏览（点击切图 + 进度条）
│   ├── MatchModal/      #   匹配成功弹窗 + 撒花动画
│   ├── ItemDetailSheet/ #   上滑唤起的半屏详情
│   └── CategoryFilter/  #   首页品类筛选
├── pages/
│   ├── index/           #   首页 · 滑动匹配
│   ├── publish/         #   发布闲置
│   ├── matches/         #   匹配列表
│   ├── chat/            #   聊天
│   └── profile/         #   我的
├── constants/           # 品类/成色/估值区间枚举 + 种子数据
├── utils/               # 距离计算、时间格式化
└── styles/              # 设计变量（经 sass.resource 全局注入）+ NutUI 按需样式

cloudfunctions/          # 7 个云函数，见 cloudfunctions/README.md
scripts/                 # 匹配算法的行为验证脚本
```

## 核心设计

### 数据访问层把「云」和「UI」隔开

页面和 store 只 `import { api } from '@/services'`，完全不认识「云开发」还是
「Mock」。这带来两个好处：

1. **UI 开发不被云环境阻塞** —— 没有 AppID 也能把交互调完
2. **匹配逻辑可以被验证** —— 同一个接口有两份实现，Mock 那份能在 Node 里跑断言

代价是这份契约必须被认真维护：`swipe` 的匹配判定在 Mock 和云函数里各有一份，
改的时候两边都要改。`pnpm verify:matching` 就是钉住这件事的。

### 滑动卡片：为什么最后没用 `movable-view`

第一版按简报用了 `movable-area` + `movable-view`，真机手感是「拖很远卡片才动一点，
松手回弹黏糊糊」。排查后是结构性原因，不是参数问题：

```
.swipe-card__area  = 100% × 100%   ← 槽位大小
.swipe-card__mover = 100% × 100%   ← 一模一样
```

`movable-view` 的可移动范围 = **区域尺寸 − 视图尺寸 = 0**。范围是 0，意味着
**整段拖拽全程都算「越界」**，`out-of-bounds` 的阻尼贯穿始终 —— 每移动一个像素
都在被抗。`damping` 只是在调越界回弹动画的速度，改不了拖拽阻力本身。

修法有两条：给它造一个真实的移动区间（区域掉大 ±200px、负偏移定位），
或者自己接管 touch 事件。**选了后者**，因为：

- 手指位移直接映射成 `transform`，跟手是**数学上的 1:1**，不是调参调出来的
- 前者仍然押在「`movable-view` 会不会用 `boundingClientRect` 量绝对定位元素的尺寸」
  这个我无法在本地验证的组件行为上

顺带还去掉了两个我们必须绕的坑：`onChangeEnd` 在 weapp 不触发、
`movable-area` 祖先节点有 `transform` 会触摸坐标错位。

判定逻辑抽在 `src/components/SwipeCard/gesture.ts`，是纯函数，所以能用
`pnpm verify:gesture` 验证，也能直接打印一张参数表 —— 调手感不用通真机。

### 拖完手松开会误触发图片切图

图片切图挂在 `onClick` 上，而卡片是整体可拖拽的。微信的 `tap` 在手指移动后
依然会触发，所以「拖一下卡片再松手」会顺便把图片翻页。
`ItemImagePager` 里记了一下本次触摸的最大位移，超过 10px 就不当点击处理。

### 图片切图不用横滑

简报里「图片支持左右滑动切换」和「左滑跳过 / 右滑想要」在手势上是同一个动作，
无法共存。这里改成 Tinder 的做法：**点击图片左右区域切图 + 顶部进度条**，
横滑手势完整留给「跳过 / 想要」。

### 小程序里绝对不能出现裸的 `process.env`

小程序运行时没有 `process` 对象。**任何没被编译期替换掉的 `process.env.X`
都会在启动瞬间抛 `process is not defined`**，而且构建是成功的、只在开发者工具
或真机里才暴露。

Taro 只自动替换它已知的 env key（`.env` 文件里出现过的），所以本项目用
`config/index.ts` 的 `defineConstants` 显式声明：

```ts
defineConstants: {
  'process.env.TARO_APP_CLOUD_ENV': JSON.stringify(process.env.TARO_APP_CLOUD_ENV || ''),
}
```

这样没有 `.env` 文件也能被替换成字符串字面量，有了 `.env` 也照常覆盖。
`scripts/check-dist.cjs` 会在每次构建后扫一遍产物，防止这类问题再次溜进去。

## 设计规范

| 项 | 值 |
| --- | --- |
| 主色 | `#FF6B35` 活力橙 |
| 辅色 | `#FFF3E0` 浅橙背景 |
| 卡片 | 圆角 16px、白色、`0 8px 24px rgba(24,24,32,.1)` 阴影 |
| 设计稿宽度 | 375（代码里写 px，Taro 转 rpx） |

所有设计变量在 `src/styles/variables.scss`，通过 `config/index.ts` 的
`sass.resource` 自动注入到每个 `.scss`，组件里不用重复 `@import`。

## 包体积

```
dist/  约 550KB
  app.wxss   24KB   （NutUI 按需引入前是 259KB）
```

NutUI 全量样式 208KB，本产品只用了 Button / Input / TextArea，所以在
`src/styles/nutui.ts` 里逐个引它们已编译的 `style.css`（20KB）。
**新增 NutUI 组件时记得在那里补一行。**

## 已知限制

- 云函数的距离筛选和估值区间筛选在内存里做（云数据库不支持这两类查询），
  物品量过万后需要改成按城市分片 + 预计算
- `getCards` 的「排除已滑过」依赖单次最多 1000 条 `swipes` 查询，
  用户滑过 1000 件后需要改成游标分批
- 聊天消息存在 match 文档的数组里，约 8 万条触及 16MB 文档上限
- 订阅消息需要用户先授权，一次性订阅只能推一条

详见 [cloudfunctions/README.md](./cloudfunctions/README.md#九已知限制)。

## 版本记录

### 0.1.2

- 重构：滑动卡片改用自研 touch 手势 + CSS transform，替掉 `movable-view`。
  原先卡片和可移动区域等大，可移动范围为 0，整段拖拽全程踩越界阻尼，
  永远做不到 1:1 跟手。
- 新增甩动判定：位移 > 36px 且速度 > 0.6px/ms 即可触发，不必拖满阈值。
- 新增 `scripts/verify-gesture.ts`：12 项手势断言 + 可读的参数表，
  调手感不用通真机。旋转手感调整（提交点 5.7° → 9.1°）。
- 修复：拖完卡片松手会误触发图片切图。
- 右滑飞出补上「放大 + 发光」（简报要求，之前漏了）。

### 0.1.1

- 修复：小程序启动即崩（`process is not defined`）。`TARO_APP_CLOUD_ENV`
  没有被编译期替换，裸的 `process.env` 进了产物。改用 `defineConstants`
  显式内联，并新增 `scripts/check-dist.cjs` 在每次构建后扫产物防回归。

### 0.1.0

- 首个版本：滑动匹配、发布、匹配列表、聊天、我的
- 数据访问层双实现（Mock / 云开发），7 个云函数
- 12 项匹配算法行为断言

## 产品设计文档

见 [docs/superpowers/specs/2026-09-15-swapy-design.md](./docs/superpowers/specs/2026-09-15-swapy-design.md)。
