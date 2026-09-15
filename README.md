# 换换 Swapy

> 闲置物品滑动匹配交换小程序 — 右滑「想要」，双方互相想要就配对成功。

一个微信小程序：发布自己的闲置，左右滑动浏览附近人的物品，双方互相「想要」时匹配成功，然后一对一聊怎么换。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Taro 3.6 + React 18 + TypeScript |
| UI | NutUI React Taro 2.7（按需引入，只打进用到的 3 个组件） |
| 滑动交互 | 微信原生 `movable-area` + `movable-view` |
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
pnpm verify:matching  # 跑匹配算法的行为验证（12 项断言）
```

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
│   ├── SwipeCard/       #   可拖动卡片（位移 → 旋转/印章透明度联动）
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

### 滑动卡片的两个微信端坑

**坑一：`movable-view` 在 weapp 没有 `onChangeEnd`。**
Taro 的类型定义里它只标注支持 alipay。所以拖拽结束只能挂在**外层容器的
`onTouchEnd`** 上，配合一个 ref 记录最新位移来判断。

**坑二：卡片和 `movable-area` 等大时拖不动。**
可移动范围 = 区域尺寸 − 视图尺寸 = 0。必须开 `out-of-bounds`。
开了之后松手会自动回弹，于是把 `x`/`y` 做成**受控属性**、在 `onChange`
里同步成手指当前位置 —— 属性值等于实际位置，回弹就被抵消了，
松手后接我们自己的「归位 / 飞出」动画。

另外：**`movable-area` 的祖先节点不能有 `transform`**，否则触摸坐标会错位。
所以牌堆下层卡片的 `scale` 位移只加在 depth > 0 的 slot 上。

### 图片切图不用横滑

简报里「图片支持左右滑动切换」和「左滑跳过 / 右滑想要」在手势上是同一个动作，
无法共存。这里改成 Tinder 的做法：**点击图片左右区域切图 + 顶部进度条**，
横滑手势完整留给「跳过 / 想要」。

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

## 产品设计文档

见 [docs/superpowers/specs/2026-09-15-swapy-design.md](./docs/superpowers/specs/2026-09-15-swapy-design.md)。
