import { Request, Response } from 'express';
import { supabase } from '../config/db';

const normalizeAvatar = (avatarUrl: any) => {
  const val = String(avatarUrl || '').trim();
  if (!val) return null;
  if (val.startsWith('wxfile://')) return null;
  if (val.startsWith('http://tmp') || val.startsWith('https://tmp')) return null;
  return val;
};

export const login = async (req: Request, res: Response) => {
  const { code, userInfo, openid: providedOpenid } = req.body;

  // 在实际生产环境中，这里需要调用微信 API (jscode2session) 来获取 openid
  // 为了演示方便，我们这里模拟一个 openid，或者直接使用客户端传来的 mock openid
  const openid = providedOpenid ? String(providedOpenid) : `mock_openid_${code}`; 

  try {
    // 检查用户是否存在
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('openid', openid);

    if (findError) throw findError;
    
    let user;
    if (users && users.length > 0) {
      // 更新用户信息
      const existing = users[0];
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ 
          nickname: userInfo.nickName, 
          avatar: normalizeAvatar(userInfo?.avatarUrl), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      // 创建新用户
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ 
          openid, 
          nickname: userInfo.nickName, 
          avatar: normalizeAvatar(userInfo?.avatarUrl) 
        })
        .select()
        .single();
        
      if (createError) throw createError;
      user = newUser;
    }

    res.json({
      success: true,
      data: user,
      token: 'mock_token_' + user.id // 实际应生成 JWT
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
};
