# Keycloak OIDC Setup

This guide configures Keycloak for the **NRS Widget Application** frontend and
Widgets API.

Example values used below:

| Setting | Example |
| --- | --- |
| Keycloak admin console | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/admin/master/console/#/sdx` |
| Keycloak base URL | `https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth` |
| Realm | `sdx` |
| Frontend URL | `http://localhost:3000` |
| Default frontend client ID | `widget-ui-sdx-reference-implementation-21920` |
| Default API client ID | `widget-api-sdx-reference-implementation-21921` |

The admin console URL is used to configure the realm. It is not the OIDC
authority URL used by the application. Replace the frontend URLs for each
deployed environment.

## Important Security Boundary

The React frontend performs the OIDC authorization code flow with PKCE and sends
the resulting access token to the API.

The current NestJS backend does **not** validate the JWT signature, issuer,
expiry, or scopes. It decodes the token and reads its `sub` claim. The backend
assumes that an API gateway has already:

1. Validated the JWT against Keycloak.
2. Verified the issuer and token lifetime.
3. Enforced the scope required by the requested API operation.
4. Required authentication for administrative operations.

Do not expose the backend directly in a production environment. Either place it
behind a validating gateway or add full JWT validation and authorization to the
backend.

## 1. Create the Realm

1. Sign in to the Keycloak administration console.
2. Select **Create realm**.
3. Set **Realm name** to `sdx`.
4. Enable the realm.
5. Save the realm.

The OIDC authority URL is:

```text
https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx
```

Discovery metadata is available at:

```text
https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx/.well-known/openid-configuration
```

## 2. Create the Frontend Client

Create an OpenID Connect client for the browser application:

1. Open **Clients** and select **Create client**.
2. Set **Client type** to `OpenID Connect`.
3. Set **Client ID** to `widget-ui-sdx-reference-implementation-21920`.
4. Enable **Standard flow**.
5. Disable **Direct access grants**.
6. Disable **Implicit flow**.
7. Disable **Client authentication** so this is a public client.
8. Set the PKCE code challenge method to `S256`.

Configure these local-development URLs:

| Client setting | Value |
| --- | --- |
| Root URL | `http://localhost:3000` |
| Home URL | `http://localhost:3000` |
| Valid redirect URIs | `http://localhost:3000/auth/callback` |
| Valid redirect URIs | `http://localhost:3000/auth/silent-callback` |
| Valid redirect URIs | `http://localhost:3001/api/docs/oauth2-redirect.html` |
| Valid post logout redirect URIs | `http://localhost:3000/login` |
| Web origins | `http://localhost:3000` |
| Web origins | `http://localhost:3001` |

Add the corresponding HTTPS URLs for DEV, TEST, and PROD. Prefer exact URLs over
wildcards.

Configure these additional URLs for DEV:

| Client setting | Value |
| --- | --- |
| Valid redirect URIs | `https://widgets-apps-gov-bc-ca.dev.api.gov.bc.ca/auth/callback` |
| Valid redirect URIs | `https://widgets-apps-gov-bc-ca.dev.api.gov.bc.ca/auth/silent-callback` |
| Valid redirect URIs | `https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/docs/oauth2-redirect.html` |
| Valid post logout redirect URIs | `https://widgets-apps-gov-bc-ca.dev.api.gov.bc.ca/login` |
| Web origins | `https://widgets-apps-gov-bc-ca.dev.api.gov.bc.ca` |
| Web origins | `https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca` |

## 3. Create the API Client

1. Create another OpenID Connect client with client ID
   `widget-api-sdx-reference-implementation-21921`.
2. Disable **Standard flow**, **Implicit flow**, and **Direct access grants**.
3. This client represents the API resource; it does not need browser redirect
   URIs.

No audience mapper is required for the current reference implementation. The
gateway will not require the API client ID in the token's `aud` claim.

The API client is being created now for use in a later update. That update will:

- Use `widget-api-sdx-reference-implementation-21921` as the Widgets API token
  audience.
- Configure the UI and other authorized clients to request tokens for that
  audience.
- Configure the gateway or backend to validate the audience.
- Configure an appropriate token-acquisition flow for non-browser API clients,
  such as client credentials where required.

Until that update is implemented, do not configure an audience mapper or depend
on the API client for token acquisition.

## 4. Widget Scopes

Create these OpenID Connect client scopes:

```text
nrs:widgets:read
nrs:widgets:create
nrs:widgets:update
nrs:widgets:delete
nrs:widgets:admin
```

Assign all five to `widget-ui-sdx-reference-implementation-21920` under
**Client scopes** as **Optional** assigned client scopes. Realm-level discovery
does not make a scope requestable by a client. Include them in `OIDC_SCOPE` so
both the UI and Swagger explicitly request them.

The access token's standard `scope` claim should contain the granted scopes:

```json
{
  "scope": "openid profile nrs:widgets:read nrs:widgets:create nrs:widgets:update nrs:widgets:delete"
}
```

The intended future operation mapping is:

| API operations | Required scope |
| --- | --- |
| List/get subject Widgets | `nrs:widgets:read` |
| Create subject Widgets | `nrs:widgets:create` |
| Replace/patch subject Widgets | `nrs:widgets:update` |
| Delete subject Widgets | `nrs:widgets:delete` |
| All `/api/v1/admin/*` operations | `nrs:widgets:admin` |

The current backend still assumes the gateway has authorized requests and does
not enforce operation scopes itself. The scopes are requested now so access
tokens are ready for gateway enforcement.

This permissive administrative policy is intended for the current reference
implementation only. Introduce role- or policy-based authorization before using
administrative operations with production data.

## 5. Create Users

Create the users required for local testing. No application roles are required.

The Widgets API uses the access token's immutable `sub` claim as the Widget
owner identifier. A user's subject can be inspected by decoding their access
token. Users enter another user's subject ID on the admin Widgets screen.

Do not configure a mapper that replaces `sub` with a mutable username or email
address.

## 6. Configure the Frontend

For local Docker Compose development:

```sh
export OIDC_AUTHORITY=https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx
export OIDC_CLIENT_ID=widget-ui-sdx-reference-implementation-21920
export OIDC_SCOPE="openid profile"

docker compose up database migrations backend frontend
```

Supported frontend settings:

| Variable | Required | Default |
| --- | --- | --- |
| `API_BASE_URL` | No | `/api/v1` |
| `OIDC_AUTHORITY` | Yes | None |
| `OIDC_CLIENT_ID` | No | `widget-ui-sdx-reference-implementation-21920` |
| `OIDC_SCOPE` | No | `openid profile` |
| `OIDC_DISPLAY_NAME_CLAIM` | No | `name` |
| `OIDC_REDIRECT_URI` | No | `<frontend-origin>/auth/callback` |
| `OIDC_SILENT_REDIRECT_URI` | No | `<frontend-origin>/auth/silent-callback` |
| `OIDC_POST_LOGOUT_REDIRECT_URI` | No | `<frontend-origin>/login` |

The Caddy frontend image exposes these settings through `/config.json`, allowing
the same image to be configured independently in each environment. Vite
development also accepts the same variables.

Configure the DEV frontend container with:

```text
API_BASE_URL=https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1
OIDC_AUTHORITY=https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx
OIDC_CLIENT_ID=widget-ui-sdx-reference-implementation-21920
OIDC_SCOPE=openid profile
```

The browser sends API requests directly to the configured absolute API URL. The
API must allow the UI origin
`https://widgets-apps-gov-bc-ca.dev.api.gov.bc.ca` through CORS.

## 7. Configure Token Validation for the Backend

The current backend assumes a trusted gateway has validated the bearer token.
Configure that gateway with:

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
forwarding the request. It must forward the validated bearer token because the
backend reads `sub` from that token.

The supplied OpenShift templates currently proxy the frontend directly to the
backend and do not deploy this gateway. Before exposing that topology, either
add the gateway or add JWT signature, issuer, and lifetime validation to the
backend.

## 8. Verify the Configuration

1. Open `http://localhost:3000`.
2. Select **Log in** and authenticate through Keycloak.
3. Confirm that the user can access **My widgets**.
4. Confirm that the same user can access **Admin widgets**.
5. Decode the access token and verify:

```json
{
  "iss": "https://authz-b8840c-dev.apps.gold.devops.gov.bc.ca/auth/realms/sdx",
  "sub": "<stable-keycloak-subject>",
  "scope": "openid profile"
}
```

6. Call the API through the gateway:

```sh
curl \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  https://widgets-api-gov-bc-ca.dev.api.gov.bc.ca/api/v1/widgets
```

7. Verify that missing, expired, and incorrectly issued tokens are rejected
   before reaching the backend.

## Troubleshooting

### Invalid redirect URI

The browser callback URL must exactly match a Keycloak **Valid redirect URI**,
including scheme, host, port, and path.

### API returns 401

Confirm that the request carries a JWT access token with a non-empty `sub`
claim. Also inspect gateway logs for issuer, lifetime, or signature validation
failures.

### Silent renewal fails

Confirm that `/auth/silent-callback` is a valid redirect URI. Browser
third-party-cookie policies can prevent iframe-based silent renewal when
Keycloak is hosted on a different site; users may need to authenticate again
when the token expires.
