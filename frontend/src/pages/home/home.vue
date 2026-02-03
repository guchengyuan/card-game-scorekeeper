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
        <text class="card-title">加入房间</text>
        <text class="card-desc">输入号码加入游戏</text>
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
  // 如果是扫码进入，自动执行加入房间逻辑
  if (options.action === 'join' && options.roomCode) {
    joinRoomByCode(options.roomCode);
  }
});

onShow(() => {
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
  const { roomPassword, canceled } = await promptPassword('请输入房间密码')
  if (canceled) return

  uni.showLoading({ title: '加入中...' });
  try {
    const joinRes: any = await request({
      url: '/room/join',
      method: 'POST',
      data: {
        userId: userStore.userInfo.id,
        roomCode: roomCode,
        password: roomPassword
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
  const { roomPassword, canceled } = await promptPassword('设置6位数字密码')
  if (canceled) return

  uni.showLoading({ title: '创建中...' });
  try {
    const res: any = await request({
      url: '/room/create',
      method: 'POST',
      data: {
        userId: userStore.userInfo.id,
        name: `${userStore.userInfo.nickname}的房间`,
        password: roomPassword
      }
    });

    if (res.success) {
      userStore.setLastRoomId(res.data.id);
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

const promptPassword = (title: string) => {
  return new Promise<{ roomPassword: string; canceled: boolean }>((resolve) => {
    uni.showModal({
      title,
      editable: true,
      placeholderText: '请输入6位数字密码',
      success: (res) => {
        const pwd = String((res as any).content || '')
        if (!res.confirm) {
          resolve({ roomPassword: '', canceled: true })
          return
        }
        if (!/^\d{6}$/.test(pwd)) {
          uni.showToast({ title: '请输入6位数字密码', icon: 'none' })
          resolve({ roomPassword: '', canceled: true })
          return
        }
        resolve({ roomPassword: pwd, canceled: false })
      }
    })
  })
}
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
