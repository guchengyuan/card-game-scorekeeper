<template>
  <view class="container">
    <view class="header">
      <text class="room-title">{{ roomInfo?.name || '加载中...' }}</text>
      <text class="room-code">房间号: {{ roomInfo?.code }}</text>
    </view>

    <view class="players-grid">
      <view v-for="player in orderedPlayers" :key="player.id" class="player-card" @click="handlePlayerClick(player)">
        <view v-if="isRoomOwnerPlayer(player)" class="owner-badge">房主</view>
        <image :src="player.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'" class="avatar" />
        <text class="nickname" :class="{ 'is-me': player.user_id === userStore.userInfo?.id }">
          {{ player.user_id === userStore.userInfo?.id ? '我' : player.nickname }}
        </text>
        <text class="balance" :class="{ positive: player.balance > 0, negative: player.balance < 0 }">
          <text class="balance-label">积分：</text>
          <text class="balance-value">{{ player.balance > 0 ? '+' : '' }}{{ player.balance }}</text>
        </text>
        <view class="status-dot" :class="{ online: player.is_online }"></view>
      </view>

      <button class="player-card invite-card" open-type="share">
        <text class="invite-plus">＋</text>
        <text class="invite-text">邀请好友</text>
      </button>
    </view>

    <view class="action-bar">
      <button class="action-btn test-btn" @click="addMockPlayers">添加假人</button>
      <button class="action-btn record-btn" @click="viewRecords">记录</button>
      <button class="action-btn end-btn" @click="endGame">结束</button>
    </view>

    <!-- 记账弹窗 -->
    <view v-if="showPaymentModal" class="modal-mask">
      <view class="modal-content">
        <text class="modal-title">记一笔</text>

        <view class="payee-header">
          <image
            :src="selectedPayee?.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'"
            class="avatar-large"
          />
          <text class="payee-score">积分：{{ selectedPayee?.balance > 0 ? '+' : '' }}{{ selectedPayee?.balance }}</text>
        </view>

        <view class="transfer-flow">
          <view class="player-node">
            <image
              :src="selectedPayer?.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'"
              class="avatar-small"
            />
            <text class="player-name">{{ selectedPayer?.user_id === userStore.userInfo?.id ? '我' : selectedPayer?.nickname }}</text>
          </view>

          <view class="transfer-arrow">
            <view class="arrow-head"></view>
          </view>

          <view class="player-node">
            <image
              :src="selectedPayee?.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'"
              class="avatar-small"
            />
            <text class="player-name">{{ selectedPayee?.nickname }}</text>
          </view>
        </view>

        <view class="amount-section">
          <text class="amount-label">积分：</text>
          <input type="text" v-model="amount" class="amount-input" placeholder="输入积分" @input="onAmountInput" />
        </view>

        <view class="modal-actions">
          <button class="btn cancel" @click="closePaymentModal">取消</button>
          <button class="btn confirm" @click="confirmPayment">确认</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onUnload, onShow, onHide, onShareAppMessage } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { request } from '../../utils/request'
import { socketService } from '../../utils/socket'

const userStore = useUserStore()
const roomId = ref('')
const roomInfo = ref<any>(null)
const players = ref<any[]>([])
const showPaymentModal = ref(false)
let syncTimer: any = null

// 记账表单
const selectedPayer = ref<any>(null)
const selectedPayee = ref<any>(null)
const amount = ref('')

const isOwner = computed(() => {
  return roomInfo.value?.owner_id === userStore.userInfo?.id
})

const isRoomOwnerPlayer = (player: any) => {
  return !!player?.user_id && !!roomInfo.value?.owner_id && player.user_id === roomInfo.value.owner_id
}

// 计算可选的收款人列表（排除付款人自己）
const normalizeId = (val: any) => String(val || '')

const setPlayers = (list: any[]) => {
  players.value = list || []
}

// 直接使用 players，不再进行客户端重排序，保证所有端看到的一致
const orderedPlayers = computed(() => {
  return players.value || []
})

const getPayeeOptions = computed(() => {
  if (!selectedPayer.value) return []
  return orderedPlayers.value.filter(p => p.id !== selectedPayer.value.id)
})

onLoad(async (options: any) => {
  if (options.id) {
    roomId.value = options.id
    userStore.setLastRoomId(roomId.value)
    await fetchRoomInfo()
    initSocket()
  }
})

// 分享给好友
onShareAppMessage(() => {
  return {
    title: `来来来，加入房间[${roomInfo.value?.code}]一起打牌！`,
    path: `/pages/home/home?action=join&roomCode=${roomInfo.value?.code}`,
    imageUrl: '/static/share-cover.png' // 可选：自定义分享图片
  }
})

onUnload(() => {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
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
  socketService.joinRoom(roomId.value, userStore.userInfo.id)

  socketService.socket?.on('connect', () => {
    stopSync()
  })
  socketService.socket?.on('disconnect', () => {
    startSync()
  })
  
  socketService.on('players-updated', (updatedPlayers: any[]) => {
    setPlayers(updatedPlayers)
  })

  socketService.on('transaction-updated', (data: any) => {
    setPlayers(data.players)
    uni.showToast({
      title: '新交易已记录',
      icon: 'success'
    })
  })

  socketService.on('room-updated', (updatedRoom: any) => {
    roomInfo.value = { ...(roomInfo.value || {}), ...(updatedRoom || {}) }
  })
}

const fetchRoomInfo = async () => {
  try {
    const res: any = await request({ url: `/room/${roomId.value}` })
    if (res.success) {
      roomInfo.value = res.data
      setPlayers(res.data.players)
    }
  } catch (error) {
    console.error(error)
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
  const raw = String(e?.detail?.value ?? '')
  const normalized = raw.replace(/[－−–—﹣⁻]/g, '-')
  const filtered = normalized.replace(/[^\d-]/g, '')
  const isNegative = filtered.startsWith('-')
  const digits = filtered.replace(/-/g, '')
  amount.value = (isNegative ? '-' : '') + digits
}

const onPayeeChange = (e: any) => {
  // 注意：这里需要从 getPayeeOptions 中取值
  selectedPayee.value = getPayeeOptions.value[e.detail.value]
}

const confirmPayment = async () => {
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
        setPlayers(res.data.players)
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
    success: (res) => {
      if (res.confirm) {
        uni.reLaunch({
          url: `/pages/settlement/settlement?roomId=${roomId.value}`
        })
      }
    }
  })
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

.modal-content {
  width: 80%;
  background: #2a2a40;
  border-radius: 20rpx;
  padding: 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  display: block;
  margin-bottom: 40rpx;
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
  margin-top: 40rpx;
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

/* 新版记账弹窗样式 */
.payee-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.avatar-large {
  width: 120rpx;
  height: 120rpx;
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
  margin-bottom: 40rpx;
  padding: 0 20rpx;
}

.player-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120rpx;
}

.avatar-small {
  width: 80rpx;
  height: 80rpx;
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
  margin-bottom: 40rpx;
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
