import { io, Socket } from 'socket.io-client';

const getServerHost = () => {
  const override = uni.getStorageSync('server_host')
  if (override) return String(override)

  try {
    const info = uni.getSystemInfoSync()
    if (info?.platform === 'devtools' || info?.model === 'devtools') return '127.0.0.1'
  } catch {}

  // @ts-ignore
  return process.env.VITE_SERVER_IP || '127.0.0.1'
}

class SocketService {
  public socket: Socket | null = null;
  private currentUrl: string | null = null

  connect() {
    const url = `http://${getServerHost()}:3000`
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
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.log('Socket connect error:', (err as any)?.message || err);
    });
  }

  joinRoom(roomId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('join-room', { roomId, userId });
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
