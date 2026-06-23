import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Card, Form, InputGroup, Spinner } from 'react-bootstrap'
import WidgetManager from '@/components/WidgetManager'
import { getAppUser } from '@/auth/oidc'
import apiService, { getApiErrorMessage } from '@/service/api-service'
import type { UserSummary } from '@/interfaces/User'

export const Route = createFileRoute('/admin/widgets')({
  beforeLoad: async () => {
    const user = await getAppUser()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: AdminWidgetsPage,
})

function AdminWidgetsPage() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userError, setUserError] = useState('')
  const [subjectInput, setSubjectInput] = useState('')
  const [subject, setSubject] = useState('')

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      setUserError('')
      try {
        const response = await apiService.getAxiosInstance().get<UserSummary[]>('/admin/users')
        setUsers(response.data)
      } catch (error) {
        setUserError(getApiErrorMessage(error))
      } finally {
        setLoadingUsers(false)
      }
    }

    void loadUsers()
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubject(subjectInput.trim())
  }

  const selectedUser = users.find((user) => user.subject === subject)

  return (
    <>
      <Card className="subject-picker">
        <Card.Body>
          <Card.Title>Choose a widget owner</Card.Title>
          <Card.Text className="text-secondary">
            Users appear here after they make an authenticated request and own at least one widget.
          </Card.Text>
          {userError && <Alert variant="warning">{userError}</Alert>}
          <Form.Group className="mb-3" controlId="admin-known-user">
            <Form.Label>Known users</Form.Label>
            {loadingUsers ? (
              <div className="user-directory-loading">
                <Spinner animation="border" size="sm" role="status" />
                <span>Loading users...</span>
              </div>
            ) : (
              <Form.Select
                value={users.some((user) => user.subject === subjectInput) ? subjectInput : ''}
                onChange={(event) => {
                  setSubjectInput(event.target.value)
                  setSubject(event.target.value)
                }}
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option key={user.subject} value={user.subject}>
                    {user.displayName} ({user.widgetCount}{' '}
                    {user.widgetCount === 1 ? 'widget' : 'widgets'})
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>
          <Form onSubmit={handleSubmit}>
            <Form.Label htmlFor="admin-subject">Subject ID</Form.Label>
            <InputGroup>
              <Form.Control
                id="admin-subject"
                maxLength={255}
                placeholder="Select a user or enter an OIDC subject ID"
                required
                value={subjectInput}
                onChange={(event) => setSubjectInput(event.target.value)}
              />
              <Button type="submit">Load widgets</Button>
            </InputGroup>
          </Form>
        </Card.Body>
      </Card>
      {subject && (
        <WidgetManager
          admin
          subject={subject}
          title={selectedUser ? `${selectedUser.displayName}'s widgets` : 'Admin widgets'}
        />
      )}
    </>
  )
}
