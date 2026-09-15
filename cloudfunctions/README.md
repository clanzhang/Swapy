# 云函数部署说明

7 个云函数，全部依赖 `wx-server-sdk`。

## 一、新建云开发环境

微信开发者工具 → 云开发 → 新建环境，拿到环境 ID（形如 `swapy-1a2b3c4d`）。

## 二、切换到真实云开发

本项目默认跑在 **Mock 模式**（无需云环境，本地内存数据，可离线跑通全流程）。

切到真实云开发只改一处：

```bash
# 新建 .env 文件（已在 .gitignore 里）
echo 'TARO_APP_CLOUD_ENV=你的环境ID' > .env
```

`src/config/index.ts` 读到 `TARO_APP_CLOUD_ENV` 后，`src/services/index.ts`
会自动从 `createMockApi()` 换成 `createCloudApi()`，业务代码零改动。

## 三、创建集合

云开发控制台 → 数据库 → 新建以下 5 个集合：

| 集合 | 权限 | 说明 |
| --- | --- | --- |
| `users` | 仅创建者可读写 | 用户资料 + 每日额度 |
| `items` | 所有用户可读，仅创建者可写 | 物品 |
| `swipes` | 仅管理端可读写 | 滑动记录，**只能云函数写** |
| `matches` | 仅创建者可读写 | 匹配关系，**只能云函数写** |
| `messages` | 仅创建者可读写 | 聊天记录，**独立集合，不要嵌在 matches 里** |

> `swipes` / `matches` 设成「仅管理端可读写」是刻意的：匹配判定必须由
> `swipe` 云函数完成，客户端不能直接写这两张表，否则谁都能自己造一个匹配。

> `messages` 独立成集合有三个好处：能按 `matchId` 分页查询、能被客户端
> `watch` 订阅、不会撞上单文档 16MB 上限。

## 四、建索引

数据量一上来，没有索引的查询会直接超时。建议建这些：

```
items:     status + createdAt(降序)
items:     ownerId + status
items:     category + status
swipes:    fromUserId + toItemId          (唯一性靠云函数保证幂等)
swipes:    fromUserId
swipes:    fromUserId + toUserId + direction
matches:   userA + lastMessageAt(降序)
matches:   userB + lastMessageAt(降序)
messages:  matchId + createdAt(降序)       ← 聊天分页和 watch 都靠它
users:     _openid
```

## 五、上传云函数

在微信开发者工具里，右键 `cloudfunctions` 目录 → 上传并部署（云端安装依赖）。

`project.config.json` 里已经配好 `cloudfunctionRoot: "cloudfunctions/"`。

## 六、订阅消息（可选）

`swipe/index.js` 顶部有 `MATCH_TEMPLATE_ID`，在公众平台申请
「配对成功通知」类模板后填进去。留空则跳过推送，不影响匹配功能本身。

模板字段默认按 `thing1`（物品名）、`thing2`（昵称）取，如果模板字段不同，
改 `notifyBoth()` 里的 `data` 键名。

> 订阅消息需要用户端先调用 `wx.requestSubscribeMessage` 授权，
> 一次性订阅只能推一条。当前实现把推送失败静默吞掉了，匹配不会因此失败。

## 七、导入种子数据（冷启动）

新用户进来如果匹配池是空的，产品体验就废了。线上需要预置一批物品。

1. 把 `src/constants/seed.ts` 里的 `SEED_USERS` / `SEED_ITEMS` 导出成 JSON
2. 云开发控制台 → 数据库 → 对应集合 → 导入
3. **注意**：`items.ownerId` 必须指向真实存在、且 `city` 与目标用户相同的
   `users._id`，否则该物品永远不会出现在那个人的匹配池里
   （`getCards` 会跳过找不到 owner 或不同城的卡片）

种子数据里的图片是 `seed://xxx` 占位标记，线上要替换成真实云存储 fileID。

## 八、接口契约

云函数统一返回 `{ ok, data, message? }`，`data` 里的形状如下。
客户端 `src/services/cloud.ts` 的 `call()` 负责拆包。

| 云函数 | 入参 | 出参 `data` |
| --- | --- | --- |
| `login` | 无（可选 `nickname`/`avatarUrl`/`city`/`location` 顺带更新资料） | `{ user, isNew }` |
| `getCards` | `{ page = 1, pageSize = 20, categories?, scope? }` | `{ cards, hasMore, quota }` |
| `swipe` | `{ toItemId, toUserId, direction }` | `{ matched, matchId?, otherUser?, quota }` |
| `publishItem` | `{ title, category, condition, priceRange, description, imageFileIds }` | `{ success, itemId?, error? }` |
| `getMatches` | `matchId?` | `{ matches: [{ matchId, otherUser, myItem, otherItem, createdAt, lastMessage? }] }` |
| `sendMessage` | `{ matchId, content, type }` | `{ success, messageId? }` |
| `getChatHistory` | `{ matchId, page = 1 }` | `{ success, messages[] }` |

### 枚举值（存中文）

| 字段 | 取值 |
| --- | --- |
| `category` | 数码 / 书籍 / 潮玩 / 乐器 / 运动 |
| `condition` | 全新 / 95新 / 9成新 / 8成新 |
| `priceRange` | `0-50` / `50-200` / `200-500` / `500-2000` |
| `direction` | `left` / `right` |
| `status` | `active` / `swapped` / `off` |
| `type`（消息） | `text` / `image` |

### 时间戳用 number 而不是 Date

设计上云数据库的 `createdAt` 用 `Date` 也可以，但本项目统一用毫秒时间戳：

- 跨端序列化行为不一致（小程序端拿到的是 Date 对象，云函数拿到的是 ISO 字符串）
- 排序和比较不需要额外转换
- Mock 实现和云函数实现能共用同一套类型

如果确实需要 Date，改 `src/types` 和两侧实现即可，但要注意上面第一条。

## 九、已知限制

- **`getCards` 的同城 + 估值交集筛选在云函数内存里做**。云数据库不支持
  跨集合 join 和区间交集查询，所以只能先按 `status` / `category` 捞一批候选
  （上限 100 条），再批量取 owner、在内存里过滤。物品量过万之后需要改成
  按城市分片查询 + 定时任务预计算推荐池。
- **`swipes` 查询上限 1000 条**。单个用户滑过 1000 件之后，`getCards` 的
  「排除已滑过」会失效（会重复推荐）。届时改成按 `createdAt` 游标分批查。
- **分页下标必须索引稳定列表**。`getCards` 的 `page` 索引的是「同城 + 估值
  交集」的候选集，**不能**在查询阶段就用 `_.nin(swipedIds)` 排除已滑过的 ——
  那样候选集会随滑动变短，而页码按原步长前进，每页都会静默跳过一批卡片。
  排除已滑过必须放在切片之后。
- **聊天记录每页 50 条**，`getChatHistory` 用 `skip` 实现。翻到很后面的页
  会变慢，会话消息过万后需要改成按 `createdAt` 游标。
