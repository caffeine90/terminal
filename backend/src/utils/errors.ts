export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', details?: unknown) {
    super(message, 400, details);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super(message, 401, details);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: unknown) {
    super(message, 403, details);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', details?: unknown) {
    super(message, 404, details);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 409, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests', details?: unknown) {
    super(message, 429, details);
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', details?: unknown) {
    super(message, 500, details);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable', details?: unknown) {
    super(message, 503, details);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}