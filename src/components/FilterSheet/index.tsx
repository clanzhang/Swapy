import { Button, Popup, Tag } from '@nutui/nutui-react-taro'
import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'

import { CATEGORIES } from '@/constants'
import type { Category } from '@/types'

import './index.scss'

interface Props {
  visible: boolean
  /** 当前生效的筛选，弹层打开时拿它做草稿的初值 */
  value: Category[]
  onClose: () => void
  onConfirm: (categories: Category[]) => void
}

/**
 * 品类筛选弹层。
 *
 * 自己持有一份草稿（`draft`），**只有点「确认筛选」才往外提交**：
 * 点遮罩或右上角 × 关闭等于没改过。所以「打开 → 关掉」不会悄悄改掉筛选条件。
 */
export default function FilterSheet({ visible, value, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<Category[]>(value)

  // 每次打开都从当前生效的筛选重新种一次草稿，
  // 否则上次取消掉的选择会残留在里面
  useEffect(() => {
    if (visible) setDraft(value)
  }, [visible, value])

  const toggle = (key: Category) => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))
  }

  const reset = () => setDraft([])

  return (
    <Popup
      visible={visible}
      position='bottom'
      round
      closeable
      // 用 Popup 自己的 transition 属性，而不是在 style 里跟组件内部样式抢优先级
      transition='transform 300ms cubic-bezier(0.32, 0.72, 0, 1)'
      duration={300}
      closeOnOverlayClick
      onClose={onClose}
      // 毛玻璃做在自带遮罩上：单独再盖一层 Overlay 会和它叠起来，
      // 颜色互相盖，效果不好预测。
      //
      // 样式写在 scss 里而不是 overlayStyle 行内对象里 —— 行内对象的 camelCase
      // 要靠 Taro 转成 kebab-case 才生效，这里不想赌。走 scss 还能让
      // autoprefixer 自动补 -webkit- 前缀。
      // 不支持 backdrop-filter 的机型退化成普通深色遮罩，不影响使用。
      overlayClassName='filter-sheet__overlay'
    >
      <View className='filter-sheet'>
        <View className='filter-sheet__handle' />

        <View className='filter-sheet__head'>
          <Text className='filter-sheet__title'>筛选</Text>
          {draft.length > 0 && (
            <View className='filter-sheet__reset' onClick={reset}>
              <Text>清空</Text>
            </View>
          )}
        </View>

        <View className='filter-sheet__group'>
          <Text className='filter-sheet__label'>品类</Text>
          {/* NutUI 这个版本没有 Flex 组件，标签换行直接用 flex-wrap */}
          <View className='filter-sheet__tags'>
            {CATEGORIES.map((c) => {
              const on = draft.includes(c.key)
              return (
                <View key={c.key} className='filter-sheet__tag' onClick={() => toggle(c.key)}>
                  <Tag type={on ? 'primary' : 'default'} plain={!on}>
                    {c.emoji} {c.key}
                  </Tag>
                </View>
              )
            })}
          </View>
        </View>

        <View className='filter-sheet__footer'>
          <Button type='primary' block shape='round' onClick={() => onConfirm(draft)}>
            确认筛选
          </Button>
        </View>
      </View>
    </Popup>
  )
}
