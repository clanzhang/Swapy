import { Button, Input, TextArea } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { type ReactNode, useState } from 'react'

import { Close, Plus } from '@/components/Icon'
import CategoryIcon from '@/components/CategoryIcon'
import ItemImage from '@/components/ItemImage'
import { CATEGORIES, CONDITIONS, MAX_ITEM_IMAGES, PRICE_RANGES, THEME } from '@/constants'
import { api } from '@/services'
import type { Category, Condition, PriceRange } from '@/types'

import './index.scss'

function warn(title: string) {
  void Taro.showToast({ title, icon: 'none' })
}

interface ChipOption<T extends string> {
  key: T
  label: string
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  withIcon = false,
}: {
  options: ChipOption<T>[]
  value: T | null
  onChange: (next: T) => void
  withIcon?: boolean
}) {
  return (
    <View className='chip-group'>
      {options.map((option) => (
        <View
          key={option.key}
          className={`chip ${value === option.key ? 'chip--on' : ''}`}
          onClick={() => onChange(option.key)}
        >
          {withIcon && (
            <CategoryIcon
              category={option.key as unknown as Category}
              size={13}
              color={value === option.key ? THEME.primary : THEME.textSub}
            />
          )}
          <Text className='chip__text'>{option.label}</Text>
        </View>
      ))}
    </View>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <View className='field'>
      <View className='field__head'>
        <Text className='field__label'>{label}</Text>
        {!!hint && <Text className='field__hint'>{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

export default function Publish() {
  const [images, setImages] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [condition, setCondition] = useState<Condition | null>(null)
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const chooseImages = async () => {
    const remain = MAX_ITEM_IMAGES - images.length
    if (remain <= 0) {
      warn(`最多上传 ${MAX_ITEM_IMAGES} 张`)
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      setImages((prev) => [...prev, ...res.tempFilePaths].slice(0, MAX_ITEM_IMAGES))
    } catch {
      // 用户取消选择，不需要提示
    }
  }

  const reset = () => {
    setImages([])
    setTitle('')
    setCategory(null)
    setCondition(null)
    setPriceRange(null)
    setDescription('')
  }

  const submit = async () => {
    if (!images.length) return warn('至少上传一张图片')
    if (!title.trim()) return warn('给物品起个名字吧')
    if (!category) return warn('选择物品品类')
    if (!condition) return warn('选择物品成色')
    if (!priceRange) return warn('选择估值区间')

    setSubmitting(true)
    try {
      await api.publishItem({
        images,
        title: title.trim(),
        category,
        condition,
        priceRange,
        description: description.trim(),
      })
      reset()
      void Taro.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => void Taro.switchTab({ url: '/pages/index/index' }), 900)
    } catch {
      warn('发布失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page publish'>
      <ScrollView className='publish__body' scrollY>
        <Field label='物品图片' hint={`${images.length}/${MAX_ITEM_IMAGES}`}>
          <View className='uploader'>
            {images.map((src, i) => (
              <View key={`${src}-${i}`} className='uploader__cell'>
                <ItemImage
                  src={src}
                  emoji={category ? (CATEGORIES.find((c) => c.key === category)?.emoji ?? '📦') : '📦'}
                  className='uploader__img'
                />
                <View
                  className='uploader__remove'
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Close size={12} color='#FFFFFF' />
                </View>
                {i === 0 && (
                  <View className='uploader__cover'>
                    <Text>封面</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < MAX_ITEM_IMAGES && (
              <View className='uploader__cell uploader__cell--add' onClick={() => void chooseImages()}>
                <Plus size={22} color={THEME.primary} />
                <Text className='uploader__tip'>拍照 / 相册</Text>
              </View>
            )}
          </View>
        </Field>

        <Field label='物品名称'>
          <Input
            className='field__input'
            value={title}
            maxLength={30}
            placeholder='例如：Switch OLED 白色 日版'
            onChange={(v) => setTitle(v)}
          />
        </Field>

        <Field label='品类'>
          <ChipGroup<Category> options={CATEGORIES} value={category} onChange={setCategory} withIcon />
        </Field>

        <Field label='成色'>
          <ChipGroup<Condition> options={CONDITIONS} value={condition} onChange={setCondition} />
        </Field>

        <Field label='估值区间' hint='只和区间有交集的物品互相推荐'>
          <ChipGroup<PriceRange> options={PRICE_RANGES} value={priceRange} onChange={setPriceRange} />
        </Field>

        <Field label='物品描述' hint={`${description.length}/200`}>
          <TextArea
            className='field__textarea'
            value={description}
            maxLength={200}
            placeholder='说说使用情况、有无磕碰、配件是否齐全…'
            onChange={(v) => setDescription(v)}
          />
        </Field>

        <View className='publish__safe-area' />
      </ScrollView>

      <View className='publish__footer'>
        <Button
          type='primary'
          block
          size='large'
          shape='round'
          loading={submitting}
          onClick={() => void submit()}
        >
          发布到换换
        </Button>
      </View>
    </View>
  )
}
