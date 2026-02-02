import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import roomRoutes from './routes/roomRoutes';
import transactionRoutes from './routes/transactionRoutes';
import { supabase } from './config/db';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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

  socket.on('join-room', async ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    // 更新用户在线状态
    try {
      await supabase
        .from('players')
        .update({ is_online: true })
        .eq('user_id', userId)
        .eq('room_id', roomId);
      
      // 广播更新玩家列表
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);
        
      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
    } catch (err) {
      console.error('Error updating player status:', err);
    }
  });

  socket.on('new-transaction', async (data) => {
    const { roomId } = data;
    // 广播新交易事件
    try {
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);
        
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
    
    try {
      await supabase
        .from('players')
        .update({ is_online: false })
        .eq('user_id', userId)
        .eq('room_id', roomId);

      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId);
        
      if (players) {
        io.to(roomId).emit('players-updated', players);
      }
    } catch (err) {
      console.error('Error updating player status:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
