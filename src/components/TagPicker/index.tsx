import { Tag } from '@nutui/nutui-react-taro'
import { View } from '@tarojs/components'

import { toggleValue } from '@/utils/filter'

import './index.scss'

export interface TagOption<T extends string> {
  key: T
  /** 不传就显示 key 本身（品类/成色/估值区间的 key 已经是中文） */
  label?: string
  emoji?: string
}

interface Props<T extends string> {
  options: TagOption<T>[]
  /** 选中的项。单选就是长度 0 或 1 —— 统一用数组，省得维护两套逻辑 */
  value: T[]
  onChange: (next: T[]) => void
  /**
   * 多选时点已选中的会取消；
   * 单选时点已选中的保持选中（必填项不该被误点清掉，要清只能靠提交校验提示）。
   */
  multiple?: boolean
}

/**
 * 标签选择器。筛选弹层的品类、发布页的成色/估值共用同一套外观和交互。
 *
 * onClick 直接挂在 NutUI Tag 上（`onClick` 本来就是它的 props），
 * 不套一层 View 去接冒泡 —— 少一层就少一处会失效的地方。
 */
export default function TagPicker<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
}: Props<T>) {
  return (
    <View className='tag-picker'>
      {options.map((option) => {
        const on = value.includes(option.key)
        return (
          <Tag
            key={option.key}
            className={`tag-picker__tag ${on ? 'tag-picker__tag--on' : ''}`}
            type={on ? 'primary' : 'default'}
            plain={!on}
            onClick={() => onChange(multiple ? toggleValue(value, option.key) : [option.key])}
          >
            {option.emoji ? `${option.emoji} ${option.label ?? option.key}` : (option.label ?? option.key)}
          </Tag>
        )
      })}
    </View>
  )
}
