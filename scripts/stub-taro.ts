/**
 * 在 Node 里跑 Mock 数据层时用的 Taro 替身。
 * 只实现 mock.ts 真正用到的那几个 API。
 */
const store = new Map<string, string>()

const Taro = {
  getStorageSync(key: string) {
    return store.get(key) ?? ''
  },
  setStorageSync(key: string, value: string) {
    store.set(key, value)
  },
  removeStorageSync(key: string) {
    store.delete(key)
  },
  __store: store,
}

export default Taro
