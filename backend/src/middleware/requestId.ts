import express from 'express';
import type { Request, Response } from 'express';

export const requestIdMiddleware = (
    req: Request,
    _res: Response,
    next: (err?: Error) => void
): void => {
    req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    next();
};
