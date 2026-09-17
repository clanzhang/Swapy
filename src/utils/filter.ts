/**
 * 筛选草稿的纯逻辑。
 *
 * 抽成纯函数有两个原因：
 * 1. 能单独断言 —— 「选中之后点不掉」这类问题本质是状态算错了，
 *    状态必须能在 Node 里直接验证，而不是靠真机上点。
 * 2. 弹层自己不再持有 state，改成受控：没有内部 state 就没有
 *    「被 useEffect 重置掉」这种问题的生存空间。
 */
/**
 * 点一下标签：已选则移除，未选则追加到末尾。
 * 不改原数组 —— 原地改会让 React 认为引用没变而跳过重渲染。
 */
export function toggleValue<T extends string>(list: T[], key: T): T[] {
  return list.includes(key) ? list.filter((c) => c !== key) : [...list, key]
}
