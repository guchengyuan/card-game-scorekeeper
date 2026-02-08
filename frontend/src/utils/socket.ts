import { io, Socket } from 'socket.io-client';

const isDevToolsEnv = () => {
  try {
    // #ifdef MP-WEIXIN
    // @ts-ignore
    if (wx.getDeviceInfo) {
      // @ts-ignore
      const info = wx.getDeviceInfo()
      return info.platform === 'devtools'
    }
    // @ts-ignore
    const sys = wx.getSystemInfoSync()
    return sys.platform === 'devtools'
    // #endif

    // #ifndef MP-WEIXIN
    const info = uni.getSystemInfoSync()
    return info?.platform === 'devtools' || info?.model === 'devtools'
    // #endif
  } catch {
    return false
  }
}

const getServerProtocol = () => {
  if (isDevToolsEnv()) {
    const devOverride = uni.getStorageSync('server_protocol_devtools')
    if (devOverride) return String(devOverride)
    return 'http'
  }
  const override = uni.getStorageSync('server_protocol')
  if (override) return String(override)
  return 'http'
}

const getServerPort = () => {
  const parsePort = (val: any) => {
    const n = Number(String(val || '').trim())
    if (!Number.isFinite(n)) return null
    if (n <= 0 || n > 65535) return null
    return Math.floor(n)
  }

  if (isDevToolsEnv()) {
    const devOverride = parsePort(uni.getStorageSync('server_port_devtools'))
    if (devOverride) return devOverride
    return 3000
  }

  const override = parsePort(uni.getStorageSync('server_port'))
  if (override) return override
  return 3000
}

const getServerHost = () => {
  if (isDevToolsEnv()) {
    const devOverride = uni.getStorageSync('server_host_devtools')
    if (devOverride) return String(devOverride)
    return '127.0.0.1'
  }

  try {
    // #ifdef MP-WEIXIN
    // @ts-ignore
    if (wx.getDeviceInfo) {
      // @ts-ignore
      const info = wx.getDeviceInfo()
      if (info.platform === 'devtools') return '127.0.0.1'
    } else {
      // @ts-ignore
      const info = wx.getSystemInfoSync()
      if (info.platform === 'devtools') return '127.0.0.1'
    }
    // #endif

    // #ifndef MP-WEIXIN
    const info = uni.getSystemInfoSync()
    if (info?.platform === 'devtools' || info?.model === 'devtools') return '127.0.0.1'
    // #endif
  } catch {}

  const override = uni.getStorageSync('server_host')
  if (override) return String(override)

  // @ts-ignore
  return process.env.VITE_SERVER_IP || '127.0.0.1'
}

let promptingServerHost = false
const maybePromptServerHost = (err: any) => {
  if (promptingServerHost) return

  const override = uni.getStorageSync('server_host')
  if (override) return

  let isDevtools = false
  try {
    // #ifdef MP-WEIXIN
    // @ts-ignore
    if (wx.getDeviceInfo) {
      // @ts-ignore
      const info = wx.getDeviceInfo()
      isDevtools = info.platform === 'devtools'
    } else {
      // @ts-ignore
      const info = wx.getSystemInfoSync()
      isDevtools = info.platform === 'devtools'
    }
    // #endif

    // #ifndef MP-WEIXIN
    const info = uni.getSystemInfoSync()
    isDevtools = info?.platform === 'devtools' || info?.model === 'devtools'
    // #endif
  } catch {}
  if (isDevtools) return

  const host = getServerHost()
  const message = String((err as any)?.message || (err as any)?.errMsg || '')
  if (!message) return
  if (!/timeout|connect|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(message)) return

  promptingServerHost = true
  const safetyTimer = setTimeout(() => {
    promptingServerHost = false
  }, 8000)
  try {
    uni.showModal({
      title: '设置服务器IP',
      content: `当前连接失败（${host}:3000）。真机通常不能访问 127.0.0.1/localhost，请输入电脑局域网IP（例如 192.168.2.2）`,
      editable: true,
      placeholderText: '例如 192.168.2.2（可填写当前电脑局域网IP）',
      success: (res) => {
        if (res.confirm) {
          const value = String((res as any).content || '').trim()
          if (value) {
            uni.setStorageSync('server_host', value)
            uni.showToast({ title: '已保存，请重进房间', icon: 'none' })
          }
        }
        clearTimeout(safetyTimer)
        promptingServerHost = false
      },
      fail: () => {
        clearTimeout(safetyTimer)
        promptingServerHost = false
      }
    })
  } catch {
    clearTimeout(safetyTimer)
    promptingServerHost = false
  }
}

class SocketService {
  public socket: Socket | null = null;
  private currentUrl: string | null = null

  connect() {
    const url = `${getServerProtocol()}://${getServerHost()}:${getServerPort()}`
    if (this.socket && this.currentUrl && this.currentUrl !== url) {
      this.socket.disconnect()
      this.socket = null
    }

    if (this.socket?.connected) return;
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
      return;
    }
    this.currentUrl = url
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      const message = (err as any)?.message || (err as any)?.description || err
      console.log('Socket url:', url);
      console.log('Socket connect error:', message);
      maybePromptServerHost(err)
    });

    this.socket.on('KICK_DUPLICATE_LOGIN', () => {
      console.warn('Received KICK_DUPLICATE_LOGIN');
      uni.showModal({
        title: '下线通知',
        content: '您的账号已在其他设备登录，当前会话已断开',
        showCancel: false,
        success: () => {
          uni.reLaunch({ url: '/pages/login/login' });
        }
      });
    });
  }

  joinRoom(roomId: string, userId: string, token?: string) {
    if (this.socket) {
      this.socket.emit('join-room', { roomId, userId, token });
    }
  }

  leaveRoom(roomId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('leave-room', { roomId, userId });
    }
  }

  exitRoom(roomId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('exit-room', { roomId, userId });
    }
  }

  emitWithAck(event: string, payload: any, timeoutMs = 800): Promise<any | null> {
    return new Promise(resolve => {
      const sock = this.socket
      if (!sock || !sock.connected) {
        resolve(null)
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        resolve(null)
      }, timeoutMs)

      sock.emit(event, payload, (resp: any) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(resp)
      })
    })
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
