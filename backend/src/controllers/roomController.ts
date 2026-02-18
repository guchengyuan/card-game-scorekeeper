import { Request, Response } from 'express';
import { supabase } from '../config/db';
import type { Server as SocketIOServer } from 'socket.io';
import { SessionManager } from '../services/SessionManager';

// 微信 Token 缓存接口
interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

// 辅助函数：获取并缓存 Access Token
const getAccessToken = async (appId: string, appSecret: string): Promise<string> => {
  const now = Date.now();
  // 如果缓存存在且有效期大于5分钟，直接使用缓存
  if (tokenCache && tokenCache.expires_at > now + 5 * 60 * 1000) {
    return tokenCache.access_token;
  }

  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenData = (await tokenRes.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };

  if (!tokenData.access_token) {
    console.error('WeChat Token Error:', tokenData);
    throw new Error(`获取微信令牌失败: ${tokenData.errmsg || 'Unknown error'}`);
  }

  // 缓存 Token (expires_in 通常为 7200秒)
  tokenCache = {
    access_token: tokenData.access_token,
    expires_at: now + (tokenData.expires_in || 7200) * 1000
  };

  return tokenData.access_token;
};

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

    // 并发控制
    const sessionManager = SessionManager.getInstance();
    const lockKey = `lock:join:${userId}:${room.id}`;
    if (!await sessionManager.acquireLock(lockKey, 30)) {
        return res.status(429).json({ success: false, message: '请求处理中，请勿重复操作' });
    }

    try {
        // 检查活跃会话
        const existingSocketId = sessionManager.getSession(userId, room.id);
        if (existingSocketId) {
             const io = (req.app.get('io') as SocketIOServer | undefined);
             if (io) {
               io.to(existingSocketId).emit('KICK_DUPLICATE_LOGIN');
               io.sockets.sockets.get(existingSocketId)?.disconnect(true);
             }
             sessionManager.removeSession(userId, room.id);
             await sessionManager.logSecurityEvent({
                 userId,
                 roomId: room.id,
                 type: 'DUPLICATE_LOGIN_KICK',
                 details: { reason: 'HTTP Join Request', oldSocketId: existingSocketId }
             });
             return res.status(409).json({ 
                 success: false, 
                 code: 'ERR_DUPLICATE_SESSION', 
                 message: '账号已在其他设备登录，旧会话已断开，请重试' 
             });
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
    } finally {
        await sessionManager.releaseLock(lockKey);
    }
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

    // 1. 获取 Access Token (使用缓存机制)
    let accessToken: string;
    try {
        accessToken = await getAccessToken(appId, appSecret);
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }

    // 2. 确定环境版本
    // 建议在环境变量中配置 WECHAT_ENV_VERSION=release (正式版) 或 develop (开发版)
    // 如果未配置，默认使用 release 以保证生产环境正常
    const envVersion = process.env.WECHAT_ENV_VERSION || 'release'; 

    // 3. 生成小程序码 (getUnlimitedQRCode)
    const qrUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
    
    // 注意：scene 最大32个可见字符，只支持数字，大小写英文以及部分特殊字符
    // page 必须是已经发布的小程序存在的页面（否则报错），例如 "pages/room/room"
    const qrRes = await fetch(qrUrl, {
      method: 'POST',
      body: JSON.stringify({
        scene: `${roomCode}`,
        page: 'pages/room/room', // 扫码后跳转的页面
        check_path: false, // 即使设为 false，小程序也必须至少发布过一次代码
        env_version: envVersion, // 根据环境变量动态设置
        width: 430
      })
    });

    if (!qrRes.ok) {
      return res.status(500).json({ success: false, message: '生成二维码网络错误' });
    }

    const arrayBuffer = await qrRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 4. 增强错误检查：微信可能返回 JSON 格式的错误信息而不是图片
    try {
      const str = buffer.toString();
      // 简单判断是否为 JSON 错误响应 (errcode 存在)
      if (str.startsWith('{') && str.includes('"errcode"')) {
          const jsonCheck = JSON.parse(str);
          if (jsonCheck.errcode) {
            console.error('WeChat QRCode Error:', jsonCheck);
            let msg = jsonCheck.errmsg;
            if (jsonCheck.errcode === 41030) msg = '页面不存在或小程序未发布(41030)';
            if (jsonCheck.errcode === 40001) msg = '微信令牌无效(40001)';
            return res.status(500).json({ success: false, message: `生成失败: ${msg}` });
          }
      }
    } catch {
      // 解析失败说明是二进制图片数据，继续处理
    }

    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    res.json({ success: true, data: base64 });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: '生成二维码失败' });
  }
};
