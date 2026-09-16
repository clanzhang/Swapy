# AGENTS.md — 换换 Swapy

给 AI 助手看的项目约定。面向人的说明在 [README.md](./README.md)。

## 每次改动完成后

1. 跑 `pnpm verify`（lint + typecheck + 6 组行为验证 + 产物体检），必须全绿
2. `git add -A && git commit`（提交信息见下）
3. `git push origin main`

**不用等用户说「提交」。** 验证没通过就先修，不要带着红的结果提交。
本次运行没有产生改动时跳过，只回一句「无改动」。

## 版本号

按语义化版本改 `package.json` 的 `version`：

| 改动 | 版本 |
| --- | --- |
| 新功能 | minor（0.3.2 → 0.4.0） |
| 修 bug | patch（0.3.2 → 0.3.3） |
| 纯文档 / 重构 / 样式 | 不动 |

## 提交信息

首行 `<type>: <中文概述>`，需要时空一行加 `- ` 列表补充细节。
具体写「改了什么、为什么」，避免「update」这类笼统词。

类型：`feat` / `fix` / `docs` / `refactor` / `style` / `chore` / `perf` / `test`

## 改代码前先过一遍 README 的「约定」

那几条都是**不遵守就会出问题、但不会报错**的。其中最容易踩的：

- 数据只走 `src/services`，页面按域用 userService/itemService/swipeService/
  matchService/chatService，不直接调云函数或 Mock
- 服务端逻辑都有两份实现（`src/services/mock.ts` 和 `cloudfunctions/*`），
  匹配判定、同城筛选、分页、额度、内容校验，改动必须同步两边
- 改 `src/constants/seed.ts` 要同时把 `SEED_VERSION` +1，否则老设备一直用旧存档
- 图标从 `@/components/Icon` 引入，不要从 `@nutui/icons-react-taro` 包根导入
- 新增 NutUI 组件要在 `src/styles/nutui.ts` 补一行样式引入
- 新增 `process.env` 变量要在 `config/index.ts` 的 `defineConstants` 里声明
- `scroll-view` 不能带 `padding`，要包一层子 View 承载内边距
- `@tarojs/plugin-html` 不能从 `config/index.ts` 的 plugins 里拿掉

## 不要绕过 `scripts/` 里的闸门

这几个坑都是「构建成功但运行时报错」，肉眼看不出来，所以写成了自动检查。
遇到它们报错时改代码，不要改低检查标准：

| 命令 | 挡住的错误 |
| --- | --- |
| `pnpm lint` | hooks 依赖写错、未使用变量、`==` 误用 |
| `pnpm verify:dist` | 残留的 `process.*`；产物里有 HTML 标签但没启用 html 插件；scroll-view 自身带 padding |
| `pnpm verify:icons` | 图标渲染成 `<i>`；`-webkitMask` 没被转成合法 CSS；PNG 带白底 |
| `pnpm verify:matching` | 匹配规则写错；分页漏卡；种子数据被改到「怎么点都不匹配」 |
| `pnpm verify:chat` | 聊天消息去重失效、分页重复或倒序、时间戳规则写错 |
| `pnpm verify:motion` | 弹窗又用「挂载即播」的 keyframes、两个动画重叠、卡片没 memo |
| `pnpm verify:user` | 登录状态写错（isNew 永远为 true）、新用户没城市导致首页空白 |
| `pnpm verify:store` | 牌堆状态机写错：重复扣额度、过期响应污染牌堆、失败后不回滚 |
| `pnpm verify:gesture` | 手势阈值写错（改完会打印一张参数表，调手感不用通真机） |
| `pnpm verify:quota` | 配额的时间边界算错（跨 12:00、跨天重置） |
