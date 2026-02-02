<template>
  <div class="container">
    <div class="header">
      <text class="title">交易记录</text>
    </div>

    <scroll-view scroll-y class="list-container">
      <div v-if="transactions.length === 0" class="empty-state">
        <text class="empty-text">暂无交易记录</text>
      </div>
      
      <div v-else class="transaction-list">
        <div v-for="item in transactions" :key="item.id" class="transaction-card">
          <div class="card-header">
            <text class="time">{{ formatDate(item.created_at) }}</text>
          </div>
          
          <div class="card-body">
            <div class="player-info">
              <image class="avatar" :src="item.from_player_avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
              <text class="nickname">{{ item.from_player_name }}</text>
            </div>
            
            <div class="transfer-info">
              <text class="arrow">-></text>
              <text class="amount">{{ item.amount }} 积分</text>
            </div>
            
            <div class="player-info">
              <image class="avatar" :src="item.to_player_avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'" mode="aspectFill"></image>
              <text class="nickname">{{ item.to_player_name }}</text>
            </div>
          </div>
          
          <div class="card-footer" v-if="item.description">
            <text class="description">备注: {{ item.description }}</text>
          </div>
        </div>
      </div>
    </scroll-view>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
  } else if (userStore.userInfo?.roomId) {
    roomId.value = userStore.userInfo.roomId;
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
      url: `/transactions/room/${roomId.value}`,
      method: 'GET'
    });
    
    if (res.success) {
      transactions.value = res.data;
    }
  } catch (error) {
    console.error('Fetch transactions failed:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    uni.stopPullDownRefresh();
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style>
.container {
  padding: 20px;
  background-color: #1a1a2e;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.header {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.title {
  font-size: 20px;
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
  height: 200px;
}

.empty-text {
  color: #a0a0a0;
  font-size: 14px;
}

.transaction-list {
  padding-bottom: 20px;
}

.transaction-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.card-header {
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.time {
  font-size: 12px;
  color: #a0a0a0;
}

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  margin-bottom: 4px;
  background-color: #eee;
  border: 1px solid #7b68ee;
}

.nickname {
  font-size: 12px;
  color: #fff;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.transfer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.arrow {
  font-size: 16px;
  color: #a0a0a0;
  margin-bottom: 4px;
}

.amount {
  font-size: 18px;
  font-weight: bold;
  color: #ff5a5f;
}

.card-footer {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 8px;
}

.description {
  font-size: 12px;
  color: #a0a0a0;
}
</style>