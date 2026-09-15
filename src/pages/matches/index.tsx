import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'

import { Heart } from '@/components/Icon'
import ItemImage from '@/components/ItemImage'
import { CATEGORY_MAP } from '@/constants'
import { api } from '@/services'
import type { MatchView } from '@/types'
import { fromNow } from '@/utils'

import './index.scss'

export default function Matches() {
  const [list, setList] = useState<MatchView[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    void (async () => {
      setLoading(true)
      try {
        setList(await api.getMatches())
      } finally {
        setLoading(false)
      }
    })()
  })

  const openChat = (matchId: string) => {
    void Taro.navigateTo({ url: `/pages/chat/index?matchId=${matchId}` })
  }

  if (!loading && !list.length) {
    return (
      <View className='page'>
        <View className='empty'>
          <Heart size={32} color='#C8C8CE' />
          <Text className='empty-title empty-title--spaced'>还没有匹配</Text>
          <Text className='empty-desc'>
            去首页滑一滑，当你和对方互相「想要」时，就会出现在这里
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className='page'>
      <ScrollView className='matches' scrollY>
        {/* scroll-view 在 webview 模式下不支持 padding，只能靠内层容器 */}
        <View className='matches__inner'>
          <View className='matches__hint'>
            <Text>互相想要才会匹配成功，共 {list.length} 个</Text>
          </View>

          {list.map((match) => {
            const mine = CATEGORY_MAP[match.myItem.category]?.emoji ?? '📦'
            const peer = CATEGORY_MAP[match.peerItem.category]?.emoji ?? '📦'
            return (
              <View
                key={match._id}
                className='match-row'
                onClick={() => openChat(match._id)}
              >
                <View className='match-row__head'>
                  <View className='match-row__avatar'>
                    <Text>{match.peer.nickname.slice(0, 1)}</Text>
                  </View>
                  <View className='match-row__who'>
                    <Text className='match-row__name'>{match.peer.nickname}</Text>
                    <Text className='match-row__time'>匹配于 {fromNow(match.createdAt)}</Text>
                  </View>
                  <View className='match-row__cta'>
                    <Text>去聊天 ›</Text>
                  </View>
                </View>

                <View className='match-row__items'>
                  <View className='match-row__item'>
                    <View className='match-row__thumb'>
                      <ItemImage src={match.myItem.images[0]} emoji={mine} />
                    </View>
                    <Text className='match-row__item-title ellipsis'>{match.myItem.title}</Text>
                  </View>

                  <View className='match-row__swap'>
                    <Text>⇄</Text>
                  </View>

                  <View className='match-row__item'>
                    <View className='match-row__thumb'>
                      <ItemImage src={match.peerItem.images[0]} emoji={peer} />
                    </View>
                    <Text className='match-row__item-title ellipsis'>{match.peerItem.title}</Text>
                  </View>
                </View>

                <View className='match-row__last'>
                  <Text className='ellipsis'>
                    {match.lastMessage
                      ? `${match.lastMessage.fromUserId === match.peer._id ? '' : '我：'}${
                          match.lastMessage.type === 'image' ? '[图片]' : match.lastMessage.content
                        }`
                      : '打个招呼，聊聊怎么换吧'}
                  </Text>
                </View>
              </View>
            )
          })}

          <View className='matches__safe-area' />
        </View>
      </ScrollView>
    </View>
  )
}
