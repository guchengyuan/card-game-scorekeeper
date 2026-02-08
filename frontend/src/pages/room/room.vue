<template>
  <view class="container">
    <view class="header">
      <text class="room-title">{{ roomInfo?.name || '加载中...' }}</text>
      <text class="room-code">房间号: {{ roomInfo?.code }}</text>
    </view>

    <view class="players-grid">
      <view v-for="player in orderedPlayers" :key="player.id" class="player-card" @click="handlePlayerClick(player)">
        <view v-if="isRoomOwnerPlayer(player)" class="owner-badge">房主</view>
        <image :src="player.displayAvatar || defaultAvatar" class="avatar" @error="onPlayerAvatarError(player)" />
        <text class="nickname" :class="{ 'is-me': player.user_id === userStore.userInfo?.id }">
          {{ player.user_id === userStore.userInfo?.id ? '我' : player.nickname }}
        </text>
        <text class="balance" :class="{ positive: player.balance > 0, negative: player.balance < 0 }">
          <text class="balance-label">积分：</text>
          <text class="balance-value">{{ player.balance > 0 ? '+' : '' }}{{ player.balance }}</text>
        </text>
        <view class="status-dot" :class="{ online: player.is_online }"></view>
      </view>

      <view class="player-card invite-card" @click="openInviteModal">
        <text class="invite-plus">＋</text>
        <text class="invite-text">邀请好友</text>
      </view>
    </view>

    <view class="action-bar">
      <button class="action-btn test-btn" @click="addMockPlayers">添加假人</button>
      <button class="action-btn record-btn" @click="viewRecords">记录</button>
      <button class="action-btn end-btn" @click="endGame">结束</button>
    </view>

    <!-- 邀请弹窗 -->
    <view v-if="showInviteModal" class="modal-mask">
      <view class="modal-content invite-modal-content">
        <view class="invite-header">
          <text class="invite-title">邀请好友</text>
          <view class="close-btn" @click="closeInviteModal">×</view>
        </view>
        
        <view class="qrcode-container">
          <image v-if="qrCodeImage" :src="qrCodeImage" class="qrcode-image" mode="aspectFit" />
          <view v-if="!qrCodeImage" class="loading-text">生成中...</view>
        </view>

        <button class="btn confirm share-btn" open-type="share">分享给好友</button>
      </view>
    </view>

    <view v-if="showServerHostModal" class="modal-mask">
      <view class="modal-content">
        <text class="modal-title">设置服务器IP</text>
        <view class="amount-section">
          <input
            type="text"
            v-model="serverHostInput"
            class="amount-input"
            placeholder="例如 192.168.2.2:3000 或 https://192.168.2.2:443"
            confirm-type="done"
          />
        </view>
        <view class="modal-actions">
          <button class="btn cancel" @click="closeServerHostModal">取消</button>
          <button class="btn confirm" @click="confirmServerHost">保存</button>
        </view>
      </view>
    </view>

    <!-- 记账弹窗 -->
    <transition name="payment-modal">
      <view v-if="showPaymentModal" class="modal-mask payment-modal-mask">
        <view class="modal-content payment-modal-content">
        <text class="modal-title">记一笔</text>

        <view class="payee-header">
          <image :src="selectedPayee?.displayAvatar || defaultAvatar" class="avatar-large" />
          <text class="payee-score">积分：{{ selectedPayee?.balance > 0 ? '+' : '' }}{{ selectedPayee?.balance }}</text>
        </view>

        <view class="transfer-flow">
          <view class="player-node">
            <image
              :src="selectedPayer?.displayAvatar || defaultAvatar"
              class="avatar-small"
            />
            <text class="player-name">{{ selectedPayer?.user_id === userStore.userInfo?.id ? '我' : selectedPayer?.nickname }}</text>
          </view>

          <view class="transfer-arrow">
            <view class="arrow-head"></view>
          </view>

          <view class="player-node">
            <image
              :src="selectedPayee?.displayAvatar || defaultAvatar"
              class="avatar-small"
            />
            <text class="player-name">{{ selectedPayee?.nickname }}</text>
          </view>
        </view>

        <view class="amount-section">
          <input
            type="digit"
            v-model="amount"
            class="amount-input"
            placeholder="输入积分"
            confirm-type="done"
            @input="onAmountInput"
            @confirm="confirmPayment"
          />
        </view>

        <view class="modal-actions">
          <button class="btn cancel" @click="closePaymentModal">取消</button>
          <button class="btn confirm" :disabled="isPaying" @click="confirmPayment">确认</button>
        </view>
        </view>
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onUnload, onShow, onHide } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { request } from '../../utils/request'
import { socketService } from '../../utils/socket'

const userStore = useUserStore()
const defaultAvatar = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const roomId = ref('')
const roomInfo = ref<any>(null)
const players = ref<any[]>([])
const showPaymentModal = ref(false)
const showInviteModal = ref(false)
const showServerHostModal = ref(false)
const serverHostInput = ref('')
const qrCodeImage = ref('')
let syncTimer: any = null
const exitRequested = ref(false)

// 记账表单
const selectedPayer = ref<any>(null)
const selectedPayee = ref<any>(null)
const amount = ref('')
const isPaying = ref(false)

const isOwner = computed(() => {
  return roomInfo.value?.owner_id === userStore.userInfo?.id
})

const isRoomOwnerPlayer = (player: any) => {
  return !!player?.user_id && !!roomInfo.value?.owner_id && player.user_id === roomInfo.value.owner_id
}

// 计算可选的收款人列表（排除付款人自己）
const normalizeId = (val: any) => String(val || '')

const avatarCache = new Map<string, string>()

const hashString = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

const getUserDataPath = () => {
  const uniEnv = (uni as any)?.env
  if (uniEnv?.USER_DATA_PATH) return String(uniEnv.USER_DATA_PATH)
  const wxAny = (globalThis as any)?.wx
  if (wxAny?.env?.USER_DATA_PATH) return String(wxAny.env.USER_DATA_PATH)
  return ''
}

const materializeDataImage = async (dataUrl: string) => {
  const cached = avatarCache.get(dataUrl)
  if (cached) return cached

  const match = /^data:(image\/png|image\/jpeg);base64,(.+)$/.exec(dataUrl)
  if (!match) return ''
  const mime = match[1]
  const base64 = match[2]
  const ext = mime === 'image/png' ? 'png' : 'jpg'

  const basePath = getUserDataPath()
  if (!basePath) return ''
  const filePath = `${basePath}/avatar_${hashString(base64.slice(0, 256) + String(base64.length))}.${ext}`

  try {
    const fs = uni.getFileSystemManager()
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: base64,
        encoding: 'base64',
        success: () => resolve(),
        fail: reject
      })
    })
    avatarCache.set(dataUrl, filePath)
    return filePath
  } catch {
    return ''
  }
}

const normalizeAvatarForDisplay = async (avatar: any) => {
  const val = String(avatar || '')
  if (!val) return ''
  if (val.startsWith('data:image')) {
    const filePath = await materializeDataImage(val)
    return filePath || ''
  }
  if (val.startsWith('wxfile://')) return ''
  if (val.startsWith('http://tmp') || val.startsWith('https://tmp')) return ''
  return val
}

const setPlayersAsync = async (list: any[]) => {
  const arr = Array.isArray(list) ? list : []
  const next = await Promise.all(
    arr.map(async (p: any) => {
      const displayAvatar = await normalizeAvatarForDisplay(p?.avatar)
      return { ...(p || {}), displayAvatar }
    })
  )
  players.value = next
}

const isPlayerOnline = (val: any) => {
  return val === true || val === 1 || val === 'true'
}

// 直接使用 players，不再进行客户端重排序，保证所有端看到的一致
const orderedPlayers = computed(() => {
  return (players.value || []).filter((p: any) => isPlayerOnline(p?.is_online))
})

const getPayeeOptions = computed(() => {
  if (!selectedPayer.value) return []
  return orderedPlayers.value.filter(p => p.id !== selectedPayer.value.id)
})

const decodeScene = (input: any) => {
  let str = String(input || '')
  for (let i = 0; i < 2; i++) {
    if (/%[0-9A-Fa-f]{2}/.test(str)) {
      try {
        str = decodeURIComponent(str)
      } catch {
        break
      }
    }
  }
  return str
}

const extractRoomCode = (options: any) => {
  const direct = String(options?.roomCode || '').trim()
  if (/^\d{6}$/.test(direct)) return direct

  const sceneRaw = options?.scene
  if (!sceneRaw) return ''
  const scene = decodeScene(sceneRaw).trim()
  if (/^\d{6}$/.test(scene)) return scene

  const match = scene.match(/(?:^|[?&])roomCode=(\d{6})(?:$|&)/)
  if (match) return match[1]

  const match2 = scene.match(/(?:^|&)roomCode=(\d{6})(?:$|&)/)
  if (match2) return match2[1]

  return ''
}

const joinRoomByCodeAndEnter = async (code: string) => {
  const roomCode = String(code || '').trim()
  if (!/^\d{6}$/.test(roomCode)) {
    uni.showToast({ title: '无效的房间码', icon: 'none' })
    return
  }

  if (!userStore.userInfo?.id) {
    uni.setStorageSync('pending_room_code', roomCode)
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  uni.showLoading({ title: '加入中...' })
  try {
    const joinRes: any = await request({
      url: '/room/join',
      method: 'POST',
      data: {
        userId: userStore.userInfo.id,
        roomCode
      }
    })

    if (joinRes.success) {
      roomId.value = joinRes.data.id
      userStore.setLastRoomId(roomId.value)
      await fetchRoomInfo()
      initSocket()
    }
  } catch (e: any) {
    console.error(e)
    if (e?.data?.message) {
      uni.showToast({ title: e.data.message, icon: 'none' })
    }
  } finally {
    uni.hideLoading()
  }
}

onLoad(async (options: any) => {
  const id = String(options?.id || '').trim()
  if (id) {
    roomId.value = id
    userStore.setLastRoomId(roomId.value)
    await fetchRoomInfo()
    initSocket()
    if (options.isNew === 'true') {
      openInviteModal()
    }
    return
  }

  const roomCode = extractRoomCode(options)
  if (roomCode) {
    await joinRoomByCodeAndEnter(roomCode)
    return
  }

  uni.showToast({ title: '缺少房间信息', icon: 'none' })
})

// 分享给好友逻辑已移至 Options API 脚本块中，避免 script setup 的 onShareAppMessage 运行时错误

onUnload(() => {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  if (exitRequested.value) return
  socketService.leaveRoom(roomId.value, userStore.userInfo.id)
})

onShow(() => {
  if (roomId.value) {
    fetchRoomInfo()
  }
  startSync()
})

onHide(() => {
  stopSync()
})

const startSync = () => {
  if (syncTimer) return
  syncTimer = setInterval(() => {
    const connected = !!socketService.socket?.connected
    if (!connected && roomId.value) {
      fetchRoomInfo()
    }
  }, 3000)
}

const stopSync = () => {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

const initSocket = () => {
  socketService.connect()
  socketService.joinRoom(roomId.value, userStore.userInfo.id, userStore.token)

  socketService.socket?.on('connect', () => {
    stopSync()
  })
  socketService.socket?.on('disconnect', () => {
    startSync()
  })
  socketService.socket?.on('connect_error', (err: any) => {
    const uri = (socketService.socket as any)?.io?.uri || ''
    if (!uri) return
    if (!/127\.0\.0\.1|localhost/i.test(uri)) return
    const stored = uni.getStorageSync('server_host')
    if (stored && String(stored).trim()) return
    const message = String(err?.message || err?.errMsg || '')
    if (!/timeout|connect|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(message)) return
    serverHostInput.value = ''
    showServerHostModal.value = true
  })
  
  socketService.on('players-updated', (updatedPlayers: any[]) => {
    void setPlayersAsync(updatedPlayers)
  })

  socketService.on('transaction-updated', (data: any) => {
    void setPlayersAsync(data.players)
    uni.showToast({
      title: '新交易已记录',
      icon: 'success'
    })
  })

  socketService.on('room-updated', (updatedRoom: any) => {
    roomInfo.value = { ...(roomInfo.value || {}), ...(updatedRoom || {}) }
    if (roomInfo.value?.code) {
        userStore.setCurrentRoomCode(roomInfo.value.code)
    }
  })

  socketService.on('room-dissolved', () => {
    userStore.clearLastRoomId()
    uni.showToast({ title: '房间已解散', icon: 'none' })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/home/home' })
    }, 300)
  })
}

const fetchRoomInfo = async () => {
  try {
    const res: any = await request({ url: `/room/${roomId.value}` })
    if (res.success) {
      roomInfo.value = res.data
      if (roomInfo.value?.code) {
          userStore.setCurrentRoomCode(roomInfo.value.code)
      }
      await setPlayersAsync(res.data.players)
    }
  } catch (error) {
    console.error(error)
  }
}

const closeServerHostModal = () => {
  showServerHostModal.value = false
}

const confirmServerHost = () => {
  let raw = String(serverHostInput.value || '').trim()
  if (!raw) {
    uni.showToast({ title: '请输入服务器地址', icon: 'none' })
    return
  }

  let protocol = 'http'
  if (/^https:\/\//i.test(raw)) {
    protocol = 'https'
    raw = raw.replace(/^https:\/\//i, '')
  } else if (/^http:\/\//i.test(raw)) {
    protocol = 'http'
    raw = raw.replace(/^http:\/\//i, '')
  }
  raw = raw.replace(/\/.*$/, '')

  const parts = raw.split(':')
  const host = String(parts[0] || '').trim()
  const portStr = String(parts[1] || '').trim()
  const port = portStr ? Number(portStr) : 3000

  if (!host) {
    uni.showToast({ title: '请输入服务器地址', icon: 'none' })
    return
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    uni.showToast({ title: '端口不合法', icon: 'none' })
    return
  }

  let isDevtools = false
  try {
    // #ifdef MP-WEIXIN
    // @ts-ignore
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()
    isDevtools = info?.platform === 'devtools'
    // #endif

    // #ifndef MP-WEIXIN
    const info = uni.getSystemInfoSync()
    isDevtools = info?.platform === 'devtools' || info?.model === 'devtools'
    // #endif
  } catch {}

  if (isDevtools) {
    uni.setStorageSync('server_host_devtools', host)
    uni.setStorageSync('server_protocol_devtools', protocol)
    uni.setStorageSync('server_port_devtools', port)
  } else {
    uni.setStorageSync('server_host', host)
    uni.setStorageSync('server_protocol', protocol)
    uni.setStorageSync('server_port', port)
  }
  showServerHostModal.value = false
  uni.showToast({ title: '已保存，请重进房间', icon: 'none' })
}

const openInviteModal = async () => {
  showInviteModal.value = true
  if (qrCodeImage.value) return
  if (!roomInfo.value?.code) {
    await fetchRoomInfo()
  }
  if (!roomInfo.value?.code) return
  try {
    const res: any = await request({
      url: '/room/qrcode',
      method: 'POST',
      data: { roomCode: roomInfo.value.code }
    })
    if (res.success) {
      qrCodeImage.value = res.data
    }
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '二维码生成失败', icon: 'none' })
  }
}

const closeInviteModal = () => {
  showInviteModal.value = false
}

const onPlayerAvatarError = (player: any) => {
  if (player && player.displayAvatar) {
    player.displayAvatar = ''
  }
}

// 点击玩家头像触发记账
const handlePlayerClick = (targetPlayer: any) => {
  // 1. 如果点击的是自己，不进行任何操作
  if (targetPlayer.user_id === userStore.userInfo?.id) {
    return
  }

  // 2. 点击的是其他人，则：自己是付款人，被点击的人是收款人
  const myself = players.value.find(p => p.user_id === userStore.userInfo?.id)
  
  if (!myself) {
    uni.showToast({ title: '无法获取用户信息', icon: 'none' })
    return
  }

  selectedPayer.value = myself
  selectedPayee.value = targetPlayer
  amount.value = ''
  showPaymentModal.value = true
}

const closePaymentModal = () => {
  showPaymentModal.value = false
  selectedPayer.value = null
  selectedPayee.value = null
  amount.value = ''
}

const onAmountInput = (e: any) => {
  let val = String(e?.detail?.value ?? '')
  // 只允许数字和小数点
  val = val.replace(/[^\d.]/g, '')
  // 保证只有一个小数点
  const parts = val.split('.')
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('')
  }
  // 延迟更新以确保视图同步
  setTimeout(() => {
    amount.value = val
  }, 0)
}

const onPayeeChange = (e: any) => {
  // 注意：这里需要从 getPayeeOptions 中取值
  selectedPayee.value = getPayeeOptions.value[e.detail.value]
}

const confirmPayment = async () => {
  if (isPaying.value) return
  if (!selectedPayer.value || !selectedPayee.value || !amount.value || amount.value === '-') {
    uni.showToast({ title: '请填写完整', icon: 'none' })
    return
  }

  const numAmount = Number(amount.value)
  if (!Number.isFinite(numAmount)) {
    uni.showToast({ title: '请输入正确金额', icon: 'none' })
    return
  }
  if (numAmount < 0) {
    uni.showToast({ title: '金额不能为负数', icon: 'none' })
    return
  }
  if (numAmount === 0) {
    uni.showToast({ title: '金额必须大于0', icon: 'none' })
    return
  }

  isPaying.value = true
  uni.showLoading({ title: '支付中...' })
  try {
    const res: any = await request({
      url: '/transaction/create',
      method: 'POST',
      data: {
        roomId: roomId.value,
        fromPlayerId: selectedPayer.value.id,
        toPlayerId: selectedPayee.value.id,
        amount: numAmount,
        description: '游戏记账'
      }
    })

    if (res.success) {
      // 1. 立即更新本地视图（确保操作者立刻看到变化）
      if (res.data.players) {
        await setPlayersAsync(res.data.players)
      }

      // 2. 通过 Socket 发送更新通知（通知其他人）
      socketService.socket?.emit('new-transaction', {
        roomId: roomId.value,
        transaction: res.data.transaction
      })
      
      closePaymentModal()
    }
  } catch (error) {
    console.error(error)
    uni.showToast({ title: '支付失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    isPaying.value = false
  }
}

const addMockPlayers = async () => {
  try {
    const res: any = await request({
      url: '/room/mock',
      method: 'POST',
      data: { roomId: roomId.value }
    })
    
    if (res.success) {
      uni.showToast({ title: '添加成功', icon: 'success' })
      // 1. 刷新自己的视图
      fetchRoomInfo()
    }
  } catch (error) {
    console.error(error)
  }
}

const viewRecords = () => {
  uni.navigateTo({
    url: `/pages/records/records?roomId=${roomId.value}`
  })
}

const endGame = () => {
  uni.showModal({
    title: '结束游戏',
    content: '确定要结束本局游戏并结算吗？',
    success: async (res) => {
      if (res.confirm) {
        exitRequested.value = true
        const ack = await socketService.emitWithAck('exit-room', { roomId: roomId.value, userId: userStore.userInfo.id })
        if (!ack) {
          socketService.leaveRoom(roomId.value, userStore.userInfo.id)
        }
        uni.reLaunch({
          url: `/pages/settlement/settlement?roomId=${roomId.value}`
        })
      }
    }
  })
}
</script>

<script lang="ts">
import { useUserStore } from '../../stores/user'

export default {
  onShareAppMessage() {
    const userStore = useUserStore()
    const code = userStore.currentRoomCode || ''
    return {
      title: `来来来，加入房间[${code}]一起打牌！`,
      path: `/pages/room/room?roomCode=${code}`,
      imageUrl: '/static/share-cover.jpg'
    }
  },
  onShareTimeline() {
    const userStore = useUserStore()
    const code = userStore.currentRoomCode || ''
    return {
      title: `来来来，加入房间[${code}]一起打牌！`,
      query: `roomCode=${code}`,
      imageUrl: '/static/share-cover.jpg'
    }
  }
}
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #1a1a2e;
  padding: 30rpx;
  color: #fff;
}

.header {
  text-align: center;
  margin-bottom: 50rpx;
}

.room-title {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
}

.room-code {
  font-size: 24rpx;
  color: #a0a0a0;
  margin-top: 10rpx;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30rpx;
  margin-bottom: 150rpx;
}

.player-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  backdrop-filter: blur(10px);
  box-sizing: border-box;
  height: 300rpx;
}

.invite-card {
  background: rgba(255, 255, 255, 0.06);
  border: 2rpx dashed rgba(255, 255, 255, 0.25);
  justify-content: center;
  line-height: normal;
  box-sizing: border-box;
  width: 100%;
  height: 300rpx;
  padding: 30rpx;
}

.invite-card::after {
  border: none;
}

.invite-plus {
  font-size: 64rpx;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  margin-bottom: 10rpx;
}

.invite-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

.owner-badge {
  position: absolute;
  top: 18rpx;
  left: 18rpx;
  font-size: 22rpx;
  font-weight: 700;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: #1a1a2e;
  background: #00d4ff;
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-bottom: 20rpx;
  border: 2rpx solid #7b68ee;
}

.nickname {
  font-size: 28rpx;
  margin-bottom: 10rpx;
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.nickname.is-me {
  color: #ff6b35; /* 醒目的橙色 */
  font-weight: bold;
}

.balance {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.balance-label {
  font-size: 28rpx;
  font-weight: 600;
}

.balance-value {
  display: inline-block;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.balance.positive {
  color: #00d4ff;
}

.balance.negative {
  color: #ff6b35;
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background-color: #666;
  position: absolute;
  top: 20rpx;
  right: 20rpx;
}



.status-dot.online {
  background-color: #00d4ff;
  box-shadow: 0 0 10rpx #00d4ff;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 30rpx;
  background: rgba(26, 26, 46, 0.9);
  display: flex;
  gap: 20rpx;
  backdrop-filter: blur(10px);
}

.action-btn {
  flex: 1;
  border-radius: 50rpx;
  font-size: 30rpx;
  font-weight: bold;
  border: none;
}

.pay-btn {
  background: linear-gradient(90deg, #7b68ee, #00d4ff);
  color: #fff;
}

.test-btn {
  background: #20b2aa;
  color: #fff;
}

.record-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.end-btn {
  background: #ff6b35;
  color: #fff;
}

/* Modal Styles */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.payment-modal-mask {
  align-items: flex-start;
  padding-top: 100rpx;
}

.modal-content {
  width: 80%;
  background: #2a2a40;
  border-radius: 20rpx;
  padding: 30rpx;
}

.payment-modal-enter-active,
.payment-modal-leave-active {
  transition: opacity 220ms ease;
}

.payment-modal-enter-from,
.payment-modal-leave-to {
  opacity: 0;
}

.payment-modal-enter-active .payment-modal-content,
.payment-modal-leave-active .payment-modal-content {
  transition: transform 220ms cubic-bezier(0.18, 0.89, 0.32, 1.2), opacity 220ms ease;
}

.payment-modal-enter-from .payment-modal-content,
.payment-modal-leave-to .payment-modal-content {
  transform: scale(0.92);
  opacity: 0;
}

.invite-modal-content {
  width: 600rpx;
  background: #fff;
  color: #333;
  border-radius: 24rpx;
  padding: 40rpx;
  position: relative;
}

.invite-header {
  text-align: center;
  margin-bottom: 40rpx;
  position: relative;
}

.invite-title {
  font-size: 36rpx;
  font-weight: bold;
}

.close-btn {
  position: absolute;
  right: -20rpx;
  top: -20rpx;
  font-size: 48rpx;
  color: #999;
  padding: 20rpx;
  line-height: 1;
}

.qrcode-container {
  width: 400rpx;
  height: 400rpx;
  margin: 0 auto 60rpx;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qrcode-image {
  width: 100%;
  height: 100%;
}

.loading-text {
  position: absolute;
  color: #999;
  font-size: 28rpx;
}

.share-btn {
  background: #e64340;
  color: #fff;
  border-radius: 999rpx;
  font-size: 32rpx;
  font-weight: bold;
  height: 88rpx;
  line-height: 88rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  display: block;
  margin-bottom: 20rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  font-size: 28rpx;
  color: #a0a0a0;
  margin-bottom: 10rpx;
  display: block;
}

.picker-value, .input {
  background: rgba(255, 255, 255, 0.1);
  height: 80rpx;
  border-radius: 10rpx;
  padding: 0 20rpx;
  line-height: 80rpx;
  color: #fff;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.btn {
  flex: 1;
  font-size: 30rpx;
}

.cancel {
  background: transparent;
  color: #a0a0a0;
}

.confirm {
  background: #7b68ee;
  color: #fff;
}

.confirm[disabled] {
  background: rgba(123, 104, 238, 0.6) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

/* 新版记账弹窗样式 */
.payee-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20rpx;
}

.avatar-large {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: 4rpx solid #7b68ee;
  margin-bottom: 16rpx;
}

.payee-score {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.transfer-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 20rpx;
}

.player-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120rpx;
}

.avatar-small {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  margin-bottom: 10rpx;
  border: 2rpx solid #666;
}

.player-name {
  font-size: 24rpx;
  color: #ccc;
  width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-arrow {
  flex: 1;
  height: 2rpx;
  background: linear-gradient(to right, rgba(123, 104, 238, 0.2), #7b68ee);
  margin: 0 30rpx;
  position: relative;
  margin-bottom: 30rpx; /* 稍微上移以对齐头像中心 */
}

.arrow-head {
  position: absolute;
  right: -2rpx;
  top: -10rpx;
  width: 0;
  height: 0;
  border-top: 12rpx solid transparent;
  border-bottom: 12rpx solid transparent;
  border-left: 16rpx solid #7b68ee;
}

.amount-section {
  margin-bottom: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.amount-label {
  font-size: 28rpx;
  color: #a0a0a0;
  flex: 0 0 auto;
}

.amount-input {
  background: rgba(255, 255, 255, 0.1);
  height: 80rpx;
  border-radius: 10rpx;
  padding: 0 20rpx;
  line-height: 80rpx;
  color: #fff;
  flex: 1;
  box-sizing: border-box;
}
</style>
