import { Router } from 'express';
import { createRoom, joinRoom, getRoomInfo, addMockPlayers } from '../controllers/roomController';

const router = Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.post('/mock', addMockPlayers); // 添加测试路由
router.get('/:roomId', getRoomInfo);

export default router;