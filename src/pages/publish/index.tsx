import { Button, Input, TextArea } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { type ReactNode, useMemo, useState } from 'react'

import { Close, Plus, Warning } from '@/components/Icon'
import CategoryIcon from '@/components/CategoryIcon'
import ItemImage from '@/components/ItemImage'
import {
  CATEGORIES,
  CATEGORY_MAP,
  CONDITIONS,
  MAX_ITEM_IMAGES,
  PRICE_RANGES,
  THEME,
} from '@/constants'
import { itemService } from '@/services'
import type { Category, Condition, PriceRange } from '@/types'
import { describeHits, moderateItem } from '@/utils/moderation'
import type { ModerationHit } from '@/utils/moderation'

import './index.scss'

function warn(title: string) {
  void Taro.showToast({ title, icon: 'none' })
}

interface ChipOption<T extends string> {
  key: T
  /** 不传就显示 key 本身（品类/成色的 key 已经是中文） */
  label?: string
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
          <Text className='chip__text'>{option.label ?? option.key}</Text>
        </View>
      ))}
    </View>
  )
}

function ModerationNotice({ hits }: { hits: ModerationHit[] }) {
  return (
    <View className='notice'>
      {hits.map((hit) => (
        <View key={hit.category} className='notice__row'>
          <Warning size={12} color={THEME.danger} />
          <Text className='notice__text'>{hit.message}</Text>
        </View>
      ))}
    </View>
  )
}

function Field({
  label,
  hint,
  inline = false,
  children,
}: {
  label: string
  hint?: string
  /** 标签左、控件右的同行布局（名称这种短输入用） */
  inline?: boolean
  children: ReactNode
}) {
  if (inline) {
    return (
      <View className='field field--inline'>
        <Text className='field__label'>{label}</Text>
        {children}
      </View>
    )
  }

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

  /**
   * 边写边提示：不要等用户填完一整屏才告诉他不行。
   * 只提示、不阻止输入，否则改一半的字会被打断。
   */
  const moderation = useMemo(
    () => moderateItem({ title, description }),
    [title, description],
  )

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

    // 内容不合规：用弹窗把每一条都摆出来，而不是笼统地说「内容违规」
    if (!moderation.ok) {
      return void Taro.showModal({
        title: '内容需要调整',
        content: describeHits(moderation.hits),
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#3C5434',
      })
    }

    setSubmitting(true)
    try {
      const res = await itemService.publishItem({
        // 图片先传云存储拿 fileID，再把 fileID 交给云函数
        imageFileIds: await itemService.uploadImages(images),
        title: title.trim(),
        category,
        condition,
        priceRange,
        description: description.trim(),
      })

      // 云函数的内容校验可能拦下客户端没拦到的（比如请求被改过）
      if (!res.success) {
        return void Taro.showModal({
          title: '发布失败',
          content: res.error || '请稍后重试',
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#3C5434',
        })
      }

      reset()
      void Taro.showToast({ title: '发布成功', icon: 'success' })
      // 切到「我的」而不是首页：刚发的东西就在「我的发布」第一条。
      // 回首页只会看到一堆别人的卡，用户会以为「发了但没显示」。
      setTimeout(() => void Taro.switchTab({ url: '/pages/profile/index' }), 900)
    } catch {
      void Taro.showModal({
        title: '发布失败',
        content: '网络不太好，请稍后重试',
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#3C5434',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page publish'>
      <ScrollView className='publish__body' scrollY>
        {/* scroll-view 在 webview 模式下不支持 padding，只能靠内层容器 */}
        <View className='publish__inner'>
          <Field label='物品图片' hint={`${images.length}/${MAX_ITEM_IMAGES}`}>
            <View className='uploader'>
              {/* 规范：第一格是虚线边框的添加按钮 */}
              {images.length < MAX_ITEM_IMAGES && (
                <View
                  className='uploader__cell uploader__cell--add'
                  onClick={() => void chooseImages()}
                >
                  <Plus size={22} color={THEME.sage} />
                  <Text className='uploader__tip'>添加图片</Text>
                </View>
              )}
              {images.map((src, i) => (
                <View key={`${src}-${i}`} className='uploader__cell'>
                  <ItemImage
                    src={src}
                    emoji={category ? (CATEGORY_MAP[category]?.emoji ?? '📦') : '📦'}
                    className='uploader__img'
                  />
                  <View
                    className='uploader__remove'
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Close size={12} color='#FEFDFC' />
                  </View>
                  {i === 0 && (
                    <View className='uploader__cover'>
                      <Text>封面</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Field>

          <Field label='物品名称' inline>
            <Input
              className='field__input field__input--inline'
              align='right'
              value={title}
              maxLength={30}
              placeholder='例如：Switch OLED 白色 日版'
              onChange={(v) => setTitle(v)}
            />
          </Field>
          {!moderation.ok && (
            <View className='field field--notice'>
              <ModerationNotice hits={moderation.hits} />
            </View>
          )}

          <Field label='品类'>
            <ChipGroup<Category> options={CATEGORIES} value={category} onChange={setCategory} withIcon />
          </Field>

          <Field label='成色'>
            <ChipGroup<Condition>
              options={CONDITIONS.map((c) => ({ key: c }))}
              value={condition}
              onChange={setCondition}
            />
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
        </View>
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
