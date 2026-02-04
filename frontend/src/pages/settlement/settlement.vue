<template>
  <view class="container">
    <view class="header">
      <text class="title">最终结算</text>
      <text v-if="settlements.length > 0" class="subtitle">牌局结束，请按以下方案结清</text>
    </view>

    <scroll-view scroll-y class="list-container">
      <view v-if="settlements.length === 0" class="empty-state">
        <text class="empty-text">无需结算，大家都扯平了！</text>
      </view>
      
      <view v-else class="settlement-list">
        <view v-for="(item, index) in settlements" :key="index" class="settlement-card">
          <view class="card-body">
            <view class="player-info payer">
              <image class="avatar" :src="item.fromPlayerAvatar || '/static/default-avatar.png'" mode="aspectFill"></image>
              <text class="nickname">{{ item.fromPlayerName }}</text>
              <text class="role-tag pay">支付</text>
            </view>
            
            <view class="transfer-info">
              <text class="amount">{{ item.amount }} 积分</text>
              <view class="transfer-arrow">
                <view class="arrow-head"></view>
              </view>
            </view>
            
            <view class="player-info payee">
              <image class="avatar" :src="item.toPlayerAvatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'" mode="aspectFill"></image>
              <text class="nickname">{{ item.toPlayerName }}</text>
              <text class="role-tag receive">收取</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <view class="footer">
      <button class="btn-home" @click="goHome">返回首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { request } from '../../utils/request';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const settlements = ref<any[]>([]);
const roomId = ref('');

const exitRoom = () => {
  userStore.clearLastRoomId()
}

onLoad((options) => {
  if (!userStore.userInfo?.id) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (options && options.roomId) {
    roomId.value = options.roomId;
    fetchSettlement();
  } else if (userStore.lastRoomId) {
    roomId.value = userStore.lastRoomId;
    fetchSettlement();
  }
});

onUnload(() => {
  exitRoom()
})

const fetchSettlement = async () => {
  if (!roomId.value) return;
  
  try {
    const res = await request({
      url: `/transaction/settlement/${roomId.value}`,
      method: 'GET'
    });
    
    if (res.success) {
      settlements.value = res.data;
    }
  } catch (error) {
    console.error('获取结算结果失败:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

const goHome = () => {
  exitRoom()
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

.transfer-arrow {
  width: 120px;
  height: 2px;
  background: linear-gradient(to right, rgba(123, 104, 238, 0.2), #7b68ee);
  position: relative;
  margin-top: 10px;
}

.arrow-head {
  position: absolute;
  right: -2px;
  top: -7px;
  width: 0;
  height: 0;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-left: 10px solid #7b68ee;
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
