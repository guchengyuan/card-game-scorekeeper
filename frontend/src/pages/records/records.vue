<template>
  <view class="container">
    <view class="header">
      <text class="title">交易记录</text>
    </view>

    <scroll-view scroll-y class="list-container">
      <view v-if="transactions.length === 0" class="empty-state">
        <text class="empty-text">暂无交易记录</text>
      </view>
      
      <view v-else class="transaction-list">
        <view v-for="group in groupedTransactions" :key="group.key" class="time-group">
          <view class="time-sep">
            <text class="time-sep-text">{{ group.label }}</text>
          </view>
          <view v-for="item in group.items" :key="item.id" class="transaction-row">
            <view class="tx-line">
              <view class="tx-player">
                <image
                  class="tx-avatar payer"
                  :src="item.from_player_avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'"
                  mode="aspectFill"
                />
                <text class="tx-name payer">{{ item.from_player_name || '未知' }}</text>
              </view>

              <text class="tx-muted tx-word">向</text>

              <view class="tx-player">
                <image
                  class="tx-avatar payee"
                  :src="item.to_player_avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'"
                  mode="aspectFill"
                />
                <text class="tx-name payee">{{ item.to_player_name || '未知' }}</text>
              </view>

              <text class="tx-muted tx-word">支付</text>
              <text class="tx-amount">{{ item.amount }}</text>
              <text class="tx-muted">积分</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { request } from '../../utils/request';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const transactions = ref<any[]>([]);
const roomId = ref('');

onLoad((options) => {
  if (options && options.roomId) {
    roomId.value = options.roomId;
    fetchTransactions();
  } else if (userStore.lastRoomId) {
    roomId.value = userStore.lastRoomId;
    fetchTransactions();
  }
});

onPullDownRefresh(() => {
  fetchTransactions();
});

const fetchTransactions = async () => {
  if (!roomId.value) return;
  
  try {
    const res = await request({
      url: `/transaction/room/${roomId.value}`,
      method: 'GET'
    });
    
    if (res.success) {
      transactions.value = res.data;
    }
  } catch (error) {
    console.error('获取交易记录失败:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    uni.stopPullDownRefresh();
  }
};

const formatChatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const options: Intl.DateTimeFormatOptions = isSameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }

  return date.toLocaleString('zh-CN', options)
}

const groupedTransactions = computed(() => {
  const thresholdMinutes = 5
  const thresholdMs = thresholdMinutes * 60 * 1000

  const list = [...(transactions.value || [])]
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b?.created_at).getTime() - new Date(a?.created_at).getTime())

  const groups: Array<{ key: string; label: string; items: any[] }> = []
  let current: { key: string; label: string; items: any[] } | null = null
  let lastTime: number | null = null

  for (const item of list) {
    const createdAt = String(item?.created_at || '')
    const time = createdAt ? new Date(createdAt).getTime() : NaN
    const hasTime = Number.isFinite(time)

    const shouldStartNew =
      !current ||
      !hasTime ||
      lastTime === null ||
      (Number.isFinite(lastTime) && Number.isFinite(time) && Math.abs(lastTime - time) >= thresholdMs)

    if (shouldStartNew) {
      const label = hasTime ? formatChatTime(createdAt) : ''
      const key = `${createdAt || 'no_time'}_${item?.id || Math.random()}`
      current = { key, label, items: [] }
      groups.push(current)
    }

    current.items.push(item)
    if (hasTime) lastTime = time
  }

  return groups
})
</script>

<style>
.container {
  padding: 30rpx;
  background-color: #1a1a2e;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.header {
  margin-bottom: 30rpx;
  display: flex;
  justify-content: center;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.list-container {
  flex: 1;
  height: 0; /* Important for scroll-view in flex layout */
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
}

.empty-text {
  color: #a0a0a0;
  font-size: 28rpx;
}

.transaction-list {
  padding-bottom: 30rpx;
}

.time-group {
  margin-bottom: 24rpx;
}

.time-sep {
  display: flex;
  justify-content: center;
  margin-bottom: 16rpx;
}

.time-sep-text {
  font-size: 24rpx;
  color: #c9c9c9;
  background: rgba(255, 255, 255, 0.12);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.transaction-row {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16rpx;
  padding: 26rpx 24rpx;
  margin-bottom: 20rpx;
}

.tx-line {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
}

.tx-muted {
  color: #a0a0a0;
  font-size: 28rpx;
  line-height: 34rpx;
}

.tx-word {
  line-height: 34rpx;
}

.tx-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120rpx;
}

.tx-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin-bottom: 10rpx;
}

.tx-avatar.payer {
  border: 2rpx solid #00d4ff;
}

.tx-avatar.payee {
  border: 2rpx solid #7b68ee;
}

.tx-name {
  font-weight: 700;
  font-size: 26rpx;
  line-height: 34rpx;
  width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-name.payer {
  color: #00d4ff;
}

.tx-name.payee {
  color: #7b68ee;
}

.tx-amount {
  font-weight: 800;
  color: #ff6b35;
  font-size: 32rpx;
  line-height: 34rpx;
}
</style>
