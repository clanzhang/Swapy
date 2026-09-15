import { Text, View } from '@tarojs/components'
import { useRef, useState } from 'react'

import ItemImage from '../ItemImage'

import './index.scss'

interface Props {
  images: string[]
  emoji: string
  className?: string
}

/**
 * 多图浏览。
 *
 * 注意：这里刻意不用「左右滑动切图」，因为横滑手势已经被
 * 「左滑跳过 / 右滑想要」占用了。改成点击图片左右两侧切图，
 * 顶部用分段进度条提示当前是第几张（Story 式交互）。
 */
export default function ItemImagePager({ images, emoji, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const lastTap = useRef(0)

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

  return (
    <View className={`pager ${className}`}>
      <ItemImage src={list[current]} emoji={emoji} className='pager__img' />

      {/* 点击区域：左侧 32% 上一张，其余下一张 */}
      <View
        className='pager__hotzone pager__hotzone--prev'
        onClick={() => {
          lastTap.current = Date.now()
          go(-1)
        }}
      />
      <View
        className='pager__hotzone pager__hotzone--next'
        onClick={() => {
          lastTap.current = Date.now()
          go(1)
        }}
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
