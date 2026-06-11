import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'

interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, unknown> | null
}

interface ProblemDetailResponse {
  type: string
  title: string
  status: number
  detail?: string | null
  errors: ProblemDetailErrorItem[]
}

interface ProblemDetailErrorItem {
  location: 'body' | 'query' | 'header' | 'path' | 'cookie'
  code: string
  message: string
  type: string
  field?: string | null
  detail?: string | null
  received?: string | null
  pointer?: string | null
  constraints?: Record<string, unknown> | null
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    if (statusCode === HttpStatus.BAD_REQUEST || statusCode === HttpStatus.UNPROCESSABLE_ENTITY) {
      response
        .status(statusCode)
        .type('application/problem+json')
        .json(this.problemDetailResponse(exception, statusCode))
      return
    }

    response.status(statusCode).json(this.errorResponse(exception, request, statusCode))
  }

  private problemDetailResponse(exception: unknown, statusCode: number): ProblemDetailResponse {
    const message = this.errorMessage(exception)
    const semanticValidation = statusCode === HttpStatus.UNPROCESSABLE_ENTITY
    return {
      type: semanticValidation ? 'tag:semantic-validation-errors' : 'tag:request-errors',
      title: this.errorTitle(statusCode),
      status: statusCode,
      detail: message,
      errors: [
        {
          location: 'body',
          code: semanticValidation ? 'VALIDATION_FAILED' : 'INVALID_REQUEST',
          message,
          type: semanticValidation ? 'tag:semantic-validation-error' : 'tag:request-error',
        },
      ],
    }
  }

  private errorResponse(exception: unknown, request: Request, statusCode: number): ErrorResponse {
    return {
      error: this.errorCode(statusCode),
      message: this.errorMessage(exception),
      details: this.errorDetails(request),
    }
  }

  private errorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse()
      if (typeof exceptionResponse === 'string') {
        return exceptionResponse
      }
      if (this.hasMessage(exceptionResponse)) {
        return Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join('; ')
          : exceptionResponse.message
      }
    }

    return exception instanceof Error ? exception.message : 'Internal server error'
  }

  private errorTitle(statusCode: number): string {
    return HttpStatus[statusCode]
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private errorCode(statusCode: number): string {
    return this.errorTitle(statusCode).toLowerCase().replaceAll(' ', '_')
  }

  private errorDetails(request: Request): Record<string, unknown> | null {
    const traceHeader = request.header('x-request-id') || request.header('x-correlation-id')
    return {
      // Preserve upstream trace IDs; when this API creates one, prefix it so logs show the source.
      correlationId: traceHeader || `widget-${randomUUID()}`,
      timestamp: new Date().toISOString(),
    }
  }

  private hasMessage(value: unknown): value is { message: string | string[] } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      (typeof value.message === 'string' || Array.isArray(value.message))
    )
  }
}
