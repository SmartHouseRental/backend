import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../core/AppError';
import { logger } from '../core/logger';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma specific error handling
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        const fields = (err.meta?.target as string[]) || [];
        message = `Unique constraint failed on ${fields.join(', ')}`;
        break;
      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        message = `Related record not found (Foreign key violation: ${err.meta?.field_name})`;
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        message = (err.meta?.cause as string) || 'Record not found';
        break;
      default:
        statusCode = 400;
        message = `Database error: ${err.message}`;
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode === 500) {
    logger.error('Unhandled Error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      path: req.path,
    });
  }

  const stack = process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined;

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(stack && { stack }),
  });
}
