import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Camera } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP, CHAT_PAGE_SIZE, THEME } from '@/constants'
import { chatService, itemService, matchService } from '@/services'
import { useUserStore } from '@/store/userStore'
import type { ChatMessage, LocalMessage, MatchItem, MessageType } from '@/types'
import { clockTime } from '@/utils'
import { shouldShowTime } from '@/utils/chat'

import './index.scss'

/** 滚到底用一个足够大的值，ScrollView 自己会夹到最大值 */
const BOTTOM = 999999

/** 生成一条本地临时消息的 id。落库成功后会被服务端返回的真实 _id 替换。 */
function localId() {
  return `local_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export default function Chat() {
  const matchId = Taro.getCurrentInstance().router?.params?.matchId || ''
  const me = useUserStore((s) => s.user)

  const [match, setMatch] = useState<MatchItem | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  /** 已加载到第几页（1 是最新的一页） */
  const pageRef = useRef(1)
  /** scrollTop 的递增量：目标值相同时也要能触发一次滚动 */
  const tickRef = useRef(0)
  /** 当前滚动位置与内容总高，用来在插入更早消息后把视图拉回原位 */
  const scrollRef = useRef({ top: 0, height: 0 })
  /** 非空表示刚插入了更早的消息，等下一次 onScroll 时校正位置 */
  const anchorRef = useRef<{ top: number; height: number } | null>(null)
  const watchOffRef = useRef<(() => void) | null>(null)
  /** 订阅回调要走 ref，否则每次渲染都会重新订阅 */
  const onIncomingRef = useRef<(msg: ChatMessage) => void>(() => {})

  const scrollTo = useCallback((value: number) => {
    tickRef.current += 1
    // 加一个极小的递增量，保证目标值相同也能触发滚动；视觉上无影响
    setScrollTop(value + tickRef.current * 0.01)
  }, [])

  const scrollToBottom = useCallback(() => scrollTo(BOTTOM), [scrollTo])

  // ------------------------------------------------------------ 历史消息

  const loadHistory = useCallback(
    async (page: number, mode: 'initial' | 'more') => {
      if (!matchId) return
      setLoading(true)
      try {
        const res = await chatService.getChatHistory({ matchId, page })
        const list = res.messages ?? []
        const incoming: LocalMessage[] = list.map((m) => ({ ...m, status: 'sent' }))

        if (mode === 'initial') {
          setMessages(incoming)
          scrollToBottom()
        } else if (incoming.length) {
          // 插到前面时记下当前滚动状态，等下一次 onScroll 校正，避免视图跳动
          anchorRef.current = { ...scrollRef.current }
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m._id))
            return [...incoming.filter((m) => !known.has(m._id)), ...prev]
          })
        }

        pageRef.current = page
        setHasMore(list.length >= CHAT_PAGE_SIZE)
      } catch {
        // 拉取失败保持现状，用户可以下拉重试
      } finally {
        setLoading(false)
      }
    },
    [matchId, scrollToBottom],
  )

  // ------------------------------------------------------------ 订阅

  const openWatch = useCallback(() => {
    if (!matchId || watchOffRef.current) return
    watchOffRef.current = chatService.subscribe(matchId, (msg) => onIncomingRef.current(msg))
  }, [matchId])

  const closeWatch = useCallback(() => {
    watchOffRef.current?.()
    watchOffRef.current = null
  }, [])

  // 收到新消息：忽略自己发的（那条在发送流程里已经渲染过了），其余追加并滚到底
  onIncomingRef.current = (msg: ChatMessage) => {
    if (msg.senderId === me?._id) return
    setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, { ...msg, status: 'sent' }]))
    scrollToBottom()
  }

  useEffect(() => {
    if (!matchId) return

    void (async () => {
      const detail = await matchService.getMatch(matchId)
      if (detail) {
        setMatch(detail)
        void Taro.setNavigationBarTitle({ title: detail.otherUser.nickname })
      }
    })()

    void loadHistory(1, 'initial')
    openWatch()

    return () => closeWatch()
  }, [matchId, loadHistory, openWatch, closeWatch])

  // 规格要求离开页面就释放 watch（免费版连接数有限），回来再开
  useDidShow(() => openWatch())
  useDidHide(() => closeWatch())

  // ------------------------------------------------------------ 键盘

  useEffect(() => {
    // 输入框设了 adjustPosition={false}，页面自己上推：
    // 这样消息列表也能跟着缩，而不是被键盘盖住
    const handler = (res: { height: number }) => setKeyboardHeight(res.height)
    Taro.onKeyboardHeightChange?.(handler)
    return () => Taro.offKeyboardHeightChange?.(handler)
  }, [])

  // ------------------------------------------------------------ 滚动

  const handleScroll = (e: any) => {
    const detail = e.detail
    scrollRef.current = { top: detail.scrollTop, height: detail.scrollHeight }

    // 刚插入了更早的消息：内容变高了，把视图往下推同样的高度，
    // 用户看到的那条消息位置不变
    const anchor = anchorRef.current
    if (anchor) {
      anchorRef.current = null
      const delta = detail.scrollHeight - anchor.height
      if (delta > 0) scrollTo(anchor.top + delta)
    }
  }

  const loadMore = () => {
    if (loading || !hasMore) return
    void loadHistory(pageRef.current + 1, 'more')
  }

  // ------------------------------------------------------------ 发送

  /** 乐观渲染一条本地消息，返回它的临时 id */
  const pushOptimistic = (type: MessageType, content: string) => {
    const id = localId()
    const optimistic: LocalMessage = {
      _id: id,
      matchId,
      senderId: me?._id ?? '',
      content,
      type,
      createdAt: Date.now(),
      status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()
    return id
  }

  const settle = (id: string, msg: LocalMessage) => {
    setMessages((prev) => prev.map((m) => (m._id === id ? { ...msg, status: 'sent' } : m)))
  }

  const fail = (id: string) => {
    setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, status: 'failed' } : m)))
  }

  /**
   * 发送（也用于重试）。
   * 先本地渲染，拿到服务端返回的真实消息后替换掉临时那条 ——
   * 这样 watch 推来同一条时才能按 _id 去重。
   */
  const deliver = async (type: MessageType, content: string, retryId?: string) => {
    if (retryId) {
      setMessages((prev) => prev.map((m) => (m._id === retryId ? { ...m, status: 'sending' } : m)))
    }
    const id = retryId ?? pushOptimistic(type, content)

    try {
      const res = await chatService.sendMessage({ matchId, content, type })
      if (!res.success || !res.message) throw new Error('发送失败')
      settle(id, { ...res.message, status: 'sent' })
      scrollToBottom()
    } catch {
      fail(id)
    }
  }

  const sendText = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    void deliver('text', text)
  }

  const pickAndSendImage = async () => {
    let path: string | undefined
    try {
      // sourceType 给两个就是「拍照 / 从相册选择」二选一，是系统原生弹的
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      path = res.tempFilePaths[0]
    } catch {
      return // 用户取消
    }
    if (!path) return

    // 先用本地路径渲染出来（等于「上传中」），传完再换成云存储 fileID
    const id = pushOptimistic('image', path)
    try {
      const [fileId] = await itemService.uploadImages([path])
      const res = await chatService.sendMessage({ matchId, content: fileId, type: 'image' })
      if (!res.success || !res.message) throw new Error('发送失败')
      settle(id, { ...res.message, status: 'sent' })
      scrollToBottom()
    } catch {
      fail(id)
    }
  }

  const retry = async (msg: LocalMessage) => {
    if (msg.type === 'text') {
      void deliver('text', msg.content, msg._id)
      return
    }
    // 图片失败时，content 可能还只是本地临时路径，要重新上传
    const needsUpload = !/^(cloud:\/\/|https?:)/.test(msg.content)
    if (!needsUpload) {
      void deliver('image', msg.content, msg._id)
      return
    }
    try {
      const [fileId] = await itemService.uploadImages([msg.content])
      void deliver('image', fileId, msg._id)
    } catch {
      // 还失败就继续保持失败态
    }
  }

  // ------------------------------------------------------------ 渲染

  const canSend = inputValue.trim().length > 0
  const myEmoji = match ? (CATEGORY_MAP[match.myItem.category]?.emoji ?? '📦') : '📦'
  const peerEmoji = match ? (CATEGORY_MAP[match.otherItem.category]?.emoji ?? '📦') : '📦'

  return (
    <View
      className='page chat'
      style={keyboardHeight ? { paddingBottom: `${keyboardHeight}px` } : undefined}
    >
      {match && (
        <View className='chat__banner'>
          <View className='chat__banner-side'>
            <View className='chat__banner-thumb'>
              <ItemImage src={match.myItem.images[0]} emoji={myEmoji} />
            </View>
            <Text className='chat__banner-label ellipsis'>我的 · {match.myItem.title}</Text>
          </View>

          <Text className='chat__banner-swap'>⇄</Text>

          <View className='chat__banner-side'>
            <View className='chat__banner-thumb'>
              <ItemImage src={match.otherItem.images[0]} emoji={peerEmoji} />
            </View>
            <Text className='chat__banner-label ellipsis'>
              {match.otherUser.nickname} · {match.otherItem.title}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        className='chat__list'
        scrollY
        // 不用 id 锚点：scrollTop 在小程序里更稳定
        scrollWithAnimation={false}
        scrollTop={scrollTop}
        upperThreshold={30}
        onScroll={handleScroll}
        onScrollToUpper={loadMore}
      >
        {/* scroll-view 在 webview 模式下不支持 padding，只能靠内层容器 */}
        <View className='chat__inner'>
          <View className='chat__tip'>
            <Text>匹配成功，聊聊怎么换吧 · 建议线下公共场所当面交换</Text>
          </View>

          {loading && (
            <View className='chat__tip'>
              <Text>正在加载…</Text>
            </View>
          )}
          {!loading && !hasMore && messages.length > 0 && (
            <View className='chat__tip'>
              <Text>没有更早的消息了</Text>
            </View>
          )}

          {!loading && !messages.length ? (
            <View className='chat__empty'>
              <Text className='chat__empty-emoji'>💬</Text>
              <Text className='chat__empty-text'>开始聊天吧，聊聊怎么交换～</Text>
            </View>
          ) : (
            messages.map((msg, i) => {
              const mine = msg.senderId === me?._id
              // 和上一条间隔超过 5 分钟才单独显示时间，免得每行都是时间
              const showTime = shouldShowTime(msg, messages[i - 1])
              const avatar = mine ? me?.avatarUrl : match?.otherUser.avatarUrl
              const name = (mine ? me?.nickname : match?.otherUser.nickname) || '?'

              return (
                <View key={msg._id}>
                  <View className={`bubble-row ${mine ? 'bubble-row--mine' : ''}`}>
                    <View className='bubble-avatar'>
                      {avatar ? (
                        <ItemImage src={avatar} emoji='🙂' className='bubble-avatar__img' />
                      ) : (
                        <Text className='bubble-avatar__text'>{name.slice(0, 1)}</Text>
                      )}
                    </View>

                    <View className={`bubble ${mine ? 'bubble--mine' : ''}`}>
                      {msg.type === 'image' ? (
                        <ItemImage
                          src={msg.content}
                          emoji='🖼️'
                          className='bubble__image'
                          onClick={() => void Taro.previewImage({ urls: [msg.content] })}
                        />
                      ) : (
                        <Text className='bubble__text'>{msg.content}</Text>
                      )}
                    </View>

                    {msg.status === 'failed' && (
                      <View className='bubble__retry' onClick={() => void retry(msg)}>
                        <Text className='bubble__retry-icon'>!</Text>
                      </View>
                    )}
                  </View>

                  {showTime && (
                    <View className={`bubble-time ${mine ? 'bubble-time--mine' : ''}`}>
                      <Text>{clockTime(msg.createdAt)}</Text>
                    </View>
                  )}
                </View>
              )
            })
          )}

          <View className='chat__safe-area' />
        </View>
      </ScrollView>

      <View className='chat__bar'>
        <View className='chat__icon-btn' onClick={() => void pickAndSendImage()}>
          <Camera size={22} color={THEME.accent} />
        </View>
        <Input
          className='chat__input'
          value={inputValue}
          confirmType='send'
          // 关闭系统自动顶起，由页面按键盘高度自己上推
          adjustPosition={false}
          placeholder='说点什么...'
          onInput={(e) => setInputValue(e.detail.value)}
          onConfirm={sendText}
        />
        <View
          className={`chat__send ${canSend ? 'chat__send--on' : ''}`}
          onClick={sendText}
        >
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}
