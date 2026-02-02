import { io, Socket } from 'socket.io-client';

const URL = 'http://192.168.154.16:3000';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    this.socket = io(URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
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