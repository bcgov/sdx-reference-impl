import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { OpenAPIObject } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { customLogger } from './common/logger.config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { VersioningType } from '@nestjs/common'
import { metricsMiddleware } from './middleware/prom'
import { WidgetsModule } from './widgets/widgets.module'
import { UsersModule } from './users/users.module'
import type { Response } from 'express'

const apiDescription = `Reference API for managing fictional Natural Resources widgets.

Normal user endpoints derive widget ownership from the authenticated subject in the JWT \`sub\` claim. Callers cannot set or change the subject through user-facing paths or request bodies.

Scope names use the format \`<namespace>:<resource>:<action>\`. For this API, the namespace is \`nrs\`, the resource is \`widgets\`, and standard actions are \`read\`, \`create\`, \`update\`, and \`delete\`. Administrative operations are consolidated under the \`admin\` action.

The Widget scopes are \`nrs:widgets:read\`, \`nrs:widgets:create\`, \`nrs:widgets:update\`, \`nrs:widgets:delete\`, and \`nrs:widgets:admin\`.`

const DEFAULT_OIDC_AUTHORITY = 'https://identity.example.com/realms/sdx'
const DEFAULT_SWAGGER_CLIENT_ID = 'widget-ui-sdx-reference-implementation-21920'
const DEFAULT_OIDC_SCOPES =
  'openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete nrs:widgets:admin'
const OAUTH_SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: 'Authenticate the user with OpenID Connect.',
  profile: "Read the user's basic profile claims.",
  'nrs:widgets:read': 'Read widgets.',
  'nrs:widgets:create': 'Create widgets.',
  'nrs:widgets:update': 'Update widgets.',
  'nrs:widgets:delete': 'Delete widgets.',
  'nrs:widgets:admin': 'Administer widgets across users.',
}
const SWAGGER_OAUTH_POPUP_SCRIPT_PATH = '/api/docs/swagger-oauth-popup.js'
const SWAGGER_OAUTH_REDIRECT_PATH = '/api/docs/oauth2-redirect.html'
const SWAGGER_OAUTH_CALLBACK_SCRIPT_PATH = '/api/docs/swagger-oauth-callback.js'
const SWAGGER_OAUTH_CHANNEL = 'swagger-oauth2'

/**
 *
 */
export async function bootstrap() {
  const oidcAuthority = process.env.OIDC_AUTHORITY?.trim() || DEFAULT_OIDC_AUTHORITY
  const openIdConnectUrl =
    process.env.OIDC_OPENID_CONNECT_URL?.trim() ||
    `${oidcAuthority.replace(/\/$/, '')}/.well-known/openid-configuration`
  const swaggerClientId =
    process.env.SWAGGER_OAUTH_CLIENT_ID?.trim() ||
    process.env.OIDC_CLIENT_ID?.trim() ||
    DEFAULT_SWAGGER_CLIENT_ID
  const swaggerOAuthRedirectUrl = process.env.SWAGGER_OAUTH_REDIRECT_URL?.trim()
  const swaggerOAuthScopes = (
    process.env.SWAGGER_OAUTH_SCOPES?.trim() ||
    process.env.OIDC_SCOPE?.trim() ||
    DEFAULT_OIDC_SCOPES
  )
    .split(/\s+/)
    .filter(Boolean)
  const oidcDiscovery = await loadOidcDiscovery(openIdConnectUrl)
  const oauthScopes = Object.fromEntries(
    swaggerOAuthScopes.map((scope) => [scope, OAUTH_SCOPE_DESCRIPTIONS[scope] || scope]),
  )
  const oidcOrigins = [
    ...new Set(
      [oidcDiscovery.authorization_endpoint, oidcDiscovery.token_endpoint].map(
        (endpoint) => new URL(endpoint).origin,
      ),
    ),
  ]
  const oidcAuthorizationOrigin = new URL(oidcDiscovery.authorization_endpoint).origin
  const swaggerOAuthPopupScript = createSwaggerOAuthPopupScript(oidcAuthorizationOrigin)
  const swaggerOAuthCallbackScript = createSwaggerOAuthCallbackScript()

  const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: customLogger,
  })
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", ...oidcOrigins],
        },
      },
      crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups',
      },
    }),
  )
  app.enableCors()
  app.set('trust proxy', 1)
  app.use(metricsMiddleware)
  app.enableShutdownHooks()
  app.setGlobalPrefix('api')
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  })
  app
    .getHttpAdapter()
    .get(SWAGGER_OAUTH_POPUP_SCRIPT_PATH, (_request: unknown, response: Response) => {
      response.type('application/javascript').send(swaggerOAuthPopupScript)
    })
  app
    .getHttpAdapter()
    .get(SWAGGER_OAUTH_CALLBACK_SCRIPT_PATH, (_request: unknown, response: Response) => {
      response.type('application/javascript').send(swaggerOAuthCallbackScript)
    })
  app.getHttpAdapter().get(SWAGGER_OAUTH_REDIRECT_PATH, (_request: unknown, response: Response) => {
    response.type('text/html').send(createSwaggerOAuthRedirectHtml())
  })
  const config = new DocumentBuilder()
    .setTitle('SDX Reference Implementation API - Widgets')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', undefined as any, undefined as any)
    .setLicense('Apache-2.0', undefined as any)

    .addServer('/api/v1', 'Widgets API on the same origin as this documentation')
    .addTag('Admin Users', 'Administrative discovery of users that own Widgets.')
    .addTag('Admin Widgets', 'Administrative Widget operations that can act across subjects.')
    .addTag(
      'Widgets',
      'Widget operations that act on resources owned by the authenticated subject.',
    )
    .addSecurity('openId', {
      type: 'oauth2',
      description: 'Access token with the scope specified by each operation.',
      flows: {
        authorizationCode: {
          authorizationUrl: oidcDiscovery.authorization_endpoint,
          tokenUrl: oidcDiscovery.token_endpoint,
          scopes: oauthScopes,
        },
      },
    })
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [WidgetsModule, UsersModule],
  })
  alignGeneratedWidgetSpec(document)
  SwaggerModule.setup('/api/docs', app, document, {
    customJs: SWAGGER_OAUTH_POPUP_SCRIPT_PATH,
    swaggerOptions: {
      persistAuthorization: true,
      ...(swaggerOAuthRedirectUrl ? { oauth2RedirectUrl: swaggerOAuthRedirectUrl } : {}),
      initOAuth: {
        clientId: swaggerClientId,
        usePkceWithAuthorizationCodeGrant: true,
        scopes: swaggerOAuthScopes,
      },
    },
  })
  return app
}

type OidcDiscovery = {
  authorization_endpoint: string
  token_endpoint: string
}

async function loadOidcDiscovery(openIdConnectUrl: string): Promise<OidcDiscovery> {
  const response = await fetch(openIdConnectUrl)
  if (!response.ok) {
    throw new Error(
      `Unable to load OIDC discovery document from ${openIdConnectUrl}: ${response.status} ${response.statusText}`,
    )
  }

  const discovery = (await response.json()) as Partial<OidcDiscovery>
  if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
    throw new Error(
      `OIDC discovery document at ${openIdConnectUrl} must define authorization_endpoint and token_endpoint`,
    )
  }

  new URL(discovery.authorization_endpoint)
  new URL(discovery.token_endpoint)
  return discovery as OidcDiscovery
}

function createSwaggerOAuthPopupScript(oidcOrigin: string) {
  return `(() => {
  const oidcOrigin = ${JSON.stringify(oidcOrigin)};
  const channel = new BroadcastChannel(${JSON.stringify(SWAGGER_OAUTH_CHANNEL)});
  const openWindow = window.open.bind(window);
  let authorizationCompleted = false;

  channel.addEventListener('message', (event) => {
    if (event.data?.type !== 'swagger-oauth-response' || authorizationCompleted) {
      return;
    }

    const oauth = window.swaggerUIRedirectOauth2;
    if (!oauth) {
      return;
    }
    authorizationCompleted = true;

    const responseUrl = new URL(event.data.url);
    const responseParams = new URLSearchParams(
      /code|token|error/.test(responseUrl.hash)
        ? responseUrl.hash.substring(1).replace('?', '&')
        : responseUrl.search.substring(1)
    );
    const token = Object.fromEntries(responseParams);
    const isValid = token.state === oauth.state;
    const flow = oauth.auth.schema.get('flow');
    const isAuthorizationCodeFlow =
      flow === 'accessCode' || flow === 'authorizationCode' || flow === 'authorization_code';

    if (!isAuthorizationCodeFlow || oauth.auth.code) {
      oauth.callback({
        auth: oauth.auth,
        token,
        isValid,
        redirectUrl: oauth.redirectUrl
      });
    } else {
      if (!isValid) {
        oauth.errCb({
          authId: oauth.auth.name,
          source: 'auth',
          level: 'warning',
          message:
            "Authorization may be unsafe, passed state was changed in server. " +
            "Passed state wasn't returned from auth server."
        });
      }

      if (token.code) {
        delete oauth.state;
        oauth.auth.code = token.code;
        oauth.callback({ auth: oauth.auth, redirectUrl: oauth.redirectUrl });
      } else {
        const message = token.error
          ? '[' + token.error + ']: ' +
            (token.error_description
              ? token.error_description + '. '
              : 'no accessCode received from the server. ') +
            (token.error_uri ? 'More info: ' + token.error_uri : '')
          : '[Authorization failed]: no accessCode received from the server';
        oauth.errCb({
          authId: oauth.auth.name,
          source: 'auth',
          level: 'error',
          message
        });
      }
    }

    channel.postMessage({ type: 'swagger-oauth-complete' });
  });

  window.open = (url, target, features) => {
    let destination;
    try {
      destination = new URL(String(url), window.location.href);
    } catch {
      return openWindow(url, target, features);
    }

    if (destination.origin !== oidcOrigin) {
      return openWindow(url, target, features);
    }

    const oauthWindow = openWindow(
      '',
      'swagger-oauth2',
      'popup=yes,width=700,height=800,resizable=yes,scrollbars=yes'
    );
    if (!oauthWindow) {
      return null;
    }

    try {
      oauthWindow.opener = window;
    } catch {
      // The opener is already established by window.open in normal browser configurations.
    }
    oauthWindow.location.href = destination.href;
    oauthWindow.focus();
    return oauthWindow;
  };
})();`
}

function createSwaggerOAuthCallbackScript() {
  return `(() => {
  const channel = new BroadcastChannel(${JSON.stringify(SWAGGER_OAUTH_CHANNEL)});
  let attempts = 0;

  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'swagger-oauth-complete') {
      window.close();
    }
  });

  const sendResponse = () => {
    channel.postMessage({
      type: 'swagger-oauth-response',
      url: window.location.href
    });
    attempts += 1;
    if (attempts < 10) {
      window.setTimeout(sendResponse, 250);
    }
  };

  sendResponse();
})();`
}

function createSwaggerOAuthRedirectHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Completing authorization</title>
  </head>
  <body>
    <p>Completing authorization...</p>
    <script src="${SWAGGER_OAUTH_CALLBACK_SCRIPT_PATH}"></script>
  </body>
</html>`
}

function alignGeneratedWidgetSpec(document: OpenAPIObject) {
  const pathSummaries: Record<string, string> = {
    '/widgets': 'Manage widgets for the authenticated subject.',
    '/widgets/{widgetId}': 'Manage one widget for the authenticated subject.',
    '/admin/subjects/{subject}/widgets': 'Administer widgets for one subject.',
    '/admin/widgets/{widgetId}': 'Administer one widget by ID.',
    '/admin/users': 'Discover users that currently own widgets.',
  }

  const orderedPaths = [
    '/widgets',
    '/widgets/{widgetId}',
    '/admin/subjects/{subject}/widgets',
    '/admin/widgets/{widgetId}',
    '/admin/users',
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

  schemas.WidgetStatus = {
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
    'Widget',
    'CreateWidgetRequest',
    'UpdateWidgetRequest',
    'PatchWidgetRequest',
    'AdminUpdateWidgetRequest',
    'AdminPatchWidgetRequest',
  ]) {
    const properties = schemas[schemaName]?.properties
    if (isRecord(properties) && isRecord(properties.status)) {
      properties.status = {
        $ref: '#/components/schemas/WidgetStatus',
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
          $ref: '#/components/schemas/WidgetStatus',
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
    'CreateWidgetRequest',
    'UpdateWidgetRequest',
    'PatchWidgetRequest',
    'AdminUpdateWidgetRequest',
    'AdminPatchWidgetRequest',
  ]) {
    if (schemas[schemaName]) {
      schemas[schemaName].additionalProperties = false
    }
  }
  if (schemas.PatchWidgetRequest) {
    schemas.PatchWidgetRequest.minProperties = 1
  }
  if (schemas.AdminPatchWidgetRequest) {
    schemas.AdminPatchWidgetRequest.minProperties = 1
  }

  Object.assign(schemas.Widget, {
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
  Object.assign(schemas.WidgetListResponse, {
    description: 'A paginated list of widgets with an optional cursor for the next page.',
    example: {
      items: [schemas.Widget.example],
      nextCursor: 'eyJvZmZzZXQiOjI1fQ',
    },
  })
  Object.assign(schemas.CreateWidgetRequest, {
    example: {
      name: 'Intake form',
      description: 'Widget used for intake workflow testing.',
      status: 'active',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.UpdateWidgetRequest, {
    example: {
      name: 'Intake form v2',
      description: 'Updated widget used for intake workflow testing.',
      status: 'inactive',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.PatchWidgetRequest, {
    example: { status: 'archived' },
  })
  Object.assign(schemas.AdminUpdateWidgetRequest, {
    example: {
      subject: 'user-456',
      name: 'Intake form v2',
      description: 'Updated widget used for intake workflow testing.',
      status: 'inactive',
      metadata: { source: 'local-dev' },
    },
  })
  Object.assign(schemas.AdminPatchWidgetRequest, {
    example: {
      subject: 'user-456',
      status: 'archived',
    },
  })
  Object.assign(schemas.UserSummary, {
    additionalProperties: false,
    example: {
      subject: 'user-123',
      displayName: 'Alex Smith',
      widgetCount: 3,
      lastSeenAt: '2026-06-11T15:00:00Z',
    },
  })
  Object.assign(schemas.ErrorResponse, {
    title: 'ErrorResponse',
    description:
      'Standard error response format for unexpected or server-side errors (e.g., 500 Internal Server Error, 403 Forbidden, 401 Unauthorized, etc.). This is used when a more structured Problem Details response (RFC 9457) is not appropriate or when the error is general rather than validation-specific. The `details.correlationId` value is used for support and log tracing. When an inbound `x-request-id` or `x-correlation-id` header is present, the API preserves that upstream value. When this API generates the value, it uses the `widget-<uuid>` format so logs show that Widgets created the correlation ID.',
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
          value: errorExample('not_found', 'Widget not found'),
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
          value: errorExample('conflict', 'Request conflicts with the current Widget state'),
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
              correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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
              correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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

    if (operationId === 'createWidget' && isRecord(requestMedia) && isRecord(requestExamples)) {
      requestMedia.examples = renameKey(requestExamples, 'createWidget', 'createActiveWidget')
    }
    if (operationId === 'updateWidget' && isRecord(requestMedia) && isRecord(requestExamples)) {
      requestMedia.examples = renameKey(requestExamples, 'updateWidget', 'archiveWidget')
    }
    if (
      operationId === 'adminCreateSubjectWidget' &&
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
      operationId === 'adminUpdateWidget' &&
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

    if (operationId === 'createWidget') {
      successResponse.description = 'The created Widget for the authenticated subject.'
    }
    if (operationId === 'adminCreateSubjectWidget') {
      successResponse.description = 'The created Widget for the requested subject.'
      if (isRecord(media) && isRecord(examples)) {
        media.examples = renameKey(examples, 'createdWidget', 'createdWidgetForSubject')
        const example = media.examples
        if (isRecord(example) && isRecord(example.createdWidgetForSubject)) {
          example.createdWidgetForSubject.summary = 'Created widget for a subject'
        }
      }
    }
    if (operationId === 'adminGetWidget' && isRecord(media) && isRecord(examples)) {
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
      correlationId: 'widget-2f7b8d43-7b0d-4b5f-8a6c-1a2b3c4d5e6f',
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
