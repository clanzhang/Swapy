import { ScrollView, Text, View } from '@tarojs/components'

import CategoryIcon from '@/components/CategoryIcon'
import { THEME } from '@/constants'
import { CATEGORIES } from '@/constants'
import type { Category } from '@/types'

import './index.scss'

interface Props {
  value: Category[]
  onChange: (value: Category[]) => void
}

/** 首页顶部的品类筛选：多选，空数组代表不限 */
export default function CategoryFilter({ value, onChange }: Props) {
  const toggle = (key: Category) => {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  }

  return (
    <ScrollView className='cat-filter' scrollX enableFlex showScrollbar={false}>
      <View className='cat-filter__row'>
        <View
          className={`cat-chip ${value.length === 0 ? 'cat-chip--on' : ''}`}
          onClick={() => onChange([])}
        >
          <Text>全部</Text>
        </View>
        {CATEGORIES.map((c) => (
          <View
            key={c.key}
            className={`cat-chip ${value.includes(c.key) ? 'cat-chip--on' : ''}`}
            onClick={() => toggle(c.key)}
          >
            <CategoryIcon
              category={c.key}
              size={13}
              color={value.includes(c.key) ? THEME.bg : THEME.sage}
            />
            <Text className='cat-chip__label'>{c.key}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
