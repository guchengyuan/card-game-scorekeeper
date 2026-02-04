<template>
  <view class="container">
    <view class="logo-area">
      <text class="title">牌间小记</text>
      <text class="subtitle">让记账更简单</text>
    </view>
    
    <!-- 微信小程序专用登录界面 -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="login-form">
      <view class="form-item">
        <text class="label">头像</text>
        <button class="avatar-wrapper" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image class="avatar" :src="avatarUrl" mode="aspectFill"></image>
        </button>
      </view>
      
      <view class="form-item">
        <text class="label">昵称</text>
        <input type="nickname" class="nickname-input" placeholder="请输入昵称" v-model="nickName" @blur="onNicknameBlur" />
      </view>

      <button class="login-btn" @click="handleWechatLogin">
        进入游戏
      </button>
    </view>
    <!-- #endif -->
    
    <!-- 非微信环境 -->
    <!-- #ifndef MP-WEIXIN -->
    <button class="login-btn" @click="handleMockLogin">
      一键登录 (测试)
    </button>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore } from '../../stores/user';
import { onLoad } from '@dcloudio/uni-app';

const userStore = useUserStore();
const defaultAvatar = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
const avatarUrl = ref(defaultAvatar);
const nickName = ref('');

// #ifdef MP-WEIXIN
onLoad(() => {
  const pendingRoomCode = String(uni.getStorageSync('pending_room_code') || '').trim()
  if (userStore.userInfo?.id) {
    if (pendingRoomCode) {
      uni.removeStorageSync('pending_room_code')
      uni.reLaunch({ url: `/pages/room/room?roomCode=${pendingRoomCode}` })
      return
    }
    uni.reLaunch({ url: '/pages/home/home' })
    return
  }

  // 尝试从缓存恢复头像和昵称
  const cachedInfo = uni.getStorageSync('wechat_user_info');
  if (cachedInfo) {
    if (cachedInfo.avatarUrl) avatarUrl.value = cachedInfo.avatarUrl;
    if (cachedInfo.nickName) nickName.value = cachedInfo.nickName;
  }
});

const onChooseAvatar = (e: any) => {
  const { avatarUrl: tempUrl } = e.detail;
  avatarUrl.value = tempUrl;
};

const onNicknameBlur = (e: any) => {
  nickName.value = e.detail.value;
};

const normalizeAvatarUrl = async (input: string) => {
  const trimmed = String(input || '').trim()
  if (!trimmed) return defaultAvatar
  if (trimmed === defaultAvatar) return defaultAvatar
  if (trimmed.startsWith('data:image')) return trimmed
  if (trimmed.startsWith('https://')) return trimmed

  let filePath = trimmed
  if (trimmed.startsWith('http://tmp') || trimmed.startsWith('https://tmp')) {
    const downloadRes = await new Promise<UniApp.DownloadSuccessCallbackResult>((resolve, reject) => {
      uni.downloadFile({
        url: trimmed,
        success: resolve,
        fail: reject
      })
    })
    if (downloadRes.statusCode >= 200 && downloadRes.statusCode < 300 && downloadRes.tempFilePath) {
      filePath = downloadRes.tempFilePath
    } else {
      return defaultAvatar
    }
  }

  if (!filePath.startsWith('wxfile://') && !filePath.startsWith('http://tmp') && !filePath.startsWith('https://tmp') && !filePath.startsWith('/')) {
    return defaultAvatar
  }

  try {
    const fs = uni.getFileSystemManager()
    const base64 = await new Promise<string>((resolve, reject) => {
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res: any) => resolve(String(res.data || '')),
        fail: reject
      })
    })
    if (!base64) return defaultAvatar

    const lower = filePath.toLowerCase()
    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${base64}`
  } catch {
    return defaultAvatar
  }
}

const handleWechatLogin = async () => {
  if (!nickName.value) {
    uni.showToast({ title: '请输入昵称', icon: 'none' });
    return;
  }

  uni.showLoading({ title: '登录中...' });

  const finalAvatar = await normalizeAvatarUrl(avatarUrl.value)

  uni.login({
    provider: 'weixin',
    success: (loginRes) => {
      if (loginRes.code) {
        const userInfo = {
          nickName: nickName.value,
          avatarUrl: finalAvatar
        };
        
        // 登录成功后，保存到缓存
        uni.setStorageSync('wechat_user_info', userInfo);

        userStore.login(loginRes.code, userInfo).then((success) => {
          uni.hideLoading();
          if (success) {
            const pendingRoomCode = String(uni.getStorageSync('pending_room_code') || '').trim()
            if (pendingRoomCode) {
              uni.removeStorageSync('pending_room_code')
              uni.reLaunch({
                url: `/pages/room/room?roomCode=${pendingRoomCode}`
              })
              return
            }
            uni.reLaunch({
              url: '/pages/home/home'
            });
          }
        });
      }
    },
    fail: (err) => {
      uni.hideLoading();
      uni.showToast({ title: '登录失败', icon: 'none' });
    }
  });
};
// #endif

const handleMockLogin = () => {
  uni.showLoading({ title: '登录中...' });
  const mockUserInfo = {
    nickName: `玩家${Math.floor(Math.random() * 1000)}`,
    avatarUrl: defaultAvatar
  };
  const mockCode = 'mock_code_' + Date.now();

  userStore.login(mockCode, mockUserInfo).then((success) => {
    uni.hideLoading();
    if (success) {
      const pendingRoomCode = String(uni.getStorageSync('pending_room_code') || '').trim()
      if (pendingRoomCode) {
        uni.removeStorageSync('pending_room_code')
        uni.reLaunch({
          url: `/pages/room/room?roomCode=${pendingRoomCode}`
        })
        return
      }
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
  padding: 0 40rpx;
}

.logo-area {
  margin-bottom: 80rpx;
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

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.label {
  color: #a0a0a0;
  font-size: 28rpx;
  margin-bottom: 20rpx;
}

.avatar-wrapper {
  padding: 0;
  width: 160rpx !important;
  height: 160rpx !important;
  border-radius: 80rpx;
  background: transparent;
  border: none;
}

.avatar-wrapper::after {
  border: none;
}

.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 80rpx;
  border: 4rpx solid #7b68ee;
}

.nickname-input {
  width: 80%;
  height: 90rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 45rpx;
  text-align: center;
  color: #fff;
  font-size: 32rpx;
}

.login-btn {
  width: 80%;
  background: linear-gradient(90deg, #7b68ee, #00d4ff);
  color: #fff;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
  line-height: 90rpx;
}
</style>
