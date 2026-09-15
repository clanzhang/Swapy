import { Text, View } from '@tarojs/components'
import { useRef, useState } from 'react'

import ItemImage from '../ItemImage'

import './index.scss'

interface Props {
  images: string[]
  emoji: string
  className?: string
}

/** 手指移动超过这个距离就认为是在拖卡片，而不是点击切图 */
const TAP_SLOP = 10

/**
 * 多图浏览。
 *
 * 注意：这里刻意不用「左右滑动切图」，因为横滑手势已经被
 * 「左滑跳过 / 右滑想要」占用了。改成点击图片左右两侧切图，
 * 顶部用分段进度条提示当前是第几张（Story 式交互）。
 */
export default function ItemImagePager({ images, emoji, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(0)

  const list = images.length ? images : ['']
  const total = list.length
  const current = Math.min(index, total - 1)

  const go = (step: number) => {
    setIndex((prev) => {
      const next = prev + step
      if (next < 0) return 0
      if (next > total - 1) return total - 1
      return next
    })
  }

  /**
   * 卡片是整体可拖拽的，手指按在图片上横滑时 el-tap 依然会在松手后触发。
   * 所以自己记录一下这次触摸的位移，拖过就不算点击。
   */
  const handleTouchStart = (e: any) => {
    const touch = e.touches?.[0]
    if (!touch) return
    startRef.current = { x: touch.clientX, y: touch.clientY }
    movedRef.current = 0
  }

  const handleTouchMove = (e: any) => {
    const start = startRef.current
    const touch = e.touches?.[0]
    if (!start || !touch) return
    const moved = Math.abs(touch.clientX - start.x) + Math.abs(touch.clientY - start.y)
    if (moved > movedRef.current) movedRef.current = moved
  }

  const tap = (step: number) => {
    if (movedRef.current > TAP_SLOP) return
    go(step)
  }

  return (
    <View className={`pager ${className}`}>
      <ItemImage src={list[current]} emoji={emoji} className='pager__img' />

      {/* 点击区域：左侧 32% 上一张，其余下一张 */}
      <View
        className='pager__hotzone pager__hotzone--prev'
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={() => tap(-1)}
      />
      <View
        className='pager__hotzone pager__hotzone--next'
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={() => tap(1)}
      />

      {total > 1 && (
        <View className='pager__bars'>
          {list.map((src, i) => (
            <View
              key={`${src}-${i}`}
              className={`pager__bar ${i <= current ? 'pager__bar--on' : ''}`}
            />
          ))}
        </View>
      )}

      {total > 1 && (
        <View className='pager__counter'>
          <Text>
            {current + 1}/{total}
          </Text>
        </View>
      )}
    </View>
  )
}
