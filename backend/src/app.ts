import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import roomRoutes from './routes/roomRoutes';
import transactionRoutes from './routes/transactionRoutes';
import { supabase } from './config/db';
import { SessionManager } from './services/SessionManager';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/user', userRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/transaction', transactionRoutes);

app.get('/', (req, res) => {
  res.send('Card Game Scorekeeper API is running (Powered by Supabase)');
});

// WebSocket logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  socket.on('join-room', async ({ roomId, userId, token }) => {
    // 验证Token (简单实现)
    if (token && token !== `mock_token_${userId}`) {
       console.warn(`Invalid token for user ${userId}`);
    }

    // 并发连接控制
    const sessionManager = SessionManager.getInstance();
    const existingSocketId = sessionManager.getSession(userId, roomId);
    if (existingSocketId && existingSocketId !== socket.id) {
       io.to(existingSocketId).emit('KICK_DUPLICATE_LOGIN');
       io.sockets.sockets.get(existingSocketId)?.disconnect(true);
       await sessionManager.logSecurityEvent({
           userId,
           roomId,
           type: 'DUPLICATE_LOGIN_KICK',
           details: { reason: 'WebSocket Join', oldSocketId: existingSocketId, newSocketId: socket.id }
       });
    }
    sessionManager.registerSession(userId, roomId, socket.id);

    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);
    currentRoomId = roomId;
    currentUserId = userId;

    // 更新用户在线状态
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      if (room?.status === 'finished') {
        socket.leave(roomId);
        socket.emit('room-dissolved', { roomId });
        return;
      }

      await supabase
        .from('players')
        .update({ is_online: true })
        .eq('user_id', userId)
        .eq('room_id', roomId);
      
      // 广播更新玩家列表
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
        
      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
    } catch (err) {
      console.error('Error updating player status:', err);
    }
  });

  // 主动刷新房间数据的事件（用于假人添加等场景）
  socket.on('refresh-room', async ({ roomId }) => {
    try {
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
        
      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
    } catch (err) {
      console.error('Error refreshing room:', err);
    }
  });

  socket.on('new-transaction', async (data) => {
    const { roomId } = data;
    // 广播新交易事件
    try {
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
        
      if (players) {
        io.to(roomId).emit('transaction-updated', {
          transaction: data.transaction,
          players: players
        });
      }
    } catch (err) {
      console.error('Error broadcasting transaction:', err);
    }
  });

  socket.on('leave-room', async ({ roomId, userId }) => {
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);
    if (currentRoomId === roomId && currentUserId === userId) {
      currentRoomId = null;
      currentUserId = null;
    }
    
    try {
      await supabase
        .from('players')
        .update({ is_online: false })
        .eq('user_id', userId)
        .eq('room_id', roomId);

      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
        
      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
    } catch (err) {
      console.error('Error updating player status:', err);
    }
  });

  socket.on('exit-room', async ({ roomId, userId }, ack?: (resp: any) => void) => {
    socket.leave(roomId);
    console.log(`User ${userId} exit room ${roomId}`);
    if (currentRoomId === roomId && currentUserId === userId) {
      currentRoomId = null;
      currentUserId = null;
    }

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;

      const wasOwner = room?.owner_id === userId;

      // 尝试删除玩家（如果没有交易记录）
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId);

      if (deleteError) {
        // 如果删除失败（例如有外键约束），则标记为下线
        console.log('Delete player failed (likely due to FK), marking as offline:', deleteError.message);
        await supabase
          .from('players')
          .update({ is_online: false })
          .eq('user_id', userId)
          .eq('room_id', roomId);
      }

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });
      if (playersError) throw playersError;

      const activeUsers = (players || []).filter((p: any) => !!p?.user_id && p.is_online);

      if (wasOwner) {
        const nextOwnerId = (players || [])
          .filter((p: any) => !!p?.user_id && p.user_id !== userId)
          .sort((a: any, b: any) => new Date(a.joined_at || 0).getTime() - new Date(b.joined_at || 0).getTime())
          .map((p: any) => p.user_id)[0] ?? null;

        const { error: ownerUpdateError } = await supabase
          .from('rooms')
          .update({ owner_id: nextOwnerId })
          .eq('id', roomId);
        if (ownerUpdateError) throw ownerUpdateError;
      }

      if (activeUsers.length === 0) {
        const { error: dissolveError } = await supabase
          .from('rooms')
          .update({ status: 'finished', owner_id: null })
          .eq('id', roomId);
        if (dissolveError) throw dissolveError;
      }

      const { data: updatedRoom, error: updatedRoomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (updatedRoomError) throw updatedRoomError;

      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
      io.to(roomId).emit('room-updated', updatedRoom);
      ack?.({ success: true });
    } catch (err) {
      console.error('Error exiting room:', err);
      ack?.({ success: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomId = currentRoomId;
    const userId = currentUserId;
    
    if (userId && roomId) {
      SessionManager.getInstance().removeSession(userId, roomId);
    }

    currentRoomId = null;
    currentUserId = null;

    if (!roomId || !userId) return;

    (async () => {
      try {
        await supabase
          .from('players')
          .update({ is_online: false })
          .eq('user_id', userId)
          .eq('room_id', roomId);

        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('joined_at', { ascending: true });
        if (playersError) throw playersError;

        const activeUsers = (players || []).filter((p: any) => !!p?.user_id && p.is_online);
        if (activeUsers.length === 0) {
          await supabase
            .from('rooms')
            .update({ status: 'finished', owner_id: null })
            .eq('id', roomId);
        }

        if (players) {
          io.to(roomId).emit('players-updated', players);
        }
      } catch (err) {
        console.error('Error handling disconnect:', err);
      }
    })();
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
