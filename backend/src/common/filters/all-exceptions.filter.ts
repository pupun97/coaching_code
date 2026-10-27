import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected server error occurred';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      message = typeof res === 'object' && res.message ? res.message : exception.message;
      errorCode = typeof res === 'object' && res.error ? res.error : exception.name;
    } else if (exception instanceof Error) {
      // Log internal stack trace securely on server, never leak to client
      this.logger.error(
        `Unhandled Error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
      if ((exception as any).code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this unique identifier already exists';
        errorCode = 'DUPLICATE_RECORD';
      } else if ((exception as any).code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Requested record was not found';
        errorCode = 'NOT_FOUND';
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
