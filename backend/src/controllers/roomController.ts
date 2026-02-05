import { Request, Response } from 'express';
import { supabase } from '../config/db';
import type { Server as SocketIOServer } from 'socket.io';

const normalizeAvatar = (avatar: any) => {
  const val = String(avatar || '').trim();
  if (!val) return null;
  if (val.startsWith('wxfile://')) return null;
  if (val.startsWith('http://tmp') || val.startsWith('https://tmp')) return null;
  return val;
};

// 生成 6 位数字房间号
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createRoom = async (req: Request, res: Response) => {
  const { userId, name, maxPlayers, password } = req.body;

  try {
    const pwd = String(password || '').trim();
    const shouldSetPassword = pwd.length > 0;
    if (shouldSetPassword && !/^\d{6}$/.test(pwd)) {
      return res.status(400).json({ success: false, message: '密码需为6位数字' });
    }

    const code = generateRoomCode();
    
    // 创建房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ 
        name, 
        code,
        ...(shouldSetPassword ? { password: pwd } : {}),
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
        avatar: normalizeAvatar(user.avatar) 
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
    const pwd = String(password || '').trim();

    // 查找房间
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ success: false, message: '房间不存在，请检查房间号' });
    }

    if (room.status === 'finished') {
      return res.status(400).json({ success: false, message: '房间已解散' });
    }

    const roomPwd = String(room.password || '000000');
    if (roomPwd !== '000000') {
      if (!/^\d{6}$/.test(pwd)) {
        return res.status(400).json({ success: false, message: '请输入房间密码' });
      }
      if (pwd !== roomPwd) {
        return res.status(400).json({ success: false, message: '密码错误' });
      }
    }

    // 检查房间是否已满
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true });

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
        avatar: normalizeAvatar(user.avatar) 
      });

    if (joinError) throw joinError;

    const io = (req.app.get('io') as SocketIOServer | undefined) ?? undefined;
    if (io) {
      const { data: latestPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .order('joined_at', { ascending: true });

      if (latestPlayers) {
        io.to(room.id).emit('players-updated', latestPlayers);
      }
    }

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

    const io = (req.app.get('io') as SocketIOServer | undefined) ?? undefined;
    if (io) {
      const { data: latestPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (latestPlayers) {
        io.to(roomId).emit('players-updated', latestPlayers);
      }
    }

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
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

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

export const getRoomQRCode = async (req: Request, res: Response) => {
  const { roomCode } = req.body;

  try {
    // 微信接口配置
    const appId = process.env.WECHAT_APP_ID || '';
    const appSecret = process.env.WECHAT_APP_SECRET || '';

    if (!appId || !appSecret) {
      return res.status(500).json({ success: false, message: '服务器未配置微信密钥' });
    }

    // 1. 获取 Access Token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = (await tokenRes.json()) as { access_token?: string; errcode?: number; errmsg?: string };

    if (!tokenData.access_token) {
      console.error('WeChat Token Error:', tokenData);
      return res.status(500).json({ success: false, message: '获取微信令牌失败' });
    }

    // 2. 生成小程序码 (getUnlimitedQRCode)
    // 注意：scene 最大32个可见字符，只支持数字，大小写英文以及部分特殊字符
    // page 必须是已经发布的小程序存在的页面（否则报错），例如 "pages/room/room"
    const qrUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${tokenData.access_token}`;
    const qrRes = await fetch(qrUrl, {
      method: 'POST',
      body: JSON.stringify({
        scene: `${roomCode}`,
        page: 'pages/room/room', // 扫码后跳转的页面
        check_path: false, // 开发阶段设为 false，否则必须发布后才能生成
        env_version: 'develop' // 开发版: develop, 体验版: trial, 正式版: release
      })
    });

    if (!qrRes.ok) {
      return res.status(500).json({ success: false, message: '生成二维码网络错误' });
    }

    const arrayBuffer = await qrRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 检查是否返回了错误 JSON
    try {
      const jsonCheck = JSON.parse(buffer.toString());
      if (jsonCheck.errcode) {
        console.error('WeChat QRCode Error:', jsonCheck);
        return res.status(500).json({ success: false, message: `生成失败: ${jsonCheck.errmsg}` });
      }
    } catch {
      // 不是 JSON，说明是图片二进制，继续处理
    }

    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    res.json({ success: true, data: base64 });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: '生成二维码失败' });
  }
};
