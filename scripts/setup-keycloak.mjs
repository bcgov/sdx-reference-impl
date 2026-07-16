#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'

const WIDGET_SCOPES = [
  'nrs:widgets:read',
  'nrs:widgets:create',
  'nrs:widgets:update',
  'nrs:widgets:delete',
]

const DEFAULTS = {
  adminRealm: 'master',
  environment: 'local',
  frontendOrigin: 'http://localhost:3000',
  providerApiOrigin: 'http://localhost:3002',
  providerSdxApiOrigin: 'http://localhost:3003',
}

function usage() {
  console.log(`Configure Keycloak clients using the Keycloak Admin REST API.

Usage:
  node scripts/setup-keycloak.mjs \\
    --url <keycloak-base-url> \\
    --realm <realm> \\
    --admin-username <username> \\
    --admin-password <password>

Options:
  --admin-realm <realm>        Admin login realm. Default: master
  --environment <name>         Environment name used as the client ID prefix and
                               default output file suffix. Default: local
  --bff-client-id <client-id>  Explicit confidential BFF client ID
  --provider-service-client-id <client-id>
                               Explicit provider-sdx-api service client ID
  --provider-api-swagger-client-id <client-id>
                               Explicit provider-api Swagger public client ID
  --provider-sdx-api-swagger-client-id <client-id>
                               Explicit provider-sdx-api Swagger public client ID
  --env-file <path>            Env file to update. Default: .env.<environment>
  --frontend-origin <url>      Frontend origin. Default: http://localhost:3000
  --provider-api-public-url <url>
                               Provider API public URL, optionally including a path.
                               Default: http://localhost:3002
  --provider-sdx-api-public-url <url>
                               Provider SDX API public URL, optionally including a path.
                               Default: http://localhost:3003
  --provider-api-origin <url>  Provider API origin. Default: http://localhost:3002
                               Deprecated; use --provider-api-public-url.
  --provider-sdx-api-origin <url>
                               Provider SDX API origin. Default: http://localhost:3003
                               Deprecated; use --provider-sdx-api-public-url.

Environment variable fallbacks:
  KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_USERNAME,
  KEYCLOAK_ADMIN_PASSWORD, KEYCLOAK_ADMIN_REALM, KEYCLOAK_ENVIRONMENT,
  KEYCLOAK_BFF_CLIENT_ID, KEYCLOAK_PROVIDER_SERVICE_CLIENT_ID,
  KEYCLOAK_PROVIDER_API_SWAGGER_CLIENT_ID,
  KEYCLOAK_PROVIDER_SDX_API_SWAGGER_CLIENT_ID,
  PROVIDER_API_PUBLIC_URL, PROVIDER_SDX_API_PUBLIC_URL
`)
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    const key = arg.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args[key] = value
    index += 1
  }
  return args
}

function envOrArg(args, argName, envName, defaultValue) {
  return args[argName] ?? process.env[envName] ?? defaultValue
}

function requireValue(name, value) {
  if (!value) {
    throw new Error(`Missing required value: ${name}`)
  }
  return value
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function normalizePublicUrl(value) {
  return trimTrailingSlash(value)
}

function publicUrlOrigin(value) {
  return new URL(value).origin
}

function publicUrlBasePath(value) {
  const pathname = new URL(value).pathname.replace(/\/+$/, '')
  return pathname === '/' ? '' : pathname
}

function joinUrlPath(baseUrl, ...parts) {
  const path = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return path ? `${trimTrailingSlash(baseUrl)}/${path}` : trimTrailingSlash(baseUrl)
}

function prefixedClientId(environment, suffix) {
  return environment ? `${environment}-${suffix}` : suffix
}

function clientIdsFromConfig(args, environment) {
  return {
    bff: envOrArg(
      args,
      'bff-client-id',
      'KEYCLOAK_BFF_CLIENT_ID',
      prefixedClientId(environment, 'widget-bff'),
    ),
    providerService: envOrArg(
      args,
      'provider-service-client-id',
      'KEYCLOAK_PROVIDER_SERVICE_CLIENT_ID',
      prefixedClientId(environment, 'provider-sdx-api'),
    ),
    providerApiSwagger: envOrArg(
      args,
      'provider-api-swagger-client-id',
      'KEYCLOAK_PROVIDER_API_SWAGGER_CLIENT_ID',
      prefixedClientId(environment, 'provider-api-swagger'),
    ),
    providerSdxApiSwagger: envOrArg(
      args,
      'provider-sdx-api-swagger-client-id',
      'KEYCLOAK_PROVIDER_SDX_API_SWAGGER_CLIENT_ID',
      prefixedClientId(environment, 'provider-sdx-api-swagger'),
    ),
  }
}

function encodePathPart(value) {
  return encodeURIComponent(value)
}

function formBody(values) {
  return new URLSearchParams(values).toString()
}

async function keycloakRequest({ baseUrl, token, path, method = 'GET', body, form, ok = [200] }) {
  const headers = {}
  let requestBody

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  if (form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    requestBody = formBody(form)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: requestBody,
  })

  const text = await response.text()
  let parsed
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!ok.includes(response.status)) {
    const details = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    throw new Error(`${method} ${path} failed with ${response.status}: ${details}`)
  }

  return { status: response.status, body: parsed }
}

async function getAdminToken({ baseUrl, adminRealm, username, password }) {
  const response = await keycloakRequest({
    baseUrl,
    path: `/realms/${encodePathPart(adminRealm)}/protocol/openid-connect/token`,
    method: 'POST',
    form: {
      grant_type: 'password',
      client_id: 'admin-cli',
      username,
      password,
    },
  })

  if (!response.body?.access_token) {
    throw new Error('Keycloak token response did not include an access_token')
  }

  return response.body.access_token
}

async function ensureRealm(context) {
  const realmPath = `/admin/realms/${encodePathPart(context.realm)}`
  const existing = await keycloakRequest({
    ...context,
    path: realmPath,
    ok: [200, 404],
  })

  if (existing.status === 404) {
    await keycloakRequest({
      ...context,
      path: '/admin/realms',
      method: 'POST',
      ok: [201],
      body: {
        realm: context.realm,
        enabled: true,
      },
    })
    console.log(`Created realm ${context.realm}`)
    return
  }

  await keycloakRequest({
    ...context,
    path: realmPath,
    method: 'PUT',
    ok: [204],
    body: {
      ...existing.body,
      enabled: true,
    },
  })
  console.log(`Updated realm ${context.realm}`)
}

async function findClientScope(context, name) {
  const response = await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/client-scopes?search=${encodeURIComponent(name)}`,
  })
  return response.body.find((scope) => scope.name === name)
}

async function ensureClientScope(context, name) {
  const existing = await findClientScope(context, name)
  const representation = {
    name,
    protocol: 'openid-connect',
    attributes: {
      'display.on.consent.screen': 'true',
      'include.in.token.scope': 'true',
    },
  }

  if (!existing) {
    await keycloakRequest({
      ...context,
      path: `/admin/realms/${encodePathPart(context.realm)}/client-scopes`,
      method: 'POST',
      ok: [201],
      body: representation,
    })
    const created = await findClientScope(context, name)
    console.log(`Created client scope ${name}`)
    return created
  }

  await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/client-scopes/${encodePathPart(existing.id)}`,
    method: 'PUT',
    ok: [204],
    body: {
      ...existing,
      ...representation,
      attributes: {
        ...existing.attributes,
        ...representation.attributes,
      },
    },
  })
  console.log(`Updated client scope ${name}`)
  return { ...existing, ...representation }
}

async function findClient(context, clientId) {
  const response = await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/clients?clientId=${encodeURIComponent(clientId)}`,
  })
  return response.body.find((client) => client.clientId === clientId)
}

function clientRepresentation(config) {
  return {
    clientId: config.clientId,
    name: config.name,
    enabled: true,
    protocol: 'openid-connect',
    publicClient: config.publicClient,
    bearerOnly: false,
    standardFlowEnabled: config.standardFlowEnabled,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: config.serviceAccountsEnabled,
    clientAuthenticatorType: config.publicClient ? undefined : 'client-secret',
    redirectUris: config.redirectUris,
    webOrigins: config.webOrigins,
    rootUrl: config.rootUrl,
    baseUrl: config.baseUrl,
    attributes: {
      'pkce.code.challenge.method': 'S256',
      'oauth2.device.authorization.grant.enabled': 'false',
      'oidc.ciba.grant.enabled': 'false',
    },
  }
}

async function ensureClient(context, config) {
  const existing = await findClient(context, config.clientId)
  const representation = clientRepresentation(config)

  if (!existing) {
    await keycloakRequest({
      ...context,
      path: `/admin/realms/${encodePathPart(context.realm)}/clients`,
      method: 'POST',
      ok: [201],
      body: representation,
    })
    console.log(`Created client ${config.clientId}`)
    return findClient(context, config.clientId)
  }

  await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/clients/${encodePathPart(existing.id)}`,
    method: 'PUT',
    ok: [204],
    body: {
      ...existing,
      ...representation,
      attributes: {
        ...existing.attributes,
        ...representation.attributes,
      },
    },
  })
  console.log(`Updated client ${config.clientId}`)
  return { ...existing, ...representation, id: existing.id }
}

async function assignOptionalClientScope(context, client, scope) {
  await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/clients/${encodePathPart(client.id)}/optional-client-scopes/${encodePathPart(scope.id)}`,
    method: 'PUT',
    ok: [204, 409],
  })
}

async function getClientSecret(context, client) {
  const response = await keycloakRequest({
    ...context,
    path: `/admin/realms/${encodePathPart(context.realm)}/clients/${encodePathPart(client.id)}/client-secret`,
  })
  if (!response.body?.value) {
    throw new Error(`Client ${client.clientId} did not return a client secret`)
  }
  return response.body.value
}

function shellQuote(value) {
  if (value === '') {
    return ''
  }

  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value
  }

  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

async function writeGeneratedEnvFile(path, values) {
  const lines = ['# Keycloak config generated by scripts/setup-keycloak.mjs']
  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${shellQuote(value)}`)
  }

  await writeFile(path, `${lines.join('\n')}\n`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  const baseUrl = trimTrailingSlash(
    requireValue('Keycloak URL (--url or KEYCLOAK_URL)', envOrArg(args, 'url', 'KEYCLOAK_URL')),
  )
  const realm = requireValue(
    'realm (--realm or KEYCLOAK_REALM)',
    envOrArg(args, 'realm', 'KEYCLOAK_REALM'),
  )
  const adminRealm = envOrArg(args, 'admin-realm', 'KEYCLOAK_ADMIN_REALM', DEFAULTS.adminRealm)
  const username = requireValue(
    'admin username (--admin-username or KEYCLOAK_ADMIN_USERNAME)',
    envOrArg(args, 'admin-username', 'KEYCLOAK_ADMIN_USERNAME'),
  )
  const password = requireValue(
    'admin password (--admin-password or KEYCLOAK_ADMIN_PASSWORD)',
    envOrArg(args, 'admin-password', 'KEYCLOAK_ADMIN_PASSWORD'),
  )
  const environment = envOrArg(args, 'environment', 'KEYCLOAK_ENVIRONMENT', DEFAULTS.environment)
  const envFile = envOrArg(args, 'env-file', 'KEYCLOAK_ENV_FILE', `.env.${environment}`)
  const frontendOrigin = trimTrailingSlash(
    envOrArg(args, 'frontend-origin', 'FRONTEND_ORIGIN', DEFAULTS.frontendOrigin),
  )
  const providerApiPublicUrl = normalizePublicUrl(
    args['provider-api-public-url'] ??
      process.env.PROVIDER_API_PUBLIC_URL ??
      envOrArg(args, 'provider-api-origin', 'PROVIDER_API_ORIGIN', DEFAULTS.providerApiOrigin),
  )
  const providerSdxApiPublicUrl = normalizePublicUrl(
    args['provider-sdx-api-public-url'] ??
      process.env.PROVIDER_SDX_API_PUBLIC_URL ??
      envOrArg(
        args,
        'provider-sdx-api-origin',
        'PROVIDER_SDX_API_ORIGIN',
        DEFAULTS.providerSdxApiOrigin,
      ),
  )
  const providerApiWebOrigin = publicUrlOrigin(providerApiPublicUrl)
  const providerSdxApiWebOrigin = publicUrlOrigin(providerSdxApiPublicUrl)
  const providerApiPublicBasePath = publicUrlBasePath(providerApiPublicUrl)
  const providerSdxApiPublicBasePath = publicUrlBasePath(providerSdxApiPublicUrl)
  const providerApiSwaggerRedirectUrl = joinUrlPath(
    providerApiPublicUrl,
    'api/docs/oauth2-redirect.html',
  )
  const providerSdxApiSwaggerRedirectUrl = joinUrlPath(
    providerSdxApiPublicUrl,
    'api/docs/oauth2-redirect.html',
  )
  const clients = clientIdsFromConfig(args, environment)

  const token = await getAdminToken({ baseUrl, adminRealm, username, password })
  const context = { baseUrl, realm, token }
  const authority = `${baseUrl}/realms/${realm}`
  const scopeValue = `openid profile ${WIDGET_SCOPES.join(' ')}`

  await ensureRealm(context)
  const widgetScopes = []
  for (const scopeName of WIDGET_SCOPES) {
    widgetScopes.push(await ensureClientScope(context, scopeName))
  }

  const bffClient = await ensureClient(context, {
    clientId: clients.bff,
    name: `${clients.bff} BFF`,
    publicClient: false,
    standardFlowEnabled: true,
    serviceAccountsEnabled: false,
    redirectUris: [`${frontendOrigin}/api/auth/callback`],
    webOrigins: [frontendOrigin],
    rootUrl: frontendOrigin,
    baseUrl: frontendOrigin,
  })

  const providerServiceClient = await ensureClient(context, {
    clientId: clients.providerService,
    name: `${clients.providerService} service client`,
    publicClient: false,
    standardFlowEnabled: false,
    serviceAccountsEnabled: true,
    redirectUris: [],
    webOrigins: [],
  })

  const providerApiSwaggerClient = await ensureClient(context, {
    clientId: clients.providerApiSwagger,
    name: `${clients.providerApiSwagger} Swagger`,
    publicClient: true,
    standardFlowEnabled: true,
    serviceAccountsEnabled: false,
    redirectUris: [providerApiSwaggerRedirectUrl],
    webOrigins: [providerApiWebOrigin],
    rootUrl: providerApiPublicUrl,
    baseUrl: joinUrlPath(providerApiPublicUrl, 'api/docs'),
  })

  const providerSdxApiSwaggerClient = await ensureClient(context, {
    clientId: clients.providerSdxApiSwagger,
    name: `${clients.providerSdxApiSwagger} Swagger`,
    publicClient: true,
    standardFlowEnabled: true,
    serviceAccountsEnabled: false,
    redirectUris: [providerSdxApiSwaggerRedirectUrl],
    webOrigins: [providerSdxApiWebOrigin],
    rootUrl: providerSdxApiPublicUrl,
    baseUrl: joinUrlPath(providerSdxApiPublicUrl, 'api/docs'),
  })

  for (const client of [bffClient, providerApiSwaggerClient, providerSdxApiSwaggerClient]) {
    for (const scope of widgetScopes) {
      await assignOptionalClientScope(context, client, scope)
    }
  }

  const bffSecret = await getClientSecret(context, bffClient)
  const providerServiceSecret = await getClientSecret(context, providerServiceClient)

  await writeGeneratedEnvFile(envFile, {
    OIDC_AUTHORITY: authority,
    OIDC_OPENID_CONNECT_URL: '',
    BFF_OIDC_CLIENT_ID: clients.bff,
    BFF_OIDC_CLIENT_SECRET: bffSecret,
    BFF_OIDC_SCOPE: scopeValue,
    BFF_OIDC_REDIRECT_URI: `${frontendOrigin}/api/auth/callback`,
    PROVIDER_API_ALLOWED_CLIENT_IDS: clients.providerService,
    PROVIDER_SDX_API_CLIENT_ID: clients.providerService,
    PROVIDER_SDX_API_CLIENT_SECRET: providerServiceSecret,
    PROVIDER_SDX_API_TOKEN_SCOPE: '',
    PROVIDER_SDX_API_TOKEN_URL: '',
    PROVIDER_API_PUBLIC_BASE_PATH: providerApiPublicBasePath,
    PROVIDER_SDX_API_PUBLIC_BASE_PATH: providerSdxApiPublicBasePath,
    PROVIDER_API_JWT_ISSUER: authority,
    PROVIDER_SDX_API_JWT_ISSUER: '',
    PROVIDER_API_SWAGGER_OAUTH_CLIENT_ID: clients.providerApiSwagger,
    PROVIDER_API_SWAGGER_OAUTH_REDIRECT_URL: providerApiSwaggerRedirectUrl,
    PROVIDER_API_SWAGGER_OAUTH_SCOPES: scopeValue,
    PROVIDER_SDX_API_SWAGGER_OAUTH_CLIENT_ID: clients.providerSdxApiSwagger,
    PROVIDER_SDX_API_SWAGGER_OAUTH_REDIRECT_URL: providerSdxApiSwaggerRedirectUrl,
    PROVIDER_SDX_API_SWAGGER_OAUTH_SCOPES: scopeValue,
  })

  console.log(`Updated ${envFile} with Keycloak client configuration.`)
  console.log('')
  console.log(`Environment: ${environment}`)
  console.log('Configured client IDs:')
  console.log(`  BFF: ${clients.bff}`)
  console.log(`  Provider service: ${clients.providerService}`)
  console.log(`  Provider API Swagger: ${clients.providerApiSwagger}`)
  console.log(`  Provider SDX API Swagger: ${clients.providerSdxApiSwagger}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
