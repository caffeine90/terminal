import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.ts';
import { config, isDevelopment } from '../config/index.ts';

interface ErrorResponse {
    error: {
        message: string;
        statusCode: number;
        details?: unknown;
        requestId: string;
    };
}

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details: unknown = undefined;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        details = err.details;
    } else if (err.name === 'ZodError') {
        statusCode = 400;
        message = 'Validation Error';
        details = err;
    } else if (err.name === 'SyntaxError' && 'status' in err && err.status === 400) {
        statusCode = 400;
        message = 'Invalid JSON';
    }

    const response: ErrorResponse = {
        error: {
            message,
            statusCode,
            requestId: _req.id,
        },
    };

    if (details !== undefined) {
        response.error.details = details;
    }

    if (isDevelopment) {
        console.error(`[${_req.id}] Error:`, err);
    }

    res.status(statusCode).json(response);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            statusCode: 404,
            requestId: _req.id,
        },
    });
};
