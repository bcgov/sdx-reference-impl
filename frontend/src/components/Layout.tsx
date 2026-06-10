import type { FC, ReactNode } from 'react'
import { Footer, Header } from '@bcgov/design-system-react-components'
import { Link } from '@tanstack/react-router'
import { Button, Container, Nav, Navbar } from 'react-bootstrap'
import { useAuth } from '@/auth/AuthContext'

type Props = {
  children: ReactNode
}

const Layout: FC<Props> = ({ children }) => {
  const auth = useAuth()

  const handleLogout = () => void auth.logout()

  return (
    <div className="app-shell">
      <Header title="NRS Widget Application" />
      <div className="app-subtitle">
        <Container>SDX Reference Implementation</Container>
      </div>
      {!auth.loading && auth.user && (
        <Navbar className="app-nav" expand="md">
          <Container>
            <Navbar.Toggle aria-controls="primary-navigation" />
            <Navbar.Collapse id="primary-navigation">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/widgets">
                  My widgets
                </Nav.Link>
                <Nav.Link as={Link} to="/admin/widgets">
                  Admin widgets
                </Nav.Link>
              </Nav>
              <div className="session-summary">
                <span>
                  Signed in as <strong>{auth.user.displayName}</strong>
                </span>
                <Button variant="outline-light" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      )}
      <main className="app-main">
        <Container>{children}</Container>
      </main>
      <Footer />
    </div>
  )
}

export default Layout
