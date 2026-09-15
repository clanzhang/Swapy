# 换换 Swapy

> 闲置物品滑动匹配交换小程序 —— 右滑「想要」，双方互相想要就配对成功。

发布自己的闲置，左右滑动浏览附近人的物品，双方互相「想要」时匹配成功，然后一对一聊怎么换。不涉及支付，交换默认线下当面完成。

每天有 **30 次「想要」额度**，中午 12:00 刷新。左滑跳过不消耗额度。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Taro 3.6 + React 18 + TypeScript |
| UI | NutUI React Taro 2.7（按需引入） |
| 图标 | @nutui/icons-react-taro（内联 SVG，不依赖 CDN 字体） |
| 滑动交互 | touch 手势 + CSS transform |
| 状态管理 | Zustand |
| 后端 | 微信云开发（云函数 + 云数据库 + 云存储） |

## 快速开始

```bash
pnpm install
pnpm dev:weapp      # 开发（watch）
pnpm build:weapp    # 构建到 dist/
```

用微信开发者工具打开项目根目录即可（`project.config.json` 已配好 `miniprogramRoot: dist/`）。

默认跑在 **Mock 模式**：不需要 AppID、不需要云环境，内置种子数据，可离线跑通「滑动 → 匹配 → 聊天」全流程。

### 命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:weapp` / `pnpm build:weapp` | 开发（watch） / 构建 |
| `pnpm gen:tab-icons` | 生成 TabBar 的 PNG 图标（构建前自动跑） |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm verify` | 下面五项一起跑 |
| `pnpm verify:matching` | 匹配算法验证（12 项断言） |
| `pnpm verify:gesture` | 滑动手势验证（12 项断言 + 参数表） |
| `pnpm verify:quota` | 每日配额验证（10 项断言） |
| `pnpm verify:moderation` | 发布内容校验（7 项断言，重点是「不该拦」的样例） |
| `pnpm verify:icons` | 图标验证（渲染标签 / 样式序列化 / PNG 透明度和颜色） |
| `pnpm verify:dist` | 产物体检（残留的 process / HTML 标签映射） |

## 切换到真实云开发

```bash
echo 'TARO_APP_CLOUD_ENV=你的云环境ID' > .env
```

`src/services/index.ts` 会自动把 Mock 实现换成云开发实现，业务代码不用改。
建集合、建索引、部署云函数的步骤见 [cloudfunctions/README.md](./cloudfunctions/README.md)。

## 目录结构

```
src/
├── services/            # 数据访问层
│   ├── adapter.ts       #   SwapyApi 接口 —— 页面只认这个
│   ├── mock.ts          #   本地实现：内存 + Storage 持久化 + 种子数据
│   ├── cloud.ts         #   云开发实现：云函数 + 数据库实时推送
│   └── index.ts         #   唯一的实现选择点
├── store/               # Zustand：userStore / deckStore
├── components/
│   ├── Icon/            #   图标出口（统一标签映射 + 按需引入）
│   ├── CategoryIcon/    #   品类 → 图标
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
└── styles/              # 设计变量 + NutUI 按需样式

cloudfunctions/          # 7 个云函数
scripts/                 # 行为验证脚本 + TabBar 图标生成
assets/tab/              # TabBar 的 PNG（由 pnpm gen:tab-icons 生成，产物已入库）
```

## 约定

改代码前先看一眼这几条，都是不遵守就会出问题、但不会报错的地方。

- **数据只走 `src/services`**。页面和 store 只 `import { api } from '@/services'`，
  不直接调云函数或 Mock。加新能力先改 `SwapyApi` 接口，再补两份实现。
- **匹配判定有两份**：`src/services/mock.ts` 和 `cloudfunctions/swipe/index.js`，
  改动必须同步两边。`pnpm verify:matching` 验证的是 Mock 那份。
- **发布内容规则也有两份**：`src/utils/moderation.ts` 和
  `cloudfunctions/publishItem/moderation.js`。`pnpm verify:moderation`
  会用同一组样例跑两边并比对，不一致直接失败。- **手势参数在 `src/components/SwipeCard/gesture.ts` 顶部**。改完跑
  `pnpm verify:gesture`，它会打印一张行为表，不用通真机。
- **配额规则在 `src/utils/quota.ts` 和 `cloudfunctions/{swipe,getCards}/quota.js`**。
  每日上限和刷新整点是常量，改的时候三处要对齐。**判定只在服务端做**：
  客户端只拿 `{ limit, used, remaining, resetAt }` 显示，不参与计算。
- **图片切图用点击左右区域，不用横滑** —— 横滑手势留给「跳过 / 想要」。
- **改了 `src/constants/seed.ts` 就要把 `SEED_VERSION` +1**。Mock 数据存在本地
  Storage，版本对不上会自动重新播种；忘了加会导致老设备上一直是旧牌堆，
  表现得像「功能坏了」。
- **图标一律从 `@/components/Icon` 引入**，不要从 `@nutui/icons-react-taro`
  根导入。包的 sideEffects 让 barrel 无法 tree-shake，根导入会把 232 个图标
  全打进包；而且那个模块还会顺带引 189KB 的 iconfont 样式。
- **TabBar 图标是 PNG，页面内图标是组件**，两套资源不能共用：
  原生 tabBar 只认本地图片。改图后跑 `pnpm gen:tab-icons` 重新生成。
- **NutUI 组件渲染的是 HTML 标签**（`div` / `span` / `input`），Taro 内置组件表里
  没有这些，靠 `config/index.ts` 里的 `@tarojs/plugin-html` 在运行时映射成
  `view` / `text`。这个插件不能拆，拆了小面积区域会直接不渲染。
- **`scroll-view` 不能带 `padding`**，webview 模式下会被静默忽略（内容贴边）。
  需要内边距就包一层子 View。
- **新增 NutUI 组件要在 `src/styles/nutui.ts` 补一行样式引入**，否则组件没有样式。
  全量引入会让 wxss 从 24KB 涨到 259KB。
- **新增 `process.env` 变量要在 `config/index.ts` 的 `defineConstants` 里声明**，
  否则小程序启动会崩。`pnpm verify:dist` 会兜底拦截。
- **设计变量在 `src/styles/variables.scss`**，经 `sass.resource` 全局注入到每个
  `.scss`，组件里不用 `@import`。

## 设计规范

| 项 | 值 |
| --- | --- |
| 主色 | `#FF6B35` 活力橙 |
| 辅色 | `#FFF3E0` 浅橙背景 |
| 卡片 | 圆角 16px、白色、`0 8px 24px rgba(24,24,32,.1)` 阴影 |
| 设计稿宽度 | 375（代码里写 px，Taro 转 rpx） |

## 已知限制

- 云函数的距离筛选和估值区间筛选在内存里做（云数据库不支持这两类查询），
  物品量过万后需要改成按城市分片 + 预计算
- `getCards` 的「排除已滑过」依赖单次最多 1000 条 `swipes` 查询，
  用户滑过 1000 件后需要改成游标分批
- 聊天消息存在 match 文档的数组里，约 8 万条触及 16MB 文档上限
- 订阅消息需要用户先授权，一次性订阅只能推一条

## 设计文档

架构决策、数据模型、匹配算法、交互取舍见
[docs/superpowers/specs/2026-09-15-swapy-design.md](./docs/superpowers/specs/2026-09-15-swapy-design.md)。
