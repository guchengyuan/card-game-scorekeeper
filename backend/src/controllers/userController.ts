import { Request, Response } from 'express';
import { supabase } from '../config/db';
import fetch from 'node-fetch';
import https from 'https';

const createWeChatAgent = () => {
  const pemBase64 = String(process.env.WECHAT_CA_CERT_PEM_BASE64 || '').trim();
  const insecure = String(process.env.WECHAT_INSECURE_TLS || '').trim() === '1';
  const ca = pemBase64 ? Buffer.from(pemBase64, 'base64').toString('utf8') : undefined;
  return new https.Agent({ ...(ca ? { ca } : {}), rejectUnauthorized: !insecure });
};

const normalizeAvatar = (avatarUrl: any) => {
  const val = String(avatarUrl || '').trim();
  if (!val) return null;
  if (val.startsWith('wxfile://')) return null;
  if (val.startsWith('http://tmp') || val.startsWith('https://tmp')) return null;
  return val;
};

export const login = async (req: Request, res: Response) => {
  const { code, userInfo, openid: providedOpenid } = req.body;
  
  let openid = providedOpenid ? String(providedOpenid) : '';
  const nickname = String(userInfo?.nickName || userInfo?.nickname || '').trim() || '游客';
  const avatarUrl = userInfo?.avatarUrl || userInfo?.avatar;

  // 尝试使用微信 API 获取真实 OpenID
  if (code && process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
    try {
      const appId = process.env.WECHAT_APP_ID;
      const appSecret = process.env.WECHAT_APP_SECRET;
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
      
      const wxRes = await fetch(url, { agent: createWeChatAgent() as any });
      const wxData = (await wxRes.json()) as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };

      if (wxData.openid) {
        openid = wxData.openid;
      } else {
        console.warn('WeChat jscode2session failed:', wxData);
      }
    } catch (err) {
      console.error('Error fetching WeChat session:', err);
    }
  }

  // 降级策略：如果没有真实 OpenID 且没有提供 mock openid，生成一个 mock 的
  if (!openid) {
     openid = `mock_openid_${code || Date.now()}`;
  }

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
          nickname, 
          avatar: normalizeAvatar(avatarUrl), 
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
          nickname, 
          avatar: normalizeAvatar(avatarUrl) 
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
