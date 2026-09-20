/**
 * 是否启用定位（「选择城市」页的「使用当前定位」）。
 *
 * **默认关。** 原因很硬：只要在 app.json 的 `requiredPrivateInfos` 里声明了
 * `getFuzzyLocation`，而账号还没拿到这个接口权限，微信就会拒绝**预览和上传**：
 *
 *     [getFuzzyLocation] is not authorized （-80424）
 *
 * 那是整个小程序都传不上去，不只是定位不能用。所以声明和一个开关绑在一起：
 *
 * - `false`（默认）：app.json 不声明任何定位接口，城市选择页也不显示定位按钮
 *   —— 预览/上传正常，手动搜索、热门城市、不限城市全部可用
 * - `true`：声明 `getFuzzyLocation`，城市选择页出现「使用当前定位」
 *
 * 切到 `true` 之前，先去微信后台把两件事办好，否则按钮点了也只会提示手动选：
 * 1. 「开发管理 → 接口设置」申请开通 getFuzzyLocation
 * 2. 「设置 → 服务内容声明 → 用户隐私保护指引」勾选地理位置
 *
 * 注意：`requiredPrivateInfos` 里 `getLocation`（精确）和 `getFuzzyLocation`
 * （模糊）互斥，只能声明一个。同城匹配只需要城市级精度，所以用模糊定位。
 * `pnpm verify:dist` 会守住这个开关和 app.json 的一致性。
 */
export const LOCATION_ENABLED = false
