import { Router } from 'express';
import { createRoom, joinRoom, getRoomInfo, addMockPlayers, getRoomQRCode, endGame } from '../controllers/roomController';

const router = Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.post('/mock', addMockPlayers);
router.post('/qrcode', getRoomQRCode);
router.post('/end', endGame);
router.get('/:roomId', getRoomInfo);

export default router;
