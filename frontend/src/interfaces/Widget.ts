export const WIDGET_STATUSES = ['active', 'inactive', 'archived'] as const

export type WidgetStatus = (typeof WIDGET_STATUSES)[number]

export type Widget = {
  createdAt: string
  description: string | null
  id: string
  metadata: Record<string, unknown>
  name: string
  status: WidgetStatus
  subject: string
  updatedAt: string
}

export type WidgetInput = {
  description?: string | null
  metadata?: Record<string, unknown>
  name: string
  status: WidgetStatus
  subject?: string
}

export type WidgetListResponse = {
  items: Widget[]
  nextCursor: string | null
}
