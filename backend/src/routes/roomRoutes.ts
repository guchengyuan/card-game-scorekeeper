import { Router } from 'express';
import { createRoom, joinRoom, getRoomInfo, addMockPlayers, getRoomQRCode } from '../controllers/roomController';

const router = Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.post('/mock', addMockPlayers);
router.post('/qrcode', getRoomQRCode);
router.get('/:roomId', getRoomInfo);

export default router;