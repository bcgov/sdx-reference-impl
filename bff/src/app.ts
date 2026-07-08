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

export async function bootstrap() {
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
  app.setGlobalPrefix('api')
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
  })

  const config = new DocumentBuilder()
    .setTitle('SDX Reference Implementation BFF - Widgets')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', undefined as any, undefined as any)
    .setLicense('Apache-2.0', undefined as any)
    .addServer('/api', 'BFF auth endpoints on the same origin as this documentation')
    .addServer('/api/v1', 'BFF Widget API on the same origin as this documentation')
    .addTag('BFF Auth', 'BFF login, callback, session, and logout endpoints.')
    .addTag('BFF Widgets', 'Widget calls proxied through the BFF session.')
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [BffAuthModule, WidgetsModule],
  })
  SwaggerModule.setup('/api/docs', app, document)
  return app
}
