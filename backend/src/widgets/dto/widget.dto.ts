import { ApiProperty, ApiSchema } from '@nestjs/swagger'

export const WIDGET_STATUSES = ['active', 'inactive', 'archived'] as const
export type WidgetStatus = (typeof WIDGET_STATUSES)[number]

export const WIDGET_EXAMPLE = {
  id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
  subject: 'user-123',
  name: 'Intake form',
  description: 'Widget used for intake workflow testing.',
  status: 'active',
  metadata: {
    source: 'local-dev',
  },
  createdAt: '2026-05-13T18:00:00Z',
  updatedAt: '2026-05-13T18:00:00Z',
}

@ApiSchema({ name: 'Widget' })
export class WidgetDto {
  @ApiProperty({
    format: 'uuid',
    example: WIDGET_EXAMPLE.id,
  })
  id: string

  @ApiProperty({
    description: 'Owner subject from the JWT sub claim or admin operation.',
    example: WIDGET_EXAMPLE.subject,
  })
  subject: string

  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    example: WIDGET_EXAMPLE.name,
  })
  name: string

  @ApiProperty({
    nullable: true,
    maxLength: 1000,
    example: WIDGET_EXAMPLE.description,
  })
  description: string | null

  @ApiProperty({
    enum: WIDGET_STATUSES,
    example: WIDGET_EXAMPLE.status,
  })
  status: WidgetStatus

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: WIDGET_EXAMPLE.metadata,
  })
  metadata: Record<string, unknown>

  @ApiProperty({
    format: 'date-time',
    example: WIDGET_EXAMPLE.createdAt,
  })
  createdAt: Date

  @ApiProperty({
    format: 'date-time',
    example: WIDGET_EXAMPLE.updatedAt,
  })
  updatedAt: Date
}

@ApiSchema({ name: 'ErrorResponse' })
export class ErrorResponseDto {
  @ApiProperty({
    description: 'A short, machine-readable error code or identifier.',
    example: 'forbidden',
  })
  error: string

  @ApiProperty({
    description: 'A human-readable summary of the error.',
    example: 'You are not authorized to access this resource',
  })
  message: string

  @ApiProperty({
    required: false,
    nullable: true,
    type: Object,
    additionalProperties: true,
    example: {
      correlationId: 'req-abc123-xyz',
      timestamp: '2026-01-16T19:22:00Z',
    },
  })
  details?: Record<string, unknown> | null
}

@ApiSchema({ name: 'ProblemDetailErrorItem' })
export class ProblemDetailErrorItemDto {
  @ApiProperty({
    enum: ['body', 'query', 'header', 'path', 'cookie'],
    example: 'body',
  })
  location: 'body' | 'query' | 'header' | 'path' | 'cookie'

  @ApiProperty({
    example: 'INVALID_REQUEST',
  })
  code: string

  @ApiProperty({
    example: 'Invalid request body or parameter',
  })
  message: string

  @ApiProperty({
    example: 'tag:validation-error',
  })
  type: string

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'name',
  })
  field?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'name must be a non-empty string up to 200 characters',
  })
  detail?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    example: '',
  })
  received?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    example: '#/name',
  })
  pointer?: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    type: Object,
    additionalProperties: true,
    example: {
      minLength: 1,
      maxLength: 200,
    },
  })
  constraints?: Record<string, unknown> | null
}

@ApiSchema({ name: 'ProblemDetailResponse' })
export class ProblemDetailResponseDto {
  @ApiProperty({
    example: 'tag:validation-errors',
  })
  type: string

  @ApiProperty({
    example: 'Bad Request',
  })
  title: string

  @ApiProperty({
    example: 400,
  })
  status: number

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'One or more validation errors occurred',
  })
  detail?: string | null

  @ApiProperty({
    type: ProblemDetailErrorItemDto,
    isArray: true,
    minItems: 1,
  })
  errors: ProblemDetailErrorItemDto[]
}
