import { Request, Response } from 'express';
import { supabase } from '../config/db';

const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

const toNumber = (val: any) => Number(val);

const isSafeInt32 = (n: number) => Number.isInteger(n) && n >= INT32_MIN && n <= INT32_MAX;

const toChineseDbErrorMessage = (err: any) => {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');

  if (code === '22003' || msg.includes('out of range for type integer')) {
    return '金额过大，请输入更小的数字';
  }

  if (code === '23514' || msg.includes('violates check constraint')) {
    return '金额不合法，请重新输入';
  }

  return '记账失败，请稍后再试';
};

export const createTransaction = async (req: Request, res: Response) => {
  const { roomId, fromPlayerId, toPlayerId, amount, description } = req.body;
  const numAmount = Number(amount);

  try {
    if (!roomId || !fromPlayerId || !toPlayerId) {
      res.status(400).json({ success: false, message: '参数不完整' });
      return;
    }
    if (fromPlayerId === toPlayerId) {
      res.status(400).json({ success: false, message: '付款人和收款人不能相同' });
      return;
    }
    if (!Number.isFinite(numAmount) || !Number.isInteger(numAmount)) {
      res.status(400).json({ success: false, message: '请输入正确金额' });
      return;
    }
    if (numAmount <= 0) {
      res.status(400).json({ success: false, message: '金额必须大于0' });
      return;
    }
    if (numAmount > INT32_MAX) {
      res.status(400).json({ success: false, message: '金额过大，请输入更小的数字' });
      return;
    }

    // 1. 记录交易
    const { data: transaction, error: transError } = await supabase
      .from('transactions')
      .insert({ 
        room_id: roomId, 
        from_player_id: fromPlayerId, 
        to_player_id: toPlayerId, 
        amount: numAmount, 
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
      const fromBalance = toNumber(fromPlayer.balance);
      const toBalance = toNumber(toPlayer.balance);

      if (!Number.isFinite(fromBalance) || !Number.isFinite(toBalance)) {
        res.status(500).json({ success: false, message: '服务器数据异常，请稍后重试' });
        return;
      }

      const nextFrom = fromBalance - numAmount;
      const nextTo = toBalance + numAmount;

      if (!isSafeInt32(nextFrom) || !isSafeInt32(nextTo)) {
        res.status(400).json({ success: false, message: '积分变化后超出范围，请输入更小的金额' });
        return;
      }

      const { error: fromUpdateError } = await supabase
        .from('players')
        .update({ balance: nextFrom })
        .eq('id', fromPlayerId);
      if (fromUpdateError) throw fromUpdateError;

      const { error: toUpdateError } = await supabase
        .from('players')
        .update({ balance: nextTo })
        .eq('id', toPlayerId);
      if (toUpdateError) throw toUpdateError;
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
    const message = toChineseDbErrorMessage(err);
    const statusCode = message === '记账失败，请稍后再试' ? 500 : 400;
    res.status(statusCode).json({ success: false, message });
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
    res.status(500).json({ success: false, message: '获取记录失败' });
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
    res.status(500).json({ success: false, message: '结算计算失败' });
  }
};
