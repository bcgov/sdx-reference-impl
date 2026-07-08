import { BadGatewayException, Injectable } from '@nestjs/common'
import type { BffSession } from '../auth/auth.types'

type ProxyMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export type WidgetProxyResult = {
  body: unknown
  etag?: string
  status: number
}

@Injectable()
export class WidgetsService {
  private readonly providerBaseUrl = (
    process.env.PROVIDER_SDX_API_BASE_URL ||
    process.env.PROVIDER_API_BASE_URL ||
    'http://provider-sdx-api:3000/api/v1'
  ).replace(/\/+$/, '')

  list(session: BffSession, query: Record<string, unknown>): Promise<WidgetProxyResult> {
    return this.proxy(session, 'GET', '/widgets', { query })
  }

  create(session: BffSession, body: unknown, idempotencyKey?: string): Promise<WidgetProxyResult> {
    return this.proxy(session, 'POST', '/widgets', {
      body,
      headers: this.optionalHeaders({ 'Idempotency-Key': idempotencyKey }),
    })
  }

  get(session: BffSession, widgetId: string): Promise<WidgetProxyResult> {
    return this.proxy(session, 'GET', `/widgets/${encodeURIComponent(widgetId)}`)
  }

  replace(
    session: BffSession,
    widgetId: string,
    body: unknown,
    ifMatch?: string,
  ): Promise<WidgetProxyResult> {
    return this.proxy(session, 'PUT', `/widgets/${encodeURIComponent(widgetId)}`, {
      body,
      headers: this.optionalHeaders({ 'If-Match': ifMatch }),
    })
  }

  update(
    session: BffSession,
    widgetId: string,
    body: unknown,
    ifMatch?: string,
  ): Promise<WidgetProxyResult> {
    return this.proxy(session, 'PATCH', `/widgets/${encodeURIComponent(widgetId)}`, {
      body,
      headers: this.optionalHeaders({ 'If-Match': ifMatch }),
    })
  }

  delete(session: BffSession, widgetId: string, ifMatch?: string): Promise<WidgetProxyResult> {
    return this.proxy(session, 'DELETE', `/widgets/${encodeURIComponent(widgetId)}`, {
      headers: this.optionalHeaders({ 'If-Match': ifMatch }),
    })
  }

  private async proxy(
    session: BffSession,
    method: ProxyMethod,
    path: string,
    options: {
      body?: unknown
      headers?: Record<string, string>
      query?: Record<string, unknown>
    } = {},
  ): Promise<WidgetProxyResult> {
    const url = new URL(`${this.providerBaseUrl}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...options.headers,
    }
    const init: RequestInit = {
      method,
      headers,
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    let response: globalThis.Response
    try {
      response = await fetch(url, init)
    } catch {
      throw new BadGatewayException('Provider SDX API is unavailable')
    }

    return {
      body: await this.readBody(response),
      etag: response.headers.get('etag') ?? undefined,
      status: response.status,
    }
  }

  private async readBody(response: globalThis.Response): Promise<unknown> {
    if (response.status === 204) {
      return undefined
    }
    const text = await response.text()
    if (!text) {
      return undefined
    }
    const contentType = response.headers.get('content-type') || ''
    if (
      contentType.includes('application/json') ||
      contentType.includes('application/problem+json')
    ) {
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
    return text
  }

  private optionalHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).filter((entry): entry is [string, string] => Boolean(entry[1])),
    )
  }
}
