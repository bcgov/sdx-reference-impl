import { beginLogin, getAppUser } from './oidc'

describe('BFF session auth', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns the BFF session user when authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          authenticated: true,
          user: {
            displayName: 'Test User',
            subjectId: 'session-subject',
          },
        }),
        ok: true,
      }),
    )

    await expect(getAppUser()).resolves.toEqual({
      displayName: 'Test User',
      subjectId: 'session-subject',
    })
  })

  test('starts login through the BFF login endpoint', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', {
      assign,
    })

    await beginLogin('/widgets')

    expect(assign).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fwidgets')
  })
})
