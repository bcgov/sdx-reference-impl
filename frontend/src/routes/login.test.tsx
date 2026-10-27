import { render, screen } from '@testing-library/react'
import { LoginPage, Route } from './login'

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

vi.mock('@/auth/oidc', () => ({
  getAppUser: vi.fn(),
}))

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers another sign-in after the OIDC callback session expires', () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ reason: 'oidc-session-expired' })

    render(<LoginPage />)

    expect(screen.getByText('Your sign-in session expired. Please sign in again.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })
})
