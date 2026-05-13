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

const apiDescription = `Reference Resource Server API for managing SDX Widgets.

Normal user endpoints derive widget ownership from the authenticated subject in the JWT \`sub\` claim. Callers cannot set or change the subject through user-facing paths or request bodies.

Authorization is layered. OAuth2 scopes authorize the client/token to invoke API operations, while the Resource Server separately enforces subject, tenant, resource ownership, delegation, role, ACL, or policy-based access rules.

Scope names use the format \`<PrivacyZone>.<resource-type>.<action>\`. For this reference implementation, the privacy zone is \`SDX-RI\`, the resource type is \`sdx-widgets\`, and standard actions are \`read\`, \`create\`, \`update\`, and \`delete\`. Administrative operations are consolidated under the \`admin\` action.

The SDX Widget scopes are \`SDX-RI.sdx-widgets.read\`, \`SDX-RI.sdx-widgets.create\`, \`SDX-RI.sdx-widgets.update\`, \`SDX-RI.sdx-widgets.delete\`, and \`SDX-RI.sdx-widgets.admin\`.

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
    .setTitle('SDX Reference Implementation API - SDX Widgets')
    .setDescription(apiDescription)
    .setVersion('0.1.0')
    .setContact('SDX Reference Implementation Maintainers', '', '')
    .setLicense('Apache-2.0', '')
    .addServer('http://localhost:3000/api/v1', 'Local development')
    .addTag(
      'Admin SDX Widgets',
      'Administrative SDX Widget operations that can act across subjects.',
    )
    .addTag(
      'SDX Widgets',
      'SDX Widget operations that act on resources owned by the authenticated subject.',
    )
    .addSecurity('oidc', {
      type: 'oauth2',
      description:
        'OIDC/OAuth2 bearer token security. Placeholder URLs must be configured for the SDX/Common SSO issuer in each environment. Discovery URL: https://oidc.example.gov.bc.ca/.well-known/openid-configuration.',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://oidc.example.gov.bc.ca/oauth2/authorize',
          tokenUrl: 'https://oidc.example.gov.bc.ca/oauth2/token',
          scopes: {
            'SDX-RI.sdx-widgets.read': 'Read SDX Widgets for the authenticated subject.',
            'SDX-RI.sdx-widgets.create': 'Create SDX Widgets for the authenticated subject.',
            'SDX-RI.sdx-widgets.update': 'Update SDX Widgets for the authenticated subject.',
            'SDX-RI.sdx-widgets.delete': 'Delete SDX Widgets for the authenticated subject.',
            'SDX-RI.sdx-widgets.admin': 'Administer SDX Widgets across subjects.',
          },
        },
      },
    })
    .addSecurityRequirements('oidc', ['SDX-RI.sdx-widgets.read'])
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
