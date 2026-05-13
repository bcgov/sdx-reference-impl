export interface SdxWidgetClientOptions {
  baseUrl: string
  accessToken: string
}

export class SdxWidgetsClient {
  constructor(private readonly options: SdxWidgetClientOptions) {}

  listSdxWidgets() {
    return this.request('/sdx-widgets')
  }

  createSdxWidget(sdxWidget: Record<string, unknown>) {
    return this.request('/sdx-widgets', {
      method: 'POST',
      body: JSON.stringify(sdxWidget),
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
      throw new Error(`SDX Widgets API request failed with status ${response.status}`)
    }

    if (response.status === 204) {
      return undefined
    }

    return response.json()
  }
}
