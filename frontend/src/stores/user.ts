import { defineStore } from 'pinia';
import { request } from '../utils/request';

interface UserState {
  userInfo: any;
  token: string;
  lastRoomId: string;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    userInfo: uni.getStorageSync('userInfo') || null,
    token: uni.getStorageSync('token') || '',
    lastRoomId: uni.getStorageSync('lastRoomId') || '',
  }),
  actions: {
    async login(code: string, userInfo: any) {
      try {
        let openid = uni.getStorageSync('mock_openid');
        if (!openid) {
          openid = `mock_openid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          uni.setStorageSync('mock_openid', openid);
        }

        const res: any = await request({
          url: '/user/login',
          method: 'POST',
          data: { code, userInfo, openid }
        });

        if (res.success) {
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
    clearLastRoomId() {
      this.lastRoomId = '';
      uni.removeStorageSync('lastRoomId');
    }
  }
});
