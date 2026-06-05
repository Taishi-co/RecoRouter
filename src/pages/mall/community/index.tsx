import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Heart, MessageCircle, Send, UsersRound } from 'lucide-react-taro'
import {
  createMallCommunityPostSafe,
  interactMallCommunityPostSafe,
  listMallCommunityPosts,
  type MallCommunityPost,
} from '@/services/mall'
import { MallPage, MallPrimaryButton } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallCommunityPage() {
  const [posts, setPosts] = useState<MallCommunityPost[]>([])
  const [publishing, setPublishing] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadPosts()
  })

  const loadPosts = async () => {
    try {
      const data = await listMallCommunityPosts({ limit: 20 })
      setPosts(data.length ? data : fallbackPosts())
    } catch {
      setPosts(fallbackPosts())
    }
  }

  const publishPost = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/community/index')
      return
    }
    setPublishing(true)
    const post = await createMallCommunityPostSafe({
      userId,
      title: '今晚 18:30 到点取货',
      summary: '鲜奶和草莓都已到站，团员可按预约时间到点取货。',
      content: '鲜奶和草莓都已到站，团员可按预约时间到点取货。',
      tags: ['自提提醒'],
    })
    setPosts((current) => [post, ...current])
    setPublishing(false)
    Taro.showToast({ title: '动态已发布', icon: 'success' })
  }

  const interact = async (post: MallCommunityPost, action: 'like' | 'join' | 'follow') => {
    const nextPost = await interactMallCommunityPostSafe(post, { userId: userId || 'guest', action })
    setPosts((current) => current.map((item) => (item.id === post.id ? nextPost : item)))
  }

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">叁友甄选 / 邻里圈</Text>
      <Text className="mall-page-title">邻里圈</Text>
      <Text className="mall-page-subtitle">同一个自提点的团购提醒、晒单和拼团邀请。</Text>

      <View className="mall-community-station">
        <View>
          <Text className="mall-list-title">绿荫花园团购点</Text>
          <Text className="mall-product-subtitle">127 位邻居关注 · 今日 6 个拼团</Text>
        </View>
        <Text className="mall-status-pill">已关注</Text>
      </View>

      {posts.map((post) => (
        <View key={post.id} className="mall-community-card">
          <View className="mall-list-row" style={{ marginTop: 0 }}>
            <View>
              <Text className="mall-link-title">{post.authorName || '团长王姐'}</Text>
              <Text className="mall-link-subtitle">{post.pickupPointId || '绿荫花园团购点'} · 刚刚</Text>
            </View>
            <Text className="mall-status-pill mall-status-pill-warm">{post.tags?.[0] || '邻里动态'}</Text>
          </View>
          <Text className="mall-community-title">{post.title}</Text>
          <Text className="mall-community-copy">{post.summary || post.content}</Text>
          <View className="mall-community-actions">
            <Action icon={<Heart size={15} color="#FF9238" />} label={`${post.likeCount || 0}`} onClick={() => interact(post, 'like')} />
            <Action icon={<UsersRound size={15} color="#63BF54" />} label={post.joined ? '已参团' : `${post.joinCount || 0} 参团`} onClick={() => interact(post, 'join')} />
            <Action icon={<MessageCircle size={15} color="#1F2D1F" />} label="关注" onClick={() => interact(post, 'follow')} />
          </View>
        </View>
      ))}

      <View style={{ marginTop: 16 }}>
        <MallPrimaryButton onClick={publishPost}>
          <Send size={17} color="#FFFFFF" />
          <Text>{publishing ? '发布中' : '发布动态'}</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function Action({ icon, label, onClick }: { icon: JSX.Element; label: string; onClick: () => void }) {
  return (
    <View className="mall-small-button" onClick={onClick}>
      {icon}
      <Text>{label}</Text>
    </View>
  )
}

function fallbackPosts(): MallCommunityPost[] {
  return [
    {
      id: 'post-local-1',
      title: '春见柑橘已到站，坏果可直接售后',
      content: '今天到站的春见柑橘甜度不错，18:00 后可以到 3 号楼团长点自提。',
      summary: '今天到站的春见柑橘甜度不错，18:00 后可以到 3 号楼团长点自提。',
      authorName: '团长王姐',
      likeCount: 18,
      joinCount: 6,
      tags: ['到货提醒'],
      status: 'published',
    },
    {
      id: 'post-local-2',
      title: '鲜奶周卡还差 3 人成团',
      content: '低温鲜奶明早到点，适合早餐家庭一起拼。',
      summary: '低温鲜奶明早到点，适合早餐家庭一起拼。',
      authorName: '邻居小林',
      likeCount: 9,
      joinCount: 3,
      tags: ['拼团邀请'],
      status: 'published',
    },
  ]
}
