import { Button, Popup, Tag } from '@nutui/nutui-react-taro'
import { Text, View } from '@tarojs/components'

import { CATEGORIES } from '@/constants'
import type { Category } from '@/types'
import { toggleCategory } from '@/utils/filter'

import './index.scss'

interface Props {
  visible: boolean
  /** 草稿。由父组件持有 —— 弹层自己不存 state，就没有能被重置掉的东西。 */
  value: Category[]
  onChange: (next: Category[]) => void
  onClose: () => void
  onConfirm: () => void
}

/**
 * 品类筛选弹层（受控）。
 *
 * 草稿由父组件持有，**只有点「确认筛选」才提交**：
 * 点遮罩或右上角 × 关闭等于没改过。
 *
 * 这里刻意不放 useState/useEffect —— 之前内部存了一份 draft 并用
 * useEffect 在打开时种值，是「选中之后点不掉」最可能的来源。
 * 受控组件没有内部 state，就不可能被重置。
 */
export default function FilterSheet({ visible, value, onChange, onClose, onConfirm }: Props) {
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
      // 毛玻璃做在自带遮罩上（overlayClassName），不再叠第二层 Overlay：
      // 两层遮罩颜色会互相盖，效果不好预测。
      // 样式写在 scss 里而不是 overlayStyle 行内对象里 —— 行内对象的 camelCase
      // 要靠 Taro 转成 kebab-case 才生效，走 scss 还能让 autoprefixer 补 -webkit- 前缀。
      overlayClassName='filter-sheet__overlay'
    >
      <View className='filter-sheet'>
        <View className='filter-sheet__handle' />

        <View className='filter-sheet__head'>
          <Text className='filter-sheet__title'>筛选</Text>
          {value.length > 0 && (
            <View className='filter-sheet__reset' onClick={() => onChange([])}>
              <Text>清空</Text>
            </View>
          )}
        </View>

        <View className='filter-sheet__group'>
          <View className='filter-sheet__group-head'>
            <Text className='filter-sheet__label'>品类</Text>
            <Text className='filter-sheet__hint'>再点一下取消选择</Text>
          </View>

          {/* NutUI 这个版本没有 Flex 组件，标签换行直接用 flex-wrap */}
          <View className='filter-sheet__tags'>
            {CATEGORIES.map((c) => {
              const on = value.includes(c.key)
              return (
                // onClick 直接挂在 Tag 上（它自己的 props 里就有），
                // 不套一层 View 去接冒泡 —— 少一层就少一处会失效的地方
                <Tag
                  key={c.key}
                  className={`filter-sheet__tag ${on ? 'filter-sheet__tag--on' : ''}`}
                  type={on ? 'primary' : 'default'}
                  plain={!on}
                  onClick={() => onChange(toggleCategory(value, c.key))}
                >
                  {c.emoji} {c.key}
                </Tag>
              )
            })}
          </View>
        </View>

        <View className='filter-sheet__footer'>
          <Button type='primary' block shape='round' onClick={onConfirm}>
            确认筛选
          </Button>
        </View>
      </View>
    </Popup>
  )
}
