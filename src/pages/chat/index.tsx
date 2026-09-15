import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import { Photograph } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP, THEME } from '@/constants'
import { api } from '@/services'
import { useUserStore } from '@/store/userStore'
import type { ChatMessage, MatchView } from '@/types'
import { clockTime } from '@/utils'

import './index.scss'

export default function Chat() {
  const matchId = Taro.getCurrentInstance().router?.params?.matchId || ''
  const me = useUserStore((s) => s.user)

  const [match, setMatch] = useState<MatchView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [scrollIntoView, setScrollIntoView] = useState('')

  useEffect(() => {
    if (!matchId) return
    let alive = true

    void (async () => {
      const [detail, history] = await Promise.all([
        api.getMatch(matchId),
        api.getChatHistory(matchId),
      ])
      if (!alive) return
      setMatch(detail)
      setMessages(history)
      if (detail) {
        void Taro.setNavigationBarTitle({ title: detail.peer.nickname })
      }
    })()

    const off = api.subscribe(matchId, (msg) => {
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]))
    })

    return () => {
      alive = false
      off()
    }
  }, [matchId])

  // 新消息进来后把视图顶到底部
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last) setScrollIntoView(`msg-${last._id}`)
  }, [messages])

  const append = (msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]))
  }

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      append(await api.sendMessage(matchId, 'text', text))
    } catch {
      void Taro.showToast({ title: '发送失败', icon: 'none' })
      setDraft(text)
    }
  }

  const sendImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const path = res.tempFilePaths[0]
      if (!path) return
      const url = await api.uploadImage(path)
      append(await api.sendMessage(matchId, 'image', url))
    } catch {
      // 取消选择
    }
  }

  const myEmoji = match ? (CATEGORY_MAP[match.myItem.category]?.emoji ?? '📦') : '📦'
  const peerEmoji = match ? (CATEGORY_MAP[match.peerItem.category]?.emoji ?? '📦') : '📦'

  return (
    <View className='page chat'>
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
              <ItemImage src={match.peerItem.images[0]} emoji={peerEmoji} />
            </View>
            <Text className='chat__banner-label ellipsis'>
              {match.peer.nickname} · {match.peerItem.title}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        className='chat__list'
        scrollY
        scrollWithAnimation
        scrollIntoView={scrollIntoView}
      >
        <View className='chat__tip'>
          <Text>匹配成功，聊聊怎么换吧 · 建议线下公共场所当面交换</Text>
        </View>

        {messages.map((msg) => {
          const mine = msg.fromUserId === me?._id
          return (
            <View
              key={msg._id}
              id={`msg-${msg._id}`}
              className={`bubble-row ${mine ? 'bubble-row--mine' : ''}`}
            >
              {!mine && (
                <View className='bubble-avatar'>
                  <Text>{match?.peer.nickname.slice(0, 1) ?? '?'}</Text>
                </View>
              )}
              <View className={`bubble ${mine ? 'bubble--mine' : ''}`}>
                {msg.type === 'image' ? (
                  <Image
                    className='bubble__image'
                    src={msg.content}
                    mode='widthFix'
                    onClick={() => void Taro.previewImage({ urls: [msg.content] })}
                  />
                ) : (
                  <Text className='bubble__text'>{msg.content}</Text>
                )}
                <Text className='bubble__time'>{clockTime(msg.createdAt)}</Text>
              </View>
            </View>
          )
        })}

        <View className='chat__safe-area' />
      </ScrollView>

      <View className='chat__bar'>
        <View className='chat__icon-btn' onClick={() => void sendImage()}>
          <Photograph size={24} color={THEME.primary} />
        </View>
        <Input
          className='chat__input'
          value={draft}
          confirmType='send'
          placeholder='说点什么…'
          onInput={(e) => setDraft(e.detail.value)}
          onConfirm={() => void send()}
        />
        <View
          className={`chat__send ${draft.trim() ? 'chat__send--on' : ''}`}
          onClick={() => void send()}
        >
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}
