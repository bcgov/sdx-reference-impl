import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Card, Form, InputGroup } from 'react-bootstrap'
import WidgetManager from '@/components/WidgetManager'
import { getAppUser } from '@/auth/oidc'

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
  const [subjectInput, setSubjectInput] = useState('')
  const [subject, setSubject] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubject(subjectInput.trim())
  }

  return (
    <>
      <Card className="subject-picker">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Label htmlFor="admin-subject">Subject to administer</Form.Label>
            <InputGroup>
              <Form.Control
                id="admin-subject"
                maxLength={255}
                placeholder="Enter an OIDC subject ID"
                required
                value={subjectInput}
                onChange={(event) => setSubjectInput(event.target.value)}
              />
              <Button type="submit">Load widgets</Button>
            </InputGroup>
          </Form>
        </Card.Body>
      </Card>
      {subject && <WidgetManager admin subject={subject} title="Admin widgets" />}
    </>
  )
}
