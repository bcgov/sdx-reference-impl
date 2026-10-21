import type { BffSession } from '../auth/auth.types'
import { WidgetsService } from './widgets.service'

const session: BffSession = {
  accessToken: 'user-access-token',
  expiresAt: Date.now() + 60_000,
  id: 'test-session',
  user: {
    displayName: 'Test User',
    subjectId: 'user-123',
  },
}

describe('WidgetsService', () => {
  afterEach(() => {
    delete process.env.OIDC_CLIENT_ID
    delete process.env.PROVIDER_SDX_API_BASE_URL
    vi.unstubAllGlobals()
  })

  it('uses the BFF OAuth client ID as the SDX routing header', async () => {
    process.env.OIDC_CLIENT_ID = 'widget-bff-client'
    process.env.PROVIDER_SDX_API_BASE_URL = 'https://sdx.test/api/v1'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await new WidgetsService().list(session, {})

    const request = fetchMock.mock.calls[0]
    const headers = new Headers(request[1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer user-access-token')
    expect(headers.get('X-Client-Id')).toBe('widget-bff-client')
  })
})
