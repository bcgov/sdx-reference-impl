import { useCallback, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap'
import apiService, { getApiErrorMessage } from '@/service/api-service'
import type { Widget, WidgetInput, WidgetListResponse, WidgetStatus } from '@/interfaces/Widget'
import WidgetFormModal from './WidgetFormModal'

type Props = {
  subject: string
  title: string
}

const statusVariant: Record<WidgetStatus, string> = {
  active: 'success',
  inactive: 'secondary',
  archived: 'dark',
}

export default function WidgetManager({ subject, title }: Props) {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Widget | null>(null)
  const [showForm, setShowForm] = useState(false)

  const collectionPath = '/widgets'

  const loadWidgets = useCallback(async () => {
    if (!subject) {
      setWidgets([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apiService.getAxiosInstance().get<WidgetListResponse>(collectionPath, {
        params: {
          limit: 100,
          name: nameFilter || undefined,
          status: statusFilter || undefined,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        },
      })
      setWidgets(response.data.items)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [collectionPath, nameFilter, statusFilter, subject])

  useEffect(() => {
    void loadWidgets()
  }, [loadWidgets])

  const saveWidget = async (input: WidgetInput) => {
    setBusy(true)
    setError('')
    try {
      if (editing) {
        await apiService.getAxiosInstance().put(`/widgets/${editing.id}`, input)
      } else {
        await apiService.getAxiosInstance().post(collectionPath, input, {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        })
      }
      setShowForm(false)
      setEditing(null)
      await loadWidgets()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const deleteWidget = async (widget: Widget) => {
    if (!window.confirm(`Delete "${widget.name}"? This action cannot be undone.`)) {
      return
    }
    setError('')
    try {
      await apiService.getAxiosInstance().delete(`/widgets/${widget.id}`)
      await loadWidgets()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (widget: Widget) => {
    setEditing(widget)
    setShowForm(true)
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Subject workspace</p>
          <h1>{title}</h1>
          <p className="text-secondary mb-0">
            Managing widgets for <code>{subject}</code>
          </p>
        </div>
        <Button onClick={openCreate} disabled={!subject}>
          <i className="bi bi-plus-lg me-2" />
          Create widget
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="widget-card">
        <Card.Body>
          <div className="filters">
            <Form.Group controlId="widget-filter-name">
              <Form.Label>Filter by name</Form.Label>
              <Form.Control
                placeholder="Search widgets"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="widget-filter-status">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </Form.Select>
            </Form.Group>
          </div>

          {loading ? (
            <div className="loading-state">
              <Spinner animation="border" role="status" />
              <span>Loading widgets...</span>
            </div>
          ) : widgets.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-box-seam" />
              <h2>No widgets found</h2>
              <p>Create a widget or adjust the current filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle widget-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {widgets.map((widget) => (
                    <tr key={widget.id}>
                      <td>
                        <strong>{widget.name}</strong>
                        <div className="widget-description">
                          {widget.description || 'No description'}
                        </div>
                      </td>
                      <td>
                        <Badge bg={statusVariant[widget.status]}>{widget.status}</Badge>
                      </td>
                      <td>{new Date(widget.updatedAt).toLocaleString()}</td>
                      <td className="text-end">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="me-2"
                          onClick={() => openEdit(widget)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => void deleteWidget(widget)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <WidgetFormModal
        key={`${editing?.id ?? 'new'}-${subject}-${showForm}`}
        busy={busy}
        onHide={() => setShowForm(false)}
        onSubmit={saveWidget}
        show={showForm}
        widget={editing}
      />
    </>
  )
}
