<template>
  <view class="container">
    <view class="logo-area">
      <text class="title">打牌记账</text>
      <text class="subtitle">让记账更简单</text>
    </view>
    
    <button class="login-btn" @click="handleLogin">
      微信一键登录
    </button>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();

const handleLogin = () => {
  uni.showLoading({ title: '登录中...' });
  
  // 模拟获取微信用户信息
  // 实际开发中应使用 uni.getUserProfile
  const mockUserInfo = {
    nickName: `玩家${Math.floor(Math.random() * 1000)}`,
    avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  };

  // 模拟获取 login code
  const mockCode = 'mock_code_' + Date.now();

  userStore.login(mockCode, mockUserInfo).then((success) => {
    uni.hideLoading();
    if (success) {
      uni.reLaunch({
        url: '/pages/home/home'
      });
    }
  });
};
</script>

<style>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #1a1a2e;
}

.logo-area {
  margin-bottom: 100rpx;
  text-align: center;
}

.title {
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
  display: block;
  margin-bottom: 20rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #a0a0a0;
}

.login-btn {
  width: 80%;
  background: linear-gradient(90deg, #7b68ee, #00d4ff);
  color: #fff;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>