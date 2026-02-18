import { io, Socket } from 'socket.io-client';

const getServerProtocol = () => {
  // 强制使用 WSS
  return 'wss'
}

const getServerPort = () => {
  // 强制使用 443
  return 443
}

const getServerHost = () => {
  // 强制返回云托管域名
  return 'card-game-225112-8-1403978532.sh.run.tcloudbase.com'
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
    console.log('Connecting to socket url:', url);
    
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
