import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ErrorHandler {
  static async execute<T>(
    action: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      ErrorHandler.handle(error, context);
    }
  }

  static handle(error: any, context = 'Unknown'): never {
    // Nest exceptions
    if (error instanceof HttpException) {
      throw error;
    }

    console.error(`[${context}] Error:`, error);

    // MongoDB Duplicate Key
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      throw new ConflictException(
        `${field || 'Resource'} already exists`,
      );
    }

    // Mongoose Validation Error
    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message,
      );

      throw new BadRequestException(messages);
    }

    // Invalid ObjectId
    if (error?.name === 'CastError') {
      throw new BadRequestException(
        `Invalid ${error.path}: ${error.value}`,
      );
    }

    // MongoDB Connection Error
    if (
      error?.name === 'MongoNetworkError' ||
      error?.name === 'MongoServerSelectionError'
    ) {
      throw new ServiceUnavailableException(
        'Database connection unavailable',
      );
    }

    throw new InternalServerErrorException(
      'Something went wrong',
    );
  }

  /* =======================
     Convenience Helpers
     ======================= */

  static alreadyExists(resource: string): never {
    throw new ConflictException(`${resource} already exists`);
  }

  static notFound(resource: string): never {
    throw new NotFoundException(`${resource} not found`);
  }

  static invalidCredentials(
    message = 'Invalid Credentials!',
  ): never {
    throw new BadRequestException(message);
  }

  static unauthorized(
    message = 'Unauthorized',
  ): never {
    throw new UnauthorizedException(message);
  }

  static serviceUnavailable(
    service = 'service',
  ): never {
    throw new ServiceUnavailableException(
      `${service} is currently unavailable`,
    );
  }

  static operationFailed(
    operation = 'operation',
  ): never {
    throw new InternalServerErrorException(
      `${operation} failed`,
    );
  }
}