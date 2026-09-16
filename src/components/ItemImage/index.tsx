import { Image, Text, View } from '@tarojs/components'
import type { CSSProperties } from 'react'

import { hashHue } from '@/utils'

import './index.scss'

interface Props {
  /** 云存储 fileID / 本地路径；空值或 seed:// 开头时渲染占位图 */
  src?: string
  /** 占位图中心的大 emoji */
  emoji?: string
  className?: string
  style?: CSSProperties
  mode?: 'aspectFill' | 'aspectFit' | 'widthFix'
  onClick?: () => void
}

/**
 * 统一的物品图片组件。
 *
 * 种子数据和上传失败的图片都会退化成「渐变 + emoji」占位块，
 * 保证 UI 永远不会出现裂图或空洞。
 */
export default function ItemImage({
  src,
  emoji = '📦',
  className = '',
  style,
  mode = 'aspectFill',
  onClick,
}: Props) {
  const isPlaceholder = !src || src.startsWith('seed://')

  if (isPlaceholder) {
    const hue = hashHue(src || emoji)
    return (
      <View
        className={`item-image item-image--ph ${className}`}
        style={{
          background: `linear-gradient(140deg, hsl(${hue}, 78%, 90%) 0%, hsl(${
            (hue + 42) % 360
          }, 70%, 78%) 100%)`,
          ...style,
        }}
        onClick={onClick}
      >
        <Text className='item-image__emoji'>{emoji}</Text>
      </View>
    )
  }

  return (
    <Image
      className={`item-image ${className}`}
      style={style}
      src={src}
      mode={mode}
      onClick={onClick}
    />
  )
}
