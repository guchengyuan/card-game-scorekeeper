import { defineStore } from 'pinia';
import { request } from '../utils/request';

interface UserState {
  userInfo: any;
  token: string;
  lastRoomId: string;
  currentRoomCode: string;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    userInfo: uni.getStorageSync('userInfo') || null,
    token: uni.getStorageSync('token') || '',
    lastRoomId: uni.getStorageSync('lastRoomId') || '',
    currentRoomCode: ''
  }),
  actions: {
    async login(code: string, userInfo: any) {
      try {
        // 不再强制生成 mock_openid，优先依赖后端通过 code 获取真实 openid
        // 只有在后端无法获取时（如开发环境无配置），才会回退到使用 mock_openid
        // 如果本地已经有 mock_openid，可以传给后端作为备选
        let openid = uni.getStorageSync('mock_openid');
        
        const res: any = await request({
          url: '/user/login',
          method: 'POST',
          data: { code, userInfo, openid }
        });

        if (res.success) {
          // 如果后端返回了新的用户数据（包含真实的 openid），更新本地存储
          // 注意：通常不需要在前端存储 openid，这里主要为了保持逻辑兼容
          if (res.data.openid && res.data.openid !== openid) {
              uni.setStorageSync('mock_openid', res.data.openid);
          }
          
          this.userInfo = res.data;
          this.token = res.token;
          uni.setStorageSync('userInfo', res.data);
          uni.setStorageSync('token', res.token);
          return true;
        }
      } catch (error) {
        console.error('Login error:', error);
        return false;
      }
    },
    logout() {
      this.userInfo = null;
      this.token = '';
      this.lastRoomId = '';
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('token');
      uni.removeStorageSync('lastRoomId');
    },
    setLastRoomId(roomId: string) {
      this.lastRoomId = String(roomId || '');
      uni.setStorageSync('lastRoomId', this.lastRoomId);
    },
    setCurrentRoomCode(code: string) {
      this.currentRoomCode = code;
    },
    clearLastRoomId() {
      this.lastRoomId = '';
      uni.removeStorageSync('lastRoomId');
    }
  }
});
