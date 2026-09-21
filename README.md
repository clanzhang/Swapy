# 换换 Swapy

> 闲置物品滑动匹配交换小程序 —— 右滑「想要」，双方互相想要就配对成功。

发布自己的闲置，左右滑动浏览附近人的物品，双方互相「想要」时匹配成功，然后一对一聊怎么换。不涉及支付，交换默认线下当面完成。

每天有 **30 次刷卡额度**，左滑跳过和右滑想要都算，中午 12:00 刷新。匹配池按 **同城** 筛选。

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

登录是**静默**的：打开小程序自动拿 openid 建号，不需要注册、不需要手机号、不弹窗。
昵称和头像延迟到**第一次右滑**时才引导完善，而且可以跳过。

想把 Mock 数据恢复到初始种子状态：在开发者工具里「清缓存 → 清除数据缓存」，
或直接调 `src/services/mock.ts` 的 `resetMockData()`（页面上不再放这个按钮）。

## 切换到真实云开发

```bash
echo 'TARO_APP_CLOUD_ENV=你的云环境ID' > .env
```

`src/services/index.ts` 会自动把 Mock 实现换成云开发实现，业务代码不用改。
建集合、建索引、部署云函数的步骤见 [cloudfunctions/README.md](./cloudfunctions/README.md)。

归 clan.z 所有
