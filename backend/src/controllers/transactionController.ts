import { Request, Response } from 'express';
import { supabase } from '../config/db';

export const createTransaction = async (req: Request, res: Response) => {
  const { roomId, fromPlayerId, toPlayerId, amount, description } = req.body;

  try {
    // 1. 记录交易
    const { data: transaction, error: transError } = await supabase
      .from('transactions')
      .insert({ 
        room_id: roomId, 
        from_player_id: fromPlayerId, 
        to_player_id: toPlayerId, 
        amount, 
        description 
      })
      .select()
      .single();

    if (transError) throw transError;

    // 2. 更新玩家余额 (Read-Modify-Write)
    // 注意：并发高时可能有问题，建议使用 RPC，但为了简单演示这里用查询更新
    const { data: fromPlayer } = await supabase.from('players').select('balance').eq('id', fromPlayerId).single();
    const { data: toPlayer } = await supabase.from('players').select('balance').eq('id', toPlayerId).single();

    if (fromPlayer && toPlayer) {
      await supabase.from('players').update({ balance: fromPlayer.balance - amount }).eq('id', fromPlayerId);
      await supabase.from('players').update({ balance: toPlayer.balance + amount }).eq('id', toPlayerId);
    }

    // 3. 获取更新后的玩家列表（用于前端同步）
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId);

    res.json({
      success: true,
      data: {
        transaction,
        players: players || []
      }
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Transaction failed' });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  const { roomId } = req.params;

  try {
    // 使用 Supabase 的关联查询
    // 注意：这里假设 Supabase 能正确推断 FK 关系，如果不能，可能需要手动指定
    // transactions 表有 from_player_id 和 to_player_id 指向 players
    // 我们手动查询并拼装，或者使用 Supabase 的深度查询
    // 简单起见，我们先查 transaction，再查关联信息，或者直接利用 Supabase 强大的关联功能
    
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        from_player:players!from_player_id(nickname, avatar),
        to_player:players!to_player_id(nickname, avatar)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 格式化返回数据以匹配前端期望的结构 (扁平化)
    const formatted = transactions.map((t: any) => ({
      ...t,
      from_player_name: t.from_player?.nickname,
      from_player_avatar: t.from_player?.avatar,
      to_player_name: t.to_player?.nickname,
      to_player_avatar: t.to_player?.avatar
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Get transactions failed' });
  }
};

export const getSettlement = async (req: Request, res: Response) => {
  const { roomId } = req.params;

  try {
    // 获取所有玩家及其余额
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId);

    if (error) throw error;

    const creditors: any[] = [];
    const debtors: any[] = [];

    (players || []).forEach((p: any) => {
      if (p.balance > 0) creditors.push({ ...p });
      else if (p.balance < 0) debtors.push({ ...p, balance: Math.abs(p.balance) });
    });

    const settlements: any[] = [];
    let i = 0, j = 0;

    // 简化结算算法
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].balance, creditors[j].balance);
      
      settlements.push({
        fromPlayerId: debtors[i].id,
        fromPlayerName: debtors[i].nickname,
        fromPlayerAvatar: debtors[i].avatar,
        toPlayerId: creditors[j].id,
        toPlayerName: creditors[j].nickname,
        toPlayerAvatar: creditors[j].avatar,
        amount
      });

      debtors[i].balance -= amount;
      creditors[j].balance -= amount;

      if (debtors[i].balance === 0) i++;
      if (creditors[j].balance === 0) j++;
    }

    res.json({ success: true, data: settlements });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Settlement calculation failed' });
  }
};
