import type { User } from 'oidc-client-ts'
import { toAppUser } from './oidc'

vi.mock('./config', () => ({
  getOidcConfig: () => ({
    displayNameClaim: 'name',
  }),
}))

describe('OIDC user', () => {
  test('uses the access token subject without requiring role claims', () => {
    const payload = btoa(JSON.stringify({ sub: 'access-token-subject' }))
    const user = {
      access_token: `header.${payload}.signature`,
      expired: false,
      profile: {
        sub: 'id-token-subject',
        name: 'Test User',
      },
    } as User

    expect(toAppUser(user)).toEqual({
      accessToken: user.access_token,
      displayName: 'Test User',
      subjectId: 'access-token-subject',
    })
  })
})
