import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { OpenAPIObject } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { customLogger } from './common/logger.config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { VersioningType } from '@nestjs/common'
import { metricsMiddleware } from './middleware/prom'
import { SdxWidgetsModule } from './sdx-widgets/sdx-widgets.module'

const apiDescription = `Reference API for managing SDX Widgets.

Normal user endpoints derive widget ownership from the authenticated subject in the JWT \`sub\` claim. Callers cannot set or change the subject through user-facing paths or request bodies.

Scope names use the format \`<PrivacyZone>.<resource-type>.<action>\`. For this reference implementation, the privacy zone is \`SDX-RI\`, the resource type is \`sdx-widgets\`, and standard actions are \`read\`, \`create\`, \`update\`, and \`delete\`. Administrative operations are consolidated under the \`admin\` action.

The SDX Widget scopes are \`SDX-RI.sdx-widgets.read\`, \`SDX-RI.sdx-widgets.create\`, \`SDX-RI.sdx-widgets.update\`, \`SDX-RI.sdx-widgets.delete\`, and \`SDX-RI.sdx-widgets.admin\`.`

/**
 *
 */
export async function bootstrap() {
  const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: customLogger,
  })
  app.use(helmet())
  app.enableCors()
  app.set('trust proxy', 1)
  app.use(metricsMiddleware)
  app.enableShutdownHooks()
  app.setGlobalPrefix('api')
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  })
  const config = new DocumentBuilder()
    .setTitle('SDX Reference Implementation API - SDX Widgets')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', undefined as any, undefined as any)
    .setLicense('Apache-2.0', undefined as any)

    .addServer('http://localhost:3000/api/v1', 'Local development server for the SDX Widgets API')
    .addTag(
      'Admin SDX Widgets',
      'Administrative SDX Widget operations that can act across subjects.',
    )
    .addTag(
      'SDX Widgets',
      'SDX Widget operations that act on resources owned by the authenticated subject.',
    )
    .addSecurity('openId', {
      type: 'openIdConnect',
      description: 'Access token with the scope specified by each operation.',
      openIdConnectUrl: undefined as any,
    })
    .addSecurityRequirements('openId', ['SDX-RI.sdx-widgets.read'])
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [SdxWidgetsModule],
  })
  alignGeneratedSdxWidgetSpec(document)
  SwaggerModule.setup('/api/docs', app, document)
  return app
}

function alignGeneratedSdxWidgetSpec(document: OpenAPIObject) {
  const pathSummaries: Record<string, string> = {
    '/sdx-widgets': 'Manage SDX Widgets for the authenticated subject.',
    '/sdx-widgets/{widgetId}': 'Manage one SDX Widget for the authenticated subject.',
    '/admin/subjects/{subject}/sdx-widgets': 'Administer SDX Widgets for one subject.',
    '/admin/sdx-widgets/{widgetId}': 'Administer one SDX Widget by ID.',
  }

  const orderedPaths = [
    '/sdx-widgets',
    '/sdx-widgets/{widgetId}',
    '/admin/subjects/{subject}/sdx-widgets',
    '/admin/sdx-widgets/{widgetId}',
  ]

  const normalizedPaths = Object.fromEntries(
    Object.entries(document.paths).map(([path, pathItem]) => {
      const normalizedPath = path.replace(/^\/api\/v1/, '').replace(/^\/v1/, '')
      return [
        normalizedPath,
        orderKeys(
          {
            ...pathItem,
            summary: pathSummaries[normalizedPath],
          },
          ['summary', 'parameters', 'get', 'post', 'put', 'patch', 'delete'],
        ),
      ]
    }),
  )

  document.paths = orderKeys(normalizedPaths, orderedPaths) as OpenAPIObject['paths']
  alignGeneratedSchemas(document)
  alignGeneratedResponses(document)
  alignGeneratedHeaders(document)
  alignGeneratedSuccessContent(document)
  orderGeneratedOperations(document)
  orderGeneratedComponents(document)
  orderOpenApiDocument(document)
}

function alignGeneratedSchemas(document: OpenAPIObject): void {
  const schemas = document.components?.schemas as
    | Record<string, Record<string, unknown>>
    | undefined
  if (!schemas) {
    return
  }

  schemas.SdxWidgetStatus = {
    description: 'Lifecycle status for a widget.',
    type: 'string',
    example: 'active',
    enum: ['active', 'inactive', 'archived'],
  }
  schemas.ProblemDetailErrorLocation = {
    title: 'ProblemDetailErrorLocation',
    description: 'The location on the HTTP request for which a problem has been detected.',
    type: 'string',
    enum: ['body', 'query', 'header', 'path', 'cookie'],
    example: 'body',
  }

  for (const schemaName of [
    'SdxWidget',
    'CreateSdxWidgetRequest',
    'UpdateSdxWidgetRequest',
    'PatchSdxWidgetRequest',
    'AdminUpdateSdxWidgetRequest',
    'AdminPatchSdxWidgetRequest',
  ]) {
    const properties = schemas[schemaName]?.properties
    if (isRecord(properties) && isRecord(properties.status)) {
      properties.status = {
        $ref: '#/components/schemas/SdxWidgetStatus',
      }
    }
  }

  const problemProperties = schemas.ProblemDetailErrorItem?.properties
  if (isRecord(problemProperties)) {
    problemProperties.location = {
      $ref: '#/components/schemas/ProblemDetailErrorLocation',
    }
  }

  for (const operation of generatedOperations(document)) {
    const parameters = operation.parameters
    if (!Array.isArray(parameters)) {
      continue
    }
    for (const parameter of parameters) {
      if (!isRecord(parameter)) {
        continue
      }
      if (parameter.name === 'status') {
        parameter.schema = {
          $ref: '#/components/schemas/SdxWidgetStatus',
        }
      }
      if (parameter.name === 'widgetId') {
        parameter.description = 'Unique widget identifier as a UUID.'
      }
      if (parameter.name === 'subject') {
        parameter.description = 'Owner subject identifier.'
      }
      if (parameter.name === 'limit' && isRecord(parameter.schema)) {
        parameter.schema.example = 25
      }
    }
  }

  for (const schemaName of [
    'CreateSdxWidgetRequest',
    'UpdateSdxWidgetRequest',
    'PatchSdxWidgetRequest',
    'AdminUpdateSdxWidgetRequest',
    'AdminPatchSdxWidgetRequest',
  ]) {
    if (schemas[schemaName]) {
      schemas[schemaName].additionalProperties = false
    }
  }
  if (schemas.PatchSdxWidgetRequest) {
    schemas.PatchSdxWidgetRequest.minProperties = 1
  }
  if (schemas.AdminPatchSdxWidgetRequest) {
    schemas.AdminPatchSdxWidgetRequest.minProperties = 1
  }

  Object.assign(schemas.SdxWidget, {
    description: 'Widget resource owned by a subject.',
    example: {
      id: '4f3066e8-5a59-4fc5-8e7b-fcd7f4d01c4f',
      subject: 'user-123',
      name: 'Intake form',
      description: 'Widget used for intake workflow testing.',
      status: 'active',
      metadata: { source: 'local-dev' },
      createdAt: '2026-05-13T18:00:00Z',
      updatedAt: '2026-05-13T18:00:00Z',
    },
  })
  Object.assign(schemas.SdxWidgetListResponse, {
    description: 'A paginated list of SDX Widgets with an optional cursor for the next page.',
    example: {
      items: [schemas.SdxWidget.example],
      nextCursor: 'eyJvZmZzZXQiOjI1fQ',
    },
  })
  Object.assign(schemas.CreateSdxWidgetRequest, {
    example: {
      name: 'Intake form',
      description: 'Widget used for intake workflow testing.',
      status: 'active',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.UpdateSdxWidgetRequest, {
    example: {
      name: 'Intake form v2',
      description: 'Updated widget used for intake workflow testing.',
      status: 'inactive',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.PatchSdxWidgetRequest, {
    example: { status: 'archived' },
  })
  Object.assign(schemas.AdminUpdateSdxWidgetRequest, {
    example: {
      subject: 'user-456',
      name: 'Intake form v2',
      description: 'Updated widget used for intake workflow testing.',
      status: 'inactive',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.AdminPatchSdxWidgetRequest, {
    example: {
      subject: 'user-456',
      status: 'archived',
    },
  })
  Object.assign(schemas.ErrorResponse, {
    title: 'ErrorResponse',
    description:
      'Standard error response format for unexpected or server-side errors (e.g., 500 Internal Server Error, 403 Forbidden, 401 Unauthorized, etc.). This is used when a more structured Problem Details response (RFC 9457) is not appropriate or when the error is general rather than validation-specific. The `details.correlationId` value is used for support and log tracing. When an inbound `x-request-id` or `x-correlation-id` header is present, the API preserves that upstream value. When this API generates the value, it uses the `sdxw-<uuid>` format so logs show that SDX Widgets created the correlation ID.',
    example: errorExample('forbidden', 'You are not authorized to access this resource'),
  })
  Object.assign(schemas.ProblemDetailErrorItem, {
    title: 'ProblemDetailErrorItem',
    description:
      'Represents a single detailed error within a Problem Details response (RFC 9457). Provides granular information about what went wrong in the request.',
    example: {
      code: 'REQUIRED_FIELD_MISSING',
      detail: 'Widget name is required',
      field: 'name',
      location: 'body',
      message: 'Missing required widget name',
      pointer: '#/name',
      received: '',
      type: 'tag:validation-error',
    },
  })
  Object.assign(schemas.ProblemDetailResponse, {
    title: 'ProblemDetailResponse',
    example: {
      detail: 'One or more validation errors occurred',
      errors: [
        {
          code: 'INVALID_REQUEST',
          location: 'body',
          message: 'Invalid request body or parameter',
          pointer: '#/name',
          received: '',
          type: 'tag:validation-error',
        },
      ],
      status: 400,
      title: 'Bad Request',
      type: 'tag:validation-errors',
    },
  })
}

function alignGeneratedResponses(document: OpenAPIObject): void {
  const definitions: Record<
    string,
    {
      name: string
      description: string
      mediaType: string
      schema: string
      examples: Record<string, unknown>
    }
  > = {
    '400': {
      name: 'BadRequest',
      description:
        'Malformed request syntax, invalid JSON, or invalid path/query parameter format.',
      mediaType: 'application/problem+json',
      schema: 'ProblemDetailResponse',
      examples: {
        invalidWidgetId: {
          summary: 'Invalid path parameter',
          value: {
            detail: 'widgetId must be a valid UUID',
            errors: [
              {
                code: 'INVALID_REQUEST',
                location: 'path',
                message: 'widgetId must be a valid UUID',
                pointer: '#/widgetId',
                received: 'not-a-uuid',
                type: 'tag:request-error',
              },
            ],
            status: 400,
            title: 'Bad Request',
            type: 'tag:request-errors',
          },
        },
      },
    },
    '401': {
      name: 'Unauthorized',
      description: 'Missing or invalid authentication.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        missingAuthentication: {
          summary: 'Missing or invalid authentication',
          value: errorExample('unauthorized', 'Missing or invalid authentication'),
        },
      },
    },
    '403': {
      name: 'Forbidden',
      description: 'The authenticated caller does not have the required authorization.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        missingScope: {
          summary: 'Required scope is missing',
          value: errorExample('forbidden', 'Required scope is missing'),
        },
      },
    },
    '404': {
      name: 'NotFound',
      description: 'Widget was not found for the current request.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        widgetNotFound: {
          summary: 'Widget not found',
          value: errorExample('not_found', 'SDX Widget not found'),
        },
      },
    },
    '409': {
      name: 'Conflict',
      description:
        'Request conflicts with the current resource state, such as duplicate names, state conflicts, optimistic locking failures, or idempotency key reuse with a different request body.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        widgetConflict: {
          summary: 'Request conflicts with widget state',
          value: errorExample('conflict', 'Request conflicts with the current SDX Widget state'),
        },
      },
    },
    '412': {
      name: 'PreconditionFailed',
      description: 'The supplied If-Match value does not match the current widget version.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        staleEntityTag: {
          summary: 'If-Match does not match',
          value: errorExample(
            'precondition_failed',
            'The supplied If-Match value does not match the current widget version',
          ),
        },
      },
    },
    '422': {
      name: 'UnprocessableEntity',
      description: 'Syntactically valid request failed Widget validation or database limit rules.',
      mediaType: 'application/problem+json',
      schema: 'ProblemDetailResponse',
      examples: {
        invalidWidgetName: {
          summary: 'Request body fails validation',
          value: {
            detail: 'name must be a non-empty string up to 200 characters',
            errors: [
              {
                code: 'VALIDATION_FAILED',
                location: 'body',
                message: 'name must be a non-empty string up to 200 characters',
                pointer: '#/name',
                received: '',
                type: 'tag:semantic-validation-error',
              },
            ],
            status: 422,
            title: 'Unprocessable Entity',
            type: 'tag:semantic-validation-errors',
          },
        },
      },
    },
    '429': {
      name: 'TooManyRequests',
      description:
        'Too many requests. Retry after the interval indicated by the Retry-After header.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        rateLimited: {
          summary: 'Request rate limited',
          value: {
            ...errorExample('too_many_requests', 'Too many requests'),
            details: {
              correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
              retryAfter: 60,
            },
          },
        },
      },
    },
    '500': {
      name: 'InternalServerError',
      description:
        'Unexpected server error. The correlation ID can be used for support and tracing.',
      mediaType: 'application/json',
      schema: 'ErrorResponse',
      examples: {
        unexpectedError: {
          summary: 'Unexpected server error',
          value: {
            ...errorExample('internal_server_error', 'Internal server error'),
            details: {
              correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
              timestamp: '2026-05-13T18:00:00Z',
            },
          },
        },
      },
    },
  }

  const reusableResponses: Record<string, unknown> = {}
  for (const operation of generatedOperations(document)) {
    if (!isRecord(operation.responses)) {
      continue
    }
    for (const [status, definition] of Object.entries(definitions)) {
      const response = operation.responses[status]
      if (!isRecord(response)) {
        continue
      }

      const normalizedResponse: Record<string, unknown> = {
        description: definition.description,
      }
      if (status === '429' && isRecord(response.headers)) {
        normalizedResponse.headers = response.headers
      }
      normalizedResponse.content = {
        [definition.mediaType]: {
          schema: {
            $ref: `#/components/schemas/${definition.schema}`,
          },
          examples: definition.examples,
        },
      }
      reusableResponses[definition.name] = normalizedResponse
      operation.responses[status] = {
        $ref: `#/components/responses/${definition.name}`,
      }
    }
  }

  document.components = document.components ?? {}
  document.components.responses = reusableResponses as OpenAPIObject['components']['responses']
}

function alignGeneratedHeaders(document: OpenAPIObject): void {
  document.components = document.components ?? {}
  document.components.headers = {
    ETag: {
      required: true,
      description: 'Entity tag representing the returned widget version.',
      schema: {
        type: 'string',
        example: '"u6I3AI8rSnvR3uOSYVQbPiZF7cP8fIQ77U1zba2tI8A"',
      },
    },
  }

  for (const operation of generatedOperations(document)) {
    if (!isRecord(operation.responses)) {
      continue
    }
    for (const response of Object.values(operation.responses)) {
      if (!isRecord(response) || !isRecord(response.headers) || !response.headers.ETag) {
        continue
      }
      response.headers.ETag = {
        $ref: '#/components/headers/ETag',
      }
    }
  }
}

function alignGeneratedSuccessContent(document: OpenAPIObject): void {
  for (const operation of generatedOperations(document)) {
    const operationId = operation.operationId
    if (typeof operationId !== 'string') {
      continue
    }

    const requestContent = isRecord(operation.requestBody)
      ? operation.requestBody.content
      : undefined
    const requestMedia = isRecord(requestContent) ? requestContent['application/json'] : undefined
    const requestExamples = isRecord(requestMedia) ? requestMedia.examples : undefined

    if (operationId === 'createSdxWidget' && isRecord(requestMedia) && isRecord(requestExamples)) {
      requestMedia.examples = renameKey(requestExamples, 'createWidget', 'createActiveWidget')
    }
    if (operationId === 'updateSdxWidget' && isRecord(requestMedia) && isRecord(requestExamples)) {
      requestMedia.examples = renameKey(requestExamples, 'updateWidget', 'archiveWidget')
    }
    if (
      operationId === 'adminCreateSubjectSdxWidget' &&
      isRecord(requestMedia) &&
      isRecord(requestExamples)
    ) {
      requestMedia.examples = renameKey(
        requestExamples,
        'adminCreateSubjectWidget',
        'createWidgetForSubject',
      )
    }
    if (
      operationId === 'adminUpdateSdxWidget' &&
      isRecord(requestMedia) &&
      isRecord(requestExamples)
    ) {
      requestMedia.examples = renameKey(requestExamples, 'adminUpdateWidget', 'adminArchiveWidget')
    }

    if (!isRecord(operation.responses)) {
      continue
    }
    const successResponse = operation.responses['200'] ?? operation.responses['201']
    if (!isRecord(successResponse)) {
      continue
    }
    const content = successResponse.content
    const media = isRecord(content) ? content['application/json'] : undefined
    const examples = isRecord(media) ? media.examples : undefined

    if (operationId === 'createSdxWidget') {
      successResponse.description = 'The created SDX Widget for the authenticated subject.'
    }
    if (operationId === 'adminCreateSubjectSdxWidget') {
      successResponse.description = 'The created SDX Widget for the requested subject.'
      if (isRecord(media) && isRecord(examples)) {
        media.examples = renameKey(examples, 'createdWidget', 'createdWidgetForSubject')
        const example = media.examples
        if (isRecord(example) && isRecord(example.createdWidgetForSubject)) {
          example.createdWidgetForSubject.summary = 'Created widget for a subject'
        }
      }
    }
    if (operationId === 'adminGetSdxWidget' && isRecord(media) && isRecord(examples)) {
      media.examples = renameKey(examples, 'requestedWidget', 'adminRequestedWidget')
      const example = media.examples
      if (isRecord(example) && isRecord(example.adminRequestedWidget)) {
        example.adminRequestedWidget.summary = 'Requested widget across subjects'
      }
    }
  }
}

function renameKey(
  value: Record<string, unknown>,
  currentKey: string,
  replacementKey: string,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(value, currentKey)) {
    return value
  }
  const renamed: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    renamed[key === currentKey ? replacementKey : key] = entry
  }
  return renamed
}

function generatedOperations(document: OpenAPIObject): Record<string, unknown>[] {
  const operations: Record<string, unknown>[] = []
  for (const pathItem of Object.values(document.paths)) {
    const record = pathItem as Record<string, unknown>
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (isRecord(record[method])) {
        operations.push(record[method] as Record<string, unknown>)
      }
    }
  }
  return operations
}

function errorExample(error: string, message: string): Record<string, unknown> {
  return {
    error,
    message,
    details: {
      correlationId: 'sdxw-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
    },
  }
}

function orderGeneratedOperations(document: OpenAPIObject): void {
  const operationOrder = [
    'tags',
    'operationId',
    'summary',
    'description',
    'parameters',
    'security',
    'requestBody',
    'responses',
  ]
  const responseOrder = [
    '200',
    '201',
    '204',
    '400',
    '422',
    '409',
    '412',
    '401',
    '403',
    '404',
    '429',
    '500',
  ]

  for (const pathItem of Object.values(document.paths)) {
    const record = pathItem as Record<string, unknown>
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = record[method]
      if (!isRecord(operation)) {
        continue
      }

      if (isRecord(operation.responses)) {
        operation.responses = orderKeys(operation.responses, responseOrder)
        for (const response of Object.values(operation.responses)) {
          if (isRecord(response)) {
            response.content = orderGeneratedContent(response.content)
            Object.assign(response, orderKeys(response, ['description', 'headers', 'content']))
          }
        }
      }

      if (isRecord(operation.requestBody)) {
        operation.requestBody.content = orderGeneratedContent(operation.requestBody.content)
        Object.assign(
          operation.requestBody,
          orderKeys(operation.requestBody, ['required', 'content']),
        )
      }

      Object.assign(operation, orderKeys(operation, operationOrder))
    }
  }
}

function orderGeneratedComponents(document: OpenAPIObject): void {
  const components = document.components as Record<string, unknown> | undefined
  if (!components) {
    return
  }

  for (const group of Object.values(components)) {
    if (!isRecord(group)) {
      continue
    }
    for (const value of Object.values(group)) {
      if (isRecord(value)) {
        value.content = orderGeneratedContent(value.content)
        Object.assign(
          value,
          orderKeys(value, ['title', 'description', 'type', 'example', 'required', 'properties']),
        )
      }
    }
  }

  document.components = orderKeys(components, [
    'securitySchemes',
    'headers',
    'parameters',
    'responses',
    'schemas',
  ]) as OpenAPIObject['components']
}

function orderOpenApiDocument(document: OpenAPIObject): void {
  const ordered = orderKeys(document as unknown as Record<string, unknown>, [
    'openapi',
    'info',
    'servers',
    'tags',
    'security',
    'paths',
    'components',
  ])
  for (const key of Object.keys(document)) {
    delete (document as unknown as Record<string, unknown>)[key]
  }
  Object.assign(document, ordered)
}

function orderGeneratedContent(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  for (const mediaType of Object.values(value)) {
    if (isRecord(mediaType)) {
      Object.assign(mediaType, orderKeys(mediaType, ['schema', 'examples', 'example']))
    }
  }

  return orderKeys(value, ['application/json', 'application/problem+json'])
}

function orderKeys<T extends Record<string, unknown>>(value: T, preferredOrder: string[]): T {
  const ordered: Record<string, unknown> = {}
  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      ordered[key] = value[key]
    }
  }
  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = value[key]
    }
  }
  return ordered as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
