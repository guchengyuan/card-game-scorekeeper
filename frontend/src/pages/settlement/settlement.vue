<template>
  <div class="container">
    <div class="header">
      <text class="title">最终结算</text>
      <text class="subtitle">牌局结束，请按以下方案结清</text>
    </div>

    <scroll-view scroll-y class="list-container">
      <div v-if="settlements.length === 0" class="empty-state">
        <text class="empty-text">无需结算，大家都扯平了！</text>
      </div>
      
      <div v-else class="settlement-list">
        <div v-for="(item, index) in settlements" :key="index" class="settlement-card">
          <div class="card-body">
            <div class="player-info payer">
              <image class="avatar" :src="item.fromPlayerAvatar || '/static/default-avatar.png'" mode="aspectFill"></image>
              <text class="nickname">{{ item.fromPlayerName }}</text>
              <text class="role-tag pay">支付</text>
            </div>
            
            <div class="transfer-info">
              <div class="line"></div>
              <text class="amount">{{ item.amount }} 积分</text>
              <text class="arrow">>></text>
            </div>
            
            <div class="player-info payee">
              <image class="avatar" :src="item.toPlayerAvatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'" mode="aspectFill"></image>
              <text class="nickname">{{ item.toPlayerName }}</text>
              <text class="role-tag receive">收取</text>
            </div>
          </div>
        </div>
      </div>
    </scroll-view>
    
    <div class="footer">
      <button class="btn-home" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import request from '../../utils/request';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const settlements = ref<any[]>([]);
const roomId = ref('');

onLoad((options) => {
  if (options && options.roomId) {
    roomId.value = options.roomId;
    fetchSettlement();
  } else if (userStore.userInfo?.roomId) {
    roomId.value = userStore.userInfo.roomId;
    fetchSettlement();
  }
});

const fetchSettlement = async () => {
  if (!roomId.value) return;
  
  try {
    const res = await request({
      url: `/transactions/settlement/${roomId.value}`,
      method: 'GET'
    });
    
    if (res.success) {
      settlements.value = res.data;
    }
  } catch (error) {
    console.error('Fetch settlement failed:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

const goHome = () => {
  // Clear room info from store if needed, or just navigate back
  // For now, just navigate to home
  uni.reLaunch({
    url: '/pages/home/home'
  });
};
</script>

<style>
.container {
  padding: 20px;
  background-color: #1a1a2e;
  height: 100vh;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.header {
  margin-top: 20px;
  margin-bottom: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #a0a0a0;
}

.list-container {
  flex: 1;
  height: 0;
  margin-bottom: 20px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.empty-text {
  color: #a0a0a0;
  font-size: 16px;
}

.settlement-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px 16px;
  margin-bottom: 16px;
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
  width: 90px;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-bottom: 8px;
  background-color: #eee;
  border: 2px solid #7b68ee;
  box-shadow: 0 0 10px rgba(123, 104, 238, 0.3);
}

.nickname {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
  margin-bottom: 4px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.role-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #fff;
}

.role-tag.pay {
  background-color: #ff5a5f;
}

.role-tag.receive {
  background-color: #00b894;
}

.transfer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 0 10px;
}

.amount {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin: 4px 0;
}

.arrow {
  font-size: 12px;
  color: #a0a0a0;
  letter-spacing: 2px;
}

.footer {
  padding-bottom: 20px;
}

.btn-home {
  background: linear-gradient(90deg, #7b68ee, #00d4ff);
  color: #fff;
  border-radius: 25px;
  font-size: 16px;
  height: 50px;
  line-height: 50px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  border: none;
}

.btn-home:active {
  transform: scale(0.98);
}
</style>