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

const apiDescription = `Reference Resource Server API for managing Widgets.

Normal user endpoints derive widget ownership from the authenticated JWT \`sub\` claim. Callers cannot set or change the subject through user-facing paths or request bodies.

Authorization is layered. OAuth2 scopes authorize the client/token to invoke API operations, while the Resource Server separately enforces subject, tenant, resource ownership, delegation, role, ACL, or policy-based access rules.

Future implementations may use CSTAR as an authorization facts provider and a policy engine as a policy decision point, with the Resource Server remaining the policy enforcement point.`

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
    .setTitle('SDX Reference Implementation Widget API')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', '', '')
    .setLicense('Apache-2.0', '')
    .addServer('http://localhost:3000/api/v1', 'Local development')
    .addTag('Admin Widgets', 'Administrative widget operations across subjects.')
    .addTag('Widgets', 'Caller-owned widget operations.')
    .addSecurity('oidc', {
      type: 'oauth2',
      description:
        'OIDC/OAuth2 bearer token security. Placeholder URLs must be configured for the SDX/Common SSO issuer in each environment. Discovery URL: https://oidc.example.gov.bc.ca/.well-known/openid-configuration.',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://oidc.example.gov.bc.ca/oauth2/authorize',
          tokenUrl: 'https://oidc.example.gov.bc.ca/oauth2/token',
          scopes: {
            'widgets.read': 'Read widgets owned by the caller.',
            'widgets.write': 'Create, update, and delete widgets owned by the caller.',
            'widgets.admin': 'Administer widgets across subjects.',
          },
        },
      },
    })
    .addSecurityRequirements('oidc', ['widgets.read'])
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [WidgetsModule],
  })
  alignGeneratedWidgetSpec(document)
  SwaggerModule.setup('/api/docs', app, document)
  return app
}

function alignGeneratedWidgetSpec(document: OpenAPIObject) {
  const pathSummaries: Record<string, string> = {
    '/widgets': 'Manage caller-owned widgets.',
    '/widgets/{widgetId}': 'Manage one caller-owned widget.',
    '/admin/subjects/{subject}/widgets': 'Administer widgets for one subject.',
    '/admin/widgets/{widgetId}': 'Administer one widget by ID.',
  }

  document.paths = Object.fromEntries(
    Object.entries(document.paths).map(([path, pathItem]) => {
      const normalizedPath = path.replace(/^\/api\/v1/, '').replace(/^\/v1/, '')
      return [
        normalizedPath,
        {
          ...pathItem,
          summary: pathSummaries[normalizedPath],
        },
      ]
    }),
  )
}
