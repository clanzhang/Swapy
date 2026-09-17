import { Button, Input, TextArea, Uploader } from '@nutui/nutui-react-taro'
import type { FileItem } from '@nutui/nutui-react-taro'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { type ReactNode, useMemo, useRef, useState } from 'react'

import { Plus, Warning } from '@/components/Icon'
import TagPicker from '@/components/TagPicker'
import { CATEGORIES, CONDITIONS, MAX_ITEM_IMAGES, PRICE_RANGES, THEME } from '@/constants'
import { itemService } from '@/services'
import type { Category, Condition, PriceRange } from '@/types'
import { describeHits, moderateItem } from '@/utils/moderation'
import type { ModerationHit } from '@/utils/moderation'

import './index.scss'

function warn(title: string) {
  void Taro.showToast({ title, icon: 'none' })
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
  const [files, setFiles] = useState<FileItem[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [condition, setCondition] = useState<Condition | null>(null)
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** 正在上传的 uid。防止同一张图被重复上传（onChange 可能被触发多次）。 */
  const uploadingRef = useRef<Set<string>>(new Set())

  /**
   * 边写边提示：不要等用户填完一整屏才告诉他不行。
   * 只提示、不阻止输入，否则改一半的字会被打断。
   */
  const moderation = useMemo(() => moderateItem({ title, description }), [title, description])

  const patch = (uid: string, next: Partial<FileItem>) =>
    setFiles((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...next } : f)))

  /** 选完立刻传云存储拿 fileID，而不是攒到提交时才传 */
  const uploadOne = async (file: FileItem) => {
    const src = file.path
    if (!src) return
    uploadingRef.current.add(file.uid)
    try {
      const [fileId] = await itemService.uploadImages([src])
      // status 置成 success，NutUI 才会把盖在缩略图上的进度层收掉
      patch(file.uid, { url: fileId, status: 'success' })
    } catch {
      patch(file.uid, { status: 'error', message: '上传失败' })
    } finally {
      uploadingRef.current.delete(file.uid)
    }
  }

  const handleFiles = (next: FileItem[]) => {
    /*
      NutUI 的 readFile 只设了 path，**没有设 url**，而缩略图的渲染条件是
      `item.url` 存在 —— 不回填的话选完图是一片空白。所以先把本地路径塞进 url
      （本地路径也能直接被 previewImage 预览），上传完再换成 fileID。
    */
    const prepared = next.map((f) =>
      f.url ? f : { ...f, url: f.path, status: 'uploading' as const, message: '上传中' },
    )
    setFiles(prepared)

    // 只传这一批里新加的；已有 url 的是老图或已传完的
    for (const f of prepared) {
      if (f.status !== 'success' && !uploadingRef.current.has(f.uid)) void uploadOne(f)
    }
  }

  const preview = (file: FileItem) => {
    const urls = files.map((f) => f.url || f.path || '').filter(Boolean)
    if (!urls.length) return
    const at = Math.max(0, files.findIndex((f) => f.uid === file.uid))
    void Taro.previewImage({ urls, current: urls[at] })
  }

  const reset = () => {
    setFiles([])
    setTitle('')
    setCategory(null)
    setCondition(null)
    setPriceRange(null)
    setDescription('')
  }

  const submit = async () => {
    // loading 态不一定拦得住点击，自己再挡一道，避免重复提交
    if (submitting) return

    if (!files.length) return warn('至少上传一张图片')
    if (files.some((f) => f.status !== 'success')) {
      return warn(
        files.some((f) => f.status === 'error') ? '有图片上传失败，删掉重选' : '图片还在上传中',
      )
    }
    if (!title.trim()) return warn('给物品起个名字吧')
    if (!category) return warn('选择品类')
    if (!condition) return warn('选择成色')
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
        // 图片在选完那一刻就已经传好了，这里直接用 fileID
        imageFileIds: files.map((f) => f.url!).filter(Boolean),
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
      setTimeout(() => void Taro.switchTab({ url: '/pages/index/index' }), 900)
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
          <Field label='物品图片' hint={`${files.length}/${MAX_ITEM_IMAGES} · 第一张是封面`}>
            <Uploader
              className='publish__uploader'
              value={files}
              onChange={handleFiles}
              // 上传自己接管：NutUI 的 Taro 版走的是 Taro.uploadFile（HTTP 端点），
              // 而微信云存储要的是 Taro.cloud.uploadFile，两回事。
              // autoUpload=false 让它完全不碰上传，只当选择器和网格。
              autoUpload={false}
              multiple
              previewType='picture'
              maxCount={MAX_ITEM_IMAGES}
              deletable
              uploadIcon={<Plus size={22} color={THEME.sage} />}
              uploadLabel='添加图片'
              // 规格要的是长按预览，但 Uploader 里完全没有 longpress、也没有 data-*
              // 能定位到点的是哪一项，所以只有点击这一种可能。
              onFileItemClick={preview}
            />
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
            <TagPicker
              options={CATEGORIES.map((c) => ({ key: c.key, emoji: c.emoji }))}
              value={category ? [category] : []}
              onChange={(next) => setCategory(next[0] ?? null)}
            />
          </Field>

          <Field label='成色'>
            <TagPicker<Condition>
              options={CONDITIONS.map((c) => ({ key: c }))}
              value={condition ? [condition] : []}
              onChange={(next) => setCondition(next[0] ?? null)}
            />
          </Field>

          <Field label='估值区间' hint='只和区间有交集的物品互相推荐'>
            <TagPicker<PriceRange>
              options={PRICE_RANGES.map((p) => ({ key: p.key, label: p.label }))}
              value={priceRange ? [priceRange] : []}
              onChange={(next) => setPriceRange(next[0] ?? null)}
            />
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
          disabled={submitting}
          onClick={() => void submit()}
        >
          发布到换换
        </Button>
      </View>
    </View>
  )
}
