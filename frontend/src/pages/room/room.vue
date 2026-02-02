<template>
  <view class="container">
    <view class="header">
      <text class="room-title">{{ roomInfo?.name || '加载中...' }}</text>
      <text class="room-code">房间号: {{ roomInfo?.code }}</text>
    </view>

    <view class="players-grid">
      <view v-for="player in players" :key="player.id" class="player-card" @click="handlePlayerClick(player)">
        <image :src="player.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'" class="avatar" />
        <text class="nickname" :class="{ 'is-me': player.user_id === userStore.userInfo?.id }">
          {{ player.user_id === userStore.userInfo?.id ? '我' : player.nickname }}
        </text>
        <text class="balance" :class="{ positive: player.balance > 0, negative: player.balance < 0 }">
          {{ player.balance > 0 ? '+' : '' }}{{ player.balance }}
        </text>
        <view class="status-dot" :class="{ online: player.is_online }"></view>
      </view>
    </view>

    <view class="action-bar">
      <button class="action-btn share-btn" open-type="share">邀请好友</button>
      <button class="action-btn test-btn" @click="addMockPlayers">添加假人</button>
      <button class="action-btn record-btn" @click="viewRecords">记录</button>
      <button v-if="isOwner" class="action-btn end-btn" @click="endGame">结束</button>
    </view>

    <!-- 记账弹窗 -->
    <view v-if="showPaymentModal" class="modal-mask">
      <view class="modal-content">
        <text class="modal-title">记一笔</text>
        
        <view class="form-item">
          <text class="label">付款人</text>
          <view class="static-value">{{ selectedPayer?.user_id === userStore.userInfo?.id ? '我' : selectedPayer?.nickname }}</view>
        </view>

        <view class="form-item">
          <text class="label">收款人</text>
          <view class="static-value">{{ selectedPayee?.nickname }}</view>
        </view>

        <view class="form-item">
          <text class="label">金额</text>
          <input type="number" v-model="amount" class="input" placeholder="输入金额" />
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
import { onLoad, onUnload, onShareAppMessage } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { request } from '../../utils/request'
import { socketService } from '../../utils/socket'

const userStore = useUserStore()
const roomId = ref('')
const roomInfo = ref<any>(null)
const players = ref<any[]>([])
const showPaymentModal = ref(false)

// 记账表单
const selectedPayer = ref<any>(null)
const selectedPayee = ref<any>(null)
const amount = ref('')

const isOwner = computed(() => {
  return roomInfo.value?.owner_id === userStore.userInfo?.id
})

// 计算可选的收款人列表（排除付款人自己）
const getPayeeOptions = computed(() => {
  if (!selectedPayer.value) return []
  return players.value.filter(p => p.id !== selectedPayer.value.id)
})

onLoad(async (options: any) => {
  if (options.id) {
    roomId.value = options.id
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
  socketService.leaveRoom(roomId.value, userStore.userInfo.id)
})

const initSocket = () => {
  socketService.connect()
  socketService.joinRoom(roomId.value, userStore.userInfo.id)
  
  socketService.on('players-updated', (updatedPlayers: any[]) => {
    players.value = updatedPlayers
  })

  socketService.on('transaction-updated', (data: any) => {
    players.value = data.players
    uni.showToast({
      title: '新交易已记录',
      icon: 'success'
    })
  })
}

const fetchRoomInfo = async () => {
  try {
    const res: any = await request({ url: `/room/${roomId.value}` })
    if (res.success) {
      roomInfo.value = res.data
      players.value = res.data.players
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

const onPayeeChange = (e: any) => {
  // 注意：这里需要从 getPayeeOptions 中取值
  selectedPayee.value = getPayeeOptions.value[e.detail.value]
}

const confirmPayment = async () => {
  if (!selectedPayer.value || !selectedPayee.value || !amount.value) {
    uni.showToast({ title: '请填写完整', icon: 'none' })
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
        amount: Number(amount.value),
        description: '游戏记账'
      }
    })

    if (res.success) {
      // 通过 Socket 发送更新通知
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
      // 刷新房间信息
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
        uni.navigateTo({
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
}

.nickname.is-me {
  color: #ff6b35; /* 醒目的橙色 */
  font-weight: bold;
}

.balance {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
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
</style>