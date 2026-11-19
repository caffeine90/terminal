import express from 'express';
import type { Router } from 'express';
import healthRouter from './health.ts';

const router = express.Router();

router.use('/', healthRouter);

// Add more routes here as needed
// router.use('/api/v1/users', userRouter);
// router.use('/api/v1/auth', authRouter);

export default router;
