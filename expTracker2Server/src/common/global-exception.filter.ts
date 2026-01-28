import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string = 'Internal server error';

    // --- Handle NestJS HttpExceptions ---
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      message = typeof res === 'string' ? res : (res as any).message || message;
    }

    // --- Handle Prisma Known Request Errors ---
    else if (exception instanceof PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          // Unique constraint failed
          const fields = exception.meta?.fields as string[] | undefined;
          status = HttpStatus.BAD_REQUEST;
          if (fields && fields.length > 0) {
            message = `Duplicate value for field: ${fields.join(', ')}`;
          } else {
            message = 'Duplicate value detected';
          }
          break;
        }

        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;

        // Add more Prisma error codes here if needed

        default:
          status = HttpStatus.BAD_REQUEST;
          message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
