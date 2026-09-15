import { useEffect, useState } from 'react'

/**
 * 两段式入场：先渲染在屏幕外，等一帧完成布局和绘制，再触发滑入。
 *
 * 为什么需要它：弹窗是挂载的瞬间才开始播入场动画的。
 * 如果动画和「整棵子树的布局 + 绘制」抢同一帧，就会看到掉帧 ——
 * 面板里东西越多（图片、滚动容器、输入框）越明显。
 *
 * 用 transform/opacity 做过渡（配合 `will-change`）能走上合成层，
 * 但前提是首帧的布局已经完成。这个 hook 就是保证这一点。
 *
 * @param active 是否处于打开状态
 * @param delay  等多久再入场。20ms 够跑完一帧，再大就会显得迟钝
 */
export function useEnter(active: boolean, delay = 20): boolean {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!active) {
      setEntered(false)
      return
    }
    const timer = setTimeout(() => setEntered(true), delay)
    return () => clearTimeout(timer)
  }, [active, delay])

  return entered
}
