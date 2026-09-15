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

云开发控制台 → 数据库 → 新建以下 4 个集合：

| 集合 | 权限 | 说明 |
| --- | --- | --- |
| `users` | 仅创建者可读写 | 用户资料 |
| `items` | 所有用户可读，仅创建者可写 | 物品 |
| `swipes` | 仅管理端可读写 | 滑动记录，**只能云函数写** |
| `matches` | 仅创建者可读写 | 匹配与聊天，**只能云函数写** |

> `swipes` / `matches` 设成「仅管理端可读写」是刻意的：匹配判定必须由
> `swipe` 云函数完成，客户端不能直接写这两张表，否则谁都能自己造一个匹配。

## 四、建索引

数据量一上来，没有索引的查询会直接超时。建议建这些：

```
items:    status + createdAt(降序)
items:    ownerId + status
items:    category + status
swipes:   fromUserId + toItemId          (复合，唯一性靠云函数保证幂等)
swipes:   fromUserId
swipes:   fromUserId + toUserId + direction
matches:  userA + lastMessageAt(降序)
matches:  userB + lastMessageAt(降序)
users:    _openid
```

## 五、上传云函数

在微信开发者工具里，右键 `cloudfunctions` 目录 → 上传并部署（云端安装依赖）。

或者逐个右键每个函数目录 → 上传并部署。

`project.config.json` 里已经配好 `cloudfunctionRoot: "cloudfunctions/"`，
打开项目就能直接看到这些函数。

## 六、订阅消息（可选）

`swipe/index.js` 顶部有 `MATCH_TEMPLATE_ID`，在公众平台申请
「配对成功通知」类模板后填进去。留空则跳过推送，不影响匹配功能本身。

模板字段默认按 `thing1`（物品名）、`thing2`（昵称）取，如果模板字段不同，
改 `notifyBoth()` 里的 `data` 键名。

> 注意：订阅消息需要用户端先调用 `wx.requestSubscribeMessage` 授权，
> 一次性订阅只能推一条。当前实现把推送失败静默吞掉了，匹配不会因此失败。

## 七、导入种子数据（冷启动）

新用户进来如果匹配池是空的，产品体验就废了。线上需要预置一批物品。

1. 把 `src/constants/seed.ts` 里的 `SEED_USERS` / `SEED_ITEMS` 导出成 JSON
2. 云开发控制台 → 数据库 → 对应集合 → 导入
3. **注意**：`items.ownerId` 必须指向真实存在、且 `_openid` 有效 的 `users._id`，
   否则该物品永远不会出现在任何人的匹配池里（`getCards` 会跳过找不到 owner 的卡片）

种子数据里的图片是 `seed://xxx` 占位标记，线上要替换成真实云存储 fileID。

## 八、各云函数职责

| 云函数 | 入参 | 出参 |
| --- | --- | --- |
| `login` | `city` / `nickname` / `avatarUrl` / `location` | `User` |
| `getCards` | `cursor` / `limit` / `categories` / `scope='wanted'` | `{ list, nextCursor }` 或 `CardItem[]` |
| `swipe` | `toItemId` / `direction` | `{ matched, match? }` |
| `publishItem` | 物品字段 或 `action='updateStatus'` + `itemId`/`status` | `Item` |
| `getMatches` | `matchId?` | `MatchView[]` |
| `sendMessage` | `matchId` / `type` / `content` | `ChatMessage` |
| `getChatHistory` | `matchId` / `since?` | `ChatMessage[]` |

所有云函数统一返回 `{ ok: boolean, data?: T, message?: string }`，
客户端 `src/services/cloud.ts` 里的 `call()` 统一拆包。

## 九、已知限制

- **`getCards` 的距离与估值筛选在云函数内存里做**。云数据库不支持地理距离
  和区间交集查询，所以只能先按 `status/category` 捞一批候选（上限 100 条），
  再在内存里过滤。物品量过万之后需要改成：按城市分片查询 + 定时任务预计算
  推荐池。当前实现对早期规模是够的。
- **`swipes` 查询上限 1000 条**。单个用户滑过 1000 件之后，`getCards` 的
  「排除已滑过」会失效（会重复推荐）。届时改成按 `createdAt` 游标分批查。
- **聊天消息存在 match 文档的数组里**，单文档 16MB 上限约 8 万条消息。
  一对一的闲置交换场景够用；要做大再拆独立集合。
