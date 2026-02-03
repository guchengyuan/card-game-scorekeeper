import { Request, Response } from 'express';
import { supabase } from '../config/db';

// 生成 6 位数字房间号
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createRoom = async (req: Request, res: Response) => {
  const { userId, name, maxPlayers, password } = req.body;

  try {
    const pwd = String(password || '');
    if (!/^\d{6}$/.test(pwd)) {
      return res.status(400).json({ success: false, message: '请输入6位数字密码' });
    }

    const code = generateRoomCode();
    
    // 创建房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ 
        name, 
        code, 
        password: pwd,
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
    res.status(500).json({ success: false, message: '创建房间失败' });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  const { userId, roomCode, password } = req.body;

  try {
    const pwd = String(password || '');
    if (!/^\d{6}$/.test(pwd)) {
      return res.status(400).json({ success: false, message: '请输入6位数字密码' });
    }

    // 查找房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: '房间不存在，请检查房间号' });
    }

    if (String(room.password || '') !== pwd) {
      return res.status(400).json({ success: false, message: '密码错误' });
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
    res.status(500).json({ success: false, message: '加入房间失败' });
  }
};

export const addMockPlayers = async (req: Request, res: Response) => {
  const { roomId } = req.body;

  try {
    const mockNames = ['张三', '李四', '王五', '赵六', '孙七'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomSeed = Math.random().toString(36).substring(7);

    const player = {
      nickname: randomName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`,
      is_online: true
    };

    await supabase.from('players').insert({
      room_id: roomId,
      nickname: player.nickname,
      avatar: player.avatar,
      is_online: player.is_online
      // 注意：这里没有 user_id，因为是假数据
    });

    res.json({ success: true, message: '添加假人成功' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: '添加假人失败' });
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
      return res.status(404).json({ success: false, message: '房间不存在' });
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
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};
