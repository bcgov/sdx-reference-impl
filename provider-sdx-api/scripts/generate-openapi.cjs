const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const yaml = require('@stoplight/yaml')

if (process.env.OPENAPI_OIDC_AUTHORITY) {
  process.env.OIDC_AUTHORITY = process.env.OPENAPI_OIDC_AUTHORITY
  delete process.env.OIDC_OPENID_CONNECT_URL
}

const { bootstrap } = require('../dist/src/app.js')

const port = Number.parseInt(process.env.OPENAPI_EXPORT_PORT || '3107', 10)
const host = process.env.OPENAPI_EXPORT_HOST || '127.0.0.1'
const discoveryPort = Number.parseInt(process.env.OPENAPI_DISCOVERY_PORT || `${port + 1}`, 10)
const jsonOutputPath = path.resolve(__dirname, '../openapi/widgets.generated.openapi.json')
const yamlOutputPath = path.resolve(__dirname, '../openapi/widgets.generated.openapi.yaml')

async function main() {
  const discoveryServer = await startFallbackDiscoveryServer()
  const app = await bootstrap()
  const server = await app.listen(port, host)

  try {
    const openapi = await getJson(`http://${host}:${port}/api/docs-json`)
    fs.writeFileSync(jsonOutputPath, `${JSON.stringify(openapi, null, 2)}\n`, 'utf8')
    fs.writeFileSync(yamlOutputPath, yaml.safeStringify(openapi, 2, 100), 'utf8')
    console.log(`Generated OpenAPI JSON written to ${jsonOutputPath}`)
    console.log(`Generated OpenAPI YAML written to ${yamlOutputPath}`)
  } finally {
    await app.close()
    server.close?.()
    discoveryServer?.close()
  }
}

function startFallbackDiscoveryServer() {
  if (
    process.env.OIDC_OPENID_CONNECT_URL ||
    process.env.OIDC_AUTHORITY ||
    process.env.OPENAPI_OIDC_AUTHORITY
  ) {
    return Promise.resolve(undefined)
  }

  process.env.OIDC_OPENID_CONNECT_URL = `http://${host}:${discoveryPort}/.well-known/openid-configuration`
  const discovery = JSON.stringify({
    authorization_endpoint: 'https://identity.example.com/realms/sdx/protocol/openid-connect/auth',
    token_endpoint: 'https://identity.example.com/realms/sdx/protocol/openid-connect/token',
  })

  return new Promise((resolve, reject) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(discovery)
    })
    server.on('error', reject)
    server.listen(discoveryPort, host, () => resolve(server))
  })
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`GET ${url} returned ${response.statusCode}`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('error', reject)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
