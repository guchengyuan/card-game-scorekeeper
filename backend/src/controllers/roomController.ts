import { Request, Response } from 'express';
import { supabase } from '../config/db';

// 生成 6 位数字房间号
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createRoom = async (req: Request, res: Response) => {
  const { userId, name, maxPlayers } = req.body;

  try {
    const code = generateRoomCode();
    
    // 创建房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ 
        name, 
        code, 
        owner_id: userId, 
        max_players: maxPlayers || 4 
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // 房主自动加入房间
    const { error: playerError } = await supabase
      .from('players')
      .insert({ 
        user_id: userId, 
        room_id: room.id, 
        nickname: user.nickname, 
        avatar: user.avatar 
      });

    if (playerError) throw playerError;

    res.json({ success: true, data: room });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Create room failed' });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  const { userId, roomCode } = req.body;

  try {
    // 查找房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: '房间不存在，请检查房间号' });
    }

    // 检查房间是否已满
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);

    if (playersError) throw playersError;

    if (players.length >= room.max_players) {
      return res.status(400).json({ success: false, message: '房间人数已满' });
    }

    // 检查是否已经加入
    const existingPlayer = players.find((p: any) => p.user_id === userId);
    if (existingPlayer) {
      return res.json({ success: true, data: room, message: '您已在房间中' });
    }

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // 加入房间
    const { error: joinError } = await supabase
      .from('players')
      .insert({ 
        user_id: userId, 
        room_id: room.id, 
        nickname: user.nickname, 
        avatar: user.avatar 
      });

    if (joinError) throw joinError;

    res.json({ success: true, data: room });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Join room failed' });
  }
};

export const addMockPlayers = async (req: Request, res: Response) => {
  const { roomId } = req.body;

  try {
    const mockPlayers = [
      {
        nickname: '张三',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        is_online: true
      },
      {
        nickname: '李四',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
        is_online: true
      },
      {
        nickname: '王五',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        is_online: true
      }
    ];

    for (const player of mockPlayers) {
      await supabase.from('players').insert({
        room_id: roomId,
        nickname: player.nickname,
        avatar: player.avatar,
        is_online: player.is_online
        // 注意：这里没有 user_id，因为是假数据
      });
    }

    res.json({ success: true, message: 'Mock players added' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add mock players' });
  }
};

export const getRoomInfo = async (req: Request, res: Response) => {
  const { roomId } = req.params;
  
  try {
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId);

    if (playersError) throw playersError;
    
    res.json({
      success: true,
      data: {
        ...room,
        players: players || []
      }
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
