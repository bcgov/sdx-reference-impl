import { useState, type FormEvent } from 'react'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import {
  WIDGET_STATUSES,
  type Widget,
  type WidgetInput,
  type WidgetStatus,
} from '@/interfaces/Widget'

type Props = {
  allowSubjectChange?: boolean
  busy: boolean
  onHide: () => void
  onSubmit: (input: WidgetInput) => Promise<void>
  show: boolean
  subject?: string
  widget?: Widget | null
}

export default function WidgetFormModal({
  allowSubjectChange = false,
  busy,
  onHide,
  onSubmit,
  show,
  subject = '',
  widget,
}: Props) {
  const [name, setName] = useState(widget?.name ?? '')
  const [description, setDescription] = useState(widget?.description ?? '')
  const [status, setStatus] = useState<WidgetStatus>(widget?.status ?? 'active')
  const [metadata, setMetadata] = useState(JSON.stringify(widget?.metadata ?? {}, null, 2))
  const [widgetSubject, setWidgetSubject] = useState(widget?.subject ?? subject)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    let parsedMetadata: Record<string, unknown>
    try {
      const parsed = JSON.parse(metadata)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error()
      }
      parsedMetadata = parsed
    } catch {
      setError('Metadata must be a valid JSON object.')
      return
    }

    await onSubmit({
      name,
      description: description || null,
      status,
      metadata: parsedMetadata,
      ...(allowSubjectChange ? { subject: widgetSubject } : {}),
    })
  }

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} size="lg" centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{widget ? 'Edit widget' : 'Create widget'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {allowSubjectChange && (
            <Form.Group className="mb-3" controlId="widget-subject">
              <Form.Label>Subject ID</Form.Label>
              <Form.Control
                required
                maxLength={255}
                value={widgetSubject}
                onChange={(event) => setWidgetSubject(event.target.value)}
              />
            </Form.Group>
          )}
          <Form.Group className="mb-3" controlId="widget-name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="widget-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="widget-status">
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={status}
              onChange={(event) => setStatus(event.target.value as WidgetStatus)}
            >
              {WIDGET_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group controlId="widget-metadata">
            <Form.Label>Metadata (JSON object)</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              className="font-monospace"
              value={metadata}
              onChange={(event) => setMetadata(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save widget'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
