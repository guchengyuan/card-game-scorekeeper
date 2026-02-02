import { Router } from 'express';
import { createTransaction, getTransactions, getSettlement } from '../controllers/transactionController';

const router = Router();

router.post('/create', createTransaction);
router.get('/room/:roomId', getTransactions);
router.get('/settlement/:roomId', getSettlement);

export default router;