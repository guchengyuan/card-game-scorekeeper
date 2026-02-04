<template>
  <view class="container">
    <view class="header">
      <text class="greeting">你好，{{ userStore.userInfo?.nickname || '玩家' }}</text>
    </view>
    
    <view class="action-area">
      <view class="card create-room" @click="handlePrimaryCardClick">
        <text class="card-title">{{ userStore.lastRoomId ? '我的房间' : '创建房间' }}</text>
        <text class="card-desc">{{ userStore.lastRoomId ? myRoomDesc : '作为房主发起游戏' }}</text>
      </view>
      
      <view class="card join-room" @click="handleJoinRoom">
        <text class="card-title">扫码加入</text>
        <text class="card-desc">扫描二维码加入游戏</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '../../stores/user';
import { request } from '../../utils/request';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

const userStore = useUserStore();
const myRoomDesc = ref('点击返回房间');

onLoad((options: any) => {
  if (!userStore.userInfo?.id) {
    const roomCode = String(options?.roomCode || '').trim()
    if (/^\d{6}$/.test(roomCode)) {
      uni.setStorageSync('pending_room_code', roomCode)
    } else if (options.action === 'join' && options.roomCode) {
      uni.setStorageSync('pending_room_code', String(options.roomCode).trim())
    }
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }

  // 如果是扫码进入，自动执行加入房间逻辑
  if (options.action === 'join' && options.roomCode) {
    joinRoomByCode(options.roomCode);
  }
});

onShow(() => {
  if (!userStore.userInfo?.id) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  refreshMyRoomInfo();
});

const refreshMyRoomInfo = async () => {
  if (!userStore.lastRoomId) {
    myRoomDesc.value = '点击返回房间';
    return;
  }
  try {
    const res: any = await request({
      url: `/room/${userStore.lastRoomId}`,
      method: 'GET'
    });
    if (res.success) {
      const name = res.data?.name;
      const code = res.data?.code;
      const parts = [name, code ? `房间号：${code}` : ''].filter(Boolean);
      myRoomDesc.value = parts.length > 0 ? parts.join(' · ') : '点击返回房间';
    } else {
      userStore.clearLastRoomId();
      myRoomDesc.value = '点击返回房间';
    }
  } catch {
    myRoomDesc.value = '点击返回房间';
  }
};

const joinRoomByCode = async (roomCode: string) => {
  uni.showLoading({ title: '加入中...' });
  try {
    const joinRes: any = await request({
      url: '/room/join',
      method: 'POST',
      data: {
        userId: userStore.userInfo.id,
        roomCode: roomCode
      }
    });

    if (joinRes.success) {
      userStore.setLastRoomId(joinRes.data.id);
      uni.navigateTo({
        url: `/pages/room/room?id=${joinRes.data.id}`
      });
    }
  } catch (error: any) {
    console.error(error);
    if (error.data && error.data.message) {
      uni.showToast({
        title: error.data.message,
        icon: 'none'
      });
    }
  } finally {
    uni.hideLoading();
  }
};

const handleCreateRoom = async () => {
  uni.showLoading({ title: '创建中...' });
  try {
    const res: any = await request({
      url: '/room/create',
      method: 'POST',
      data: {
        userId: userStore.userInfo.id,
        name: `${userStore.userInfo.nickname}的房间`
      }
    });

    if (res.success) {
      userStore.setLastRoomId(res.data.id);
      uni.navigateTo({
        url: `/pages/room/room?id=${res.data.id}&isNew=true`
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    uni.hideLoading();
  }
};

const handlePrimaryCardClick = () => {
  if (userStore.lastRoomId) {
    uni.navigateTo({
      url: `/pages/room/room?id=${userStore.lastRoomId}`
    });
    return;
  }
  handleCreateRoom();
};

const handleJoinRoom = () => {
  uni.scanCode({
    success: (res) => {
      // 假设扫码内容是房间号，或者包含房间号的链接
      // 这里做个简单处理：如果全是数字，当做房间号；如果是链接，解析 query
      let code = res.result;
      
      // 尝试从链接中解析 roomCode 参数
      if (code.includes('?')) {
        const match = code.match(/[?&]roomCode=(\d+)/);
        if (match) {
          code = match[1];
        }
      }

      // 如果是6位数字，直接加入
      if (/^\d{6}$/.test(code)) {
        joinRoomByCode(code);
      } else {
        uni.showToast({ title: '无效的房间码', icon: 'none' });
      }
    },
    fail: (err) => {
      // 用户取消扫码不提示错误
      if (err.errMsg !== 'scanCode:fail cancel') {
        uni.showToast({ title: '扫码失败', icon: 'none' });
      }
    }
  });
};
</script>

<style>
.container {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 30rpx;
}

.header {
  margin-bottom: 60rpx;
  margin-top: 40rpx;
}

.greeting {
  font-size: 40rpx;
  font-weight: bold;
  color: #1a1a2e;
}

.action-area {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.card {
  height: 200rpx;
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1);
}

.create-room {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
}

.join-room {
  background: linear-gradient(135deg, #7b68ee, #5f4dd0);
}

.card-title {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.card-desc {
  color: rgba(255,255,255,0.7);
  font-size: 24rpx;
}
</style>
