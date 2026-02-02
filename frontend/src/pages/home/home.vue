<template>
  <view class="container">
    <view class="header">
      <text class="greeting">你好，{{ userStore.userInfo?.nickname || '玩家' }}</text>
    </view>
    
    <view class="action-area">
      <view class="card create-room" @click="handleCreateRoom">
        <text class="card-title">创建房间</text>
        <text class="card-desc">作为房主发起游戏</text>
      </view>
      
      <view class="card join-room" @click="handleJoinRoom">
        <text class="card-title">加入房间</text>
        <text class="card-desc">输入号码加入游戏</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '../../stores/user';
import { request } from '../../utils/request';
import { onLoad } from '@dcloudio/uni-app';

const userStore = useUserStore();

onLoad((options: any) => {
  // 如果是扫码进入，自动执行加入房间逻辑
  if (options.action === 'join' && options.roomCode) {
    joinRoomByCode(options.roomCode);
  }
});

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
      uni.navigateTo({
        url: `/pages/room/room?id=${res.data.id}`
      });
    }
  } catch (error) {
    console.error(error);
  } finally {
    uni.hideLoading();
  }
};

const handleJoinRoom = () => {
  uni.showModal({
    title: '加入房间',
    editable: true,
    placeholderText: '请输入6位房间号',
    success: async (res) => {
      if (res.confirm && res.content) {
        joinRoomByCode(res.content);
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