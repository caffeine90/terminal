import express from 'express';
import type { Router, Response } from 'express';
import { config } from '../config/index.ts';

const router = express.Router();

router.get('/health', (_req, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
  });
});

router.get('/ready', (_req, res: Response) => {
  // Add any readiness checks here (database, cache, etc.)
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;