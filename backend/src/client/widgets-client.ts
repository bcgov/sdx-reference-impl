export interface WidgetClientOptions {
  baseUrl: string
  accessToken: string
}

export class WidgetsClient {
  constructor(private readonly options: WidgetClientOptions) {}

  listWidgets() {
    return this.request('/widgets')
  }

  createWidget(widget: Record<string, unknown>) {
    return this.request('/widgets', {
      method: 'POST',
      body: JSON.stringify(widget),
    })
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.accessToken}`,
        ...init.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Widgets API request failed with status ${response.status}`)
    }

    if (response.status === 204) {
      return undefined
    }

    return response.json()
  }
}
