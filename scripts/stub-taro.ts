/**
 * 在 Node 里跑 Mock 数据层 / store 时用的 Taro 替身。
 * 只实现测试真正用到的那些 API，没实现的调用会直接报错（而不是静默失败）。
 */
const store = new Map<string, string>()

const noop = () => undefined

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

  // UI 相关：Node 里没有界面，记下来即可
  showToast: noop,
  showModal: noop,
  switchTab: noop,
  navigateTo: noop,
  setNavigationBarTitle: noop,
  previewImage: noop,

  __store: store,
}

export default Taro
