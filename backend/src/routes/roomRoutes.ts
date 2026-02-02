import { Router } from 'express';
import { createRoom, joinRoom, getRoomInfo } from '../controllers/roomController';

const router = Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.get('/:roomId', getRoomInfo);

export default router;