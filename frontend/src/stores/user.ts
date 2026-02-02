import { defineStore } from 'pinia';
import { request } from '../utils/request';

interface UserState {
  userInfo: any;
  token: string;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    userInfo: uni.getStorageSync('userInfo') || null,
    token: uni.getStorageSync('token') || '',
  }),
  actions: {
    async login(code: string, userInfo: any) {
      try {
        const res: any = await request({
          url: '/user/login',
          method: 'POST',
          data: { code, userInfo }
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
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('token');
    }
  }
});