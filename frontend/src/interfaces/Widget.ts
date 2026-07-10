export const WIDGET_STATUSES = ['active', 'inactive', 'archived'] as const

export type WidgetStatus = (typeof WIDGET_STATUSES)[number]

export type Widget = {
  createdAt: string
  additionalData: Record<string, unknown>
  description: string | null
  id: string
  name: string
  status: WidgetStatus
  subject: string
  updatedAt: string
}

export type WidgetSummary = Pick<Widget, 'id' | 'name' | 'status' | 'subject' | 'updatedAt'>

export type WidgetInput = {
  additionalData?: Record<string, unknown>
  description?: string | null
  name: string
  status: WidgetStatus
  subject?: string
}

export type WidgetListResponse = {
  items: WidgetSummary[]
  nextCursor: string | null
}
