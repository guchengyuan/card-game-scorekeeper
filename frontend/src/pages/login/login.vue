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

const handleWechatLogin = () => {
  if (!nickName.value) {
    uni.showToast({ title: '请输入昵称', icon: 'none' });
    return;
  }

  uni.showLoading({ title: '登录中...' });

  // 优化头像处理逻辑
  let finalAvatar = avatarUrl.value;
  
  // 1. 如果是默认头像，直接使用
  if (finalAvatar === defaultAvatar) {
    // do nothing
  }
  // 2. 如果是 http 网络图片（可能是之前缓存的），直接使用
  else if (finalAvatar.startsWith('http')) {
    // do nothing
  }
  // 3. 如果是 base64，直接使用
  else if (finalAvatar.startsWith('data:image')) {
    // do nothing
  }
  // 4. 如果是临时文件路径（wxfile:// 或 http://tmp/），尝试读取
  else {
    try {
      const fs = uni.getFileSystemManager();
      // 读取文件并转为 Base64
      const base64 = fs.readFileSync(finalAvatar, 'base64');
      finalAvatar = `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.error('Avatar read failed, using temporary path or fallback', e);
      // 如果读取失败（例如文件太大或权限问题），降级处理：
      // 在开发工具中，有时直接传临时路径后端无法访问，但在真机上临时路径也只有本地能看。
      // 这里的最佳实践是上传到服务器，但为了简化，如果转 Base64 失败，
      // 我们暂且使用原路径（虽然可能导致其他用户看不到头像），或者回退到默认头像。
      // finalAvatar = defaultAvatar; // 选项 A：回退默认
      // 选项 B：尽力而为，保留原路径（本地能看）
    }
  }

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
