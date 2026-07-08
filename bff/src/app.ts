import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { customLogger } from './common/logger.config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { VersioningType } from '@nestjs/common'
import { metricsMiddleware } from './middleware/prom'
import { WidgetsModule } from './widgets/widgets.module'
import { BffAuthModule } from './auth/bff-auth.module'

const apiDescription = `Backend-for-frontend API for the SDX Reference Implementation UI.

The BFF starts Authorization Code with PKCE login, exchanges the authorization code with a confidential client, maintains the user's server-side session with an HttpOnly cookie, and proxies Widget calls to the SDX-facing provider API.`

const API_PREFIX = 'api'
const API_VERSION_PREFIX = 'v'

export async function bootstrap() {
  const publicBasePath = normalizePublicBasePath(process.env.PUBLIC_BASE_PATH)
  const apiPrefix = joinPaths(publicBasePath, API_PREFIX).replace(/^\//, '')
  const apiPath = joinPaths(publicBasePath, API_PREFIX)
  const apiServerPath = joinPaths(publicBasePath, API_PREFIX, 'v1')
  const swaggerDocsPath = joinPaths(publicBasePath, API_PREFIX, 'docs')
  const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: customLogger,
  })
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'"],
        },
      },
      crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups',
      },
    }),
  )
  app.enableCors({
    credentials: true,
    origin: true,
  })
  app.set('trust proxy', 1)
  app.use(metricsMiddleware)
  app.enableShutdownHooks()
  app.setGlobalPrefix(apiPrefix)
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: API_VERSION_PREFIX,
  })

  const config = new DocumentBuilder()
    .setTitle('SDX Reference Implementation BFF - Widgets')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', undefined as any, undefined as any)
    .setLicense('Apache-2.0', undefined as any)
    .addServer(apiPath, 'BFF auth endpoints on the same origin as this documentation')
    .addServer(apiServerPath, 'BFF Widget API on the same origin as this documentation')
    .addTag('BFF Auth', 'BFF login, callback, session, and logout endpoints.')
    .addTag('BFF Widgets', 'Widget calls proxied through the BFF session.')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [BffAuthModule, WidgetsModule],
  })
  SwaggerModule.setup(swaggerDocsPath, app, document)
  return app
}

function normalizePublicBasePath(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '/') {
    return ''
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

function joinPaths(...parts: string[]): string {
  const joined = parts
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return joined ? `/${joined}` : '/'
}
