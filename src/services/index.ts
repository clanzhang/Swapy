import { USE_MOCK } from '@/config'

import type { SwapyApi } from './adapter'
import { createCloudApi } from './cloud'
import { createMockApi } from './mock'

/**
 * 当前的实现。
 *
 * 业务代码不要直接用这个，用同目录下按域拆分的模块：
 *   user.ts / item.ts / swipe.ts / match.ts / chat.ts
 * 它们只是薄封装，方便按云函数职责阅读和替换实现。
 *
 * 这里保持单一实例：切 Mock / 云开发只改这一行。
 */
export const api: SwapyApi = USE_MOCK ? createMockApi() : createCloudApi()

// 按域拆分的入口。页面优先用这些（它们只是薄封装）：
//   userService / itemService / swipeService / matchService / chatService
//
// 这里有循环引用（服务模块从本文件取 api），所以服务模块内部**不能**在
// 模块初始化阶段就解引用 api —— 必须包在箭头函数里延迟到调用时。
export { userService } from './user'
export { itemService } from './item'
export { swipeService } from './swipe'
export { matchService } from './match'
export { chatService } from './chat'

export type { SwapyApi }
