# Keycloak OIDC Setup

This guide configures Keycloak for the Widget reference implementation using
the Keycloak Admin REST API.

Example values used below:

| Setting | Example |
| --- | --- |
| Keycloak admin console | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/admin/master/console/#/sdx` |
| Keycloak base URL | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth` |
| Realm | `sdx` |
| Frontend URL | `http://localhost:3000` |
| Local BFF client ID | `local-widget-bff` |
| Local provider service client ID | `local-provider-sdx-api` |
| Local provider API Swagger client ID | `local-provider-api-swagger` |
| Local provider SDX API Swagger client ID | `local-provider-sdx-api-swagger` |

The admin console URL is shown only to orient the realm. The setup script uses
the Keycloak Admin REST API. Replace the local URLs for each deployed
environment.

## Important Security Boundary

The BFF performs the OIDC authorization code exchange with a confidential
client, stores the user session in an HttpOnly cookie, and sends the user's
access token server-side to `provider-sdx-api`.

`provider-api` validates JWT signature, issuer, and expiry by default.
`provider-sdx-api` defaults to decoding JWTs without validation so it can sit
behind an SDX gateway during development. The same validation flags can be
enabled on either provider API. An API gateway should still:

1. Validate the JWT against Keycloak.
2. Verify the issuer and token lifetime.
3. Enforce the scope required by the requested API operation.

Do not expose `provider-sdx-api` without either a validating gateway or enabled
JWT signature, issuer, and expiry validation.

## 1. Run the Setup Script

Run the setup script with a Keycloak base URL, target realm, and admin
credentials. By default it creates clients with the `local` prefix:

```sh
node scripts/setup-keycloak.mjs \
  --url https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth \
  --realm sdx \
  --admin-username "<admin-username>" \
  --admin-password "<admin-password>"
```

The script is idempotent. It creates or updates:

- Realm `sdx`.
- Widget client scopes `nrs:widgets:read`, `nrs:widgets:create`,
  `nrs:widgets:update`, and `nrs:widgets:delete`.
- Confidential BFF client `<environment>-widget-bff`.
- Confidential service client `<environment>-provider-sdx-api`.
- Public Swagger OAuth client `<environment>-provider-api-swagger`.
- Public Swagger OAuth client `<environment>-provider-sdx-api-swagger`.

It then writes the generated client IDs and secrets to the selected env file.
The default output file is `.env.<environment>`. Docker Compose reads `.env` by
default, so copy or rename the generated file to `.env`, or pass it with
`docker compose --env-file`. The admin password is not written to disk.

Use a different environment name to change the generated client ID prefix and
output file:

```sh
node scripts/setup-keycloak.mjs \
  --url https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth \
  --realm sdx \
  --admin-username "<admin-username>" \
  --admin-password "<admin-password>" \
  --environment dev \
  --frontend-origin https://<frontend-host> \
  --provider-api-origin https://<provider-api-host> \
  --provider-sdx-api-origin https://<provider-sdx-api-host>
```

Or provide exact client IDs:

```sh
node scripts/setup-keycloak.mjs \
  --url https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth \
  --realm sdx \
  --admin-username "<admin-username>" \
  --admin-password "<admin-password>" \
  --bff-client-id "<bff-client-id>" \
  --provider-service-client-id "<service-client-id>" \
  --provider-api-swagger-client-id "<provider-api-swagger-client-id>" \
  --provider-sdx-api-swagger-client-id "<provider-sdx-api-swagger-client-id>"
```

The resulting OIDC authority URL is:

```text
https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx
```

Discovery metadata is available at:

```text
https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx/.well-known/openid-configuration
```

## 2. Clients Created by the Script

The BFF client is an OpenID Connect confidential client:

| Setting | Value |
| --- | --- |
| Client ID | `<environment>-widget-bff` unless explicitly provided |
| Standard flow | Enabled |
| Client authentication | Enabled |
| PKCE code challenge method | `S256` |
| Direct access grants | Disabled |
| Implicit flow | Disabled |
| Valid redirect URI | `<frontend-origin>/api/auth/callback` |
| Web origin | `<frontend-origin>` |

The service-to-service client is a confidential client:

| Setting | Value |
| --- | --- |
| Client ID | `<environment>-provider-sdx-api` unless explicitly provided |
| Client authentication | Enabled |
| Service accounts | Enabled |
| Standard flow | Disabled |
| Direct access grants | Disabled |
| Implicit flow | Disabled |

`provider-sdx-api` uses this client with the client-credentials grant to obtain
a real access token for calls to `provider-api`. There is no unsigned
development token fallback or static bearer-token override. The setup script
writes `PROVIDER_API_ALLOWED_CLIENT_IDS=<environment>-provider-sdx-api` so
`provider-api` accepts this service client.

For Swagger UI, the script creates separate public clients with authorization
code and PKCE:

| API | Client ID | Redirect URI |
| --- | --- | --- |
| `provider-api` | `<environment>-provider-api-swagger` | `<provider-api-origin>/api/docs/oauth2-redirect.html` |
| `provider-sdx-api` | `<environment>-provider-sdx-api-swagger` | `<provider-sdx-api-origin>/api/docs/oauth2-redirect.html` |

Add corresponding HTTPS URLs for DEV, TEST, and PROD when configuring deployed
clients. Prefer exact URLs over wildcards.

## 3. Widget Scopes

The setup script creates these OpenID Connect client scopes:

```text
nrs:widgets:read
nrs:widgets:create
nrs:widgets:update
nrs:widgets:delete
```

It assigns them to the configured BFF, provider API Swagger, and provider SDX
API Swagger clients as optional client scopes. Realm-level discovery does not
make a scope requestable by a client. Include them in `BFF_OIDC_SCOPE` and the
provider-specific Swagger scope variables so the BFF and Swagger explicitly
request them.

The access token's standard `scope` claim should contain the granted scopes:

```json
{
  "scope": "openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete"
}
```

The current operation mapping is:

| API operations | Required scope |
| --- | --- |
| List/get subject Widgets | `nrs:widgets:read` |
| Create subject Widgets | `nrs:widgets:create` |
| Replace/patch subject Widgets | `nrs:widgets:update` |
| Delete subject Widgets | `nrs:widgets:delete` |

The current bff still assumes the gateway has authorized requests and does
not enforce operation scopes itself. The scopes are requested now so access
tokens are ready for gateway enforcement.

## 4. Create Users

Create the users required for local testing. No application roles are required.

The Widgets API uses the access token's immutable `sub` claim as the Widget
owner identifier. A user's subject can be inspected by decoding their access
token.

Do not configure a mapper that replaces `sub` with a mutable username or email
address.

## 5. Configure the Local Stack

After running the setup script, start the stack:

```sh
docker compose up database migrations provider-api provider-sdx-api bff frontend
```

The frontend uses the same-origin BFF path `/api/v1`. The Caddy frontend image
serves that value through `/config.json` and proxies `/api` to `BFF_BASE_URL`.
Vite development uses the same browser path and proxies `/api` to `BFF_BASE_URL`.

The BFF container uses:

```text
OIDC_AUTHORITY=https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx
BFF_OIDC_CLIENT_ID=local-widget-bff
BFF_OIDC_CLIENT_SECRET=<bff-confidential-client-secret>
BFF_OIDC_SCOPE=openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete
BFF_OIDC_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

The browser sends same-origin API requests to the BFF. The browser does not
store access tokens or call `provider-sdx-api` or `provider-api` directly.

## 6. Configure Token Validation for the BFF

`provider-api` validates signature, issuer, and expiry by default. Configure the
provider APIs and gateway with:

| Validation setting | Value |
| --- | --- |
| Issuer | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx` |
| Discovery URL | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx/.well-known/openid-configuration` |
| JWKS URL | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx/protocol/openid-connect/certs` |
| Required token type | Access token |

The gateway must reject tokens that have:

- An invalid signature.
- An unexpected issuer.
- An expired or not-yet-valid lifetime.
- No non-empty `sub` claim.

The gateway should remove any untrusted inbound identity headers before
forwarding the request. It must forward the validated bearer token because
`provider-sdx-api` reads `sub` from that token.

JWT validation can be controlled per provider API:

| Flag | `provider-api` default | `provider-sdx-api` default |
| --- | --- | --- |
| `JWT_VALIDATE_SIGNATURE` | `true` | `false` |
| `JWT_VALIDATE_EXPIRY` | `true` | `false` |
| `JWT_ISSUER` | `PROVIDER_API_JWT_ISSUER`, generated from `OIDC_AUTHORITY` | unset |

Use `JWT_ISSUER` to set the expected issuer. When `JWT_ISSUER` is set, the
services validate the token's `iss` claim against it. Signing keys are resolved
from `OIDC_OPENID_CONNECT_URL`, or from the discovery document derived from
`OIDC_AUTHORITY`. `JWT_ISSUER` only controls issuer comparison. The services do
not trust the token's unvalidated `iss` claim to choose a JWKS URL.

The supplied OpenShift templates currently proxy the frontend directly to the
bff and do not deploy this gateway. Before exposing that topology, either
add the gateway or add JWT signature, issuer, and lifetime validation to the
bff.

## 7. Verify the Configuration

1. Open `http://localhost:3000`.
2. Select **Log in** and authenticate through Keycloak.
3. Confirm that the user can access **My widgets**.
4. Decode the access token and verify:

```json
{
  "iss": "https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx",
  "sub": "<stable-keycloak-subject>",
  "scope": "openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete"
}
```

5. Call the API through the gateway:

```sh
curl \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1/widgets
```

6. Verify that missing, expired, and incorrectly issued tokens are rejected
   before reaching the bff.

## Troubleshooting

### Invalid redirect URI

The browser callback URL must exactly match a Keycloak **Valid redirect URI**,
including scheme, host, port, and path.

### API returns 401

Confirm that the BFF session exists and that the server-side user access token
contains a non-empty `sub` claim. Also inspect gateway logs for issuer,
lifetime, or signature validation failures.
