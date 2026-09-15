import { USE_MOCK } from '@/config'

import type { SwapyApi } from './adapter'
import { createCloudApi } from './cloud'
import { createMockApi } from './mock'

/**
 * 唯一的实现选择点。
 * Mock ↔ 云开发 的切换只发生在这里，业务代码永远只 import { api }。
 */
export const api: SwapyApi = USE_MOCK ? createMockApi() : createCloudApi()

export type { SwapyApi }
