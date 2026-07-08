import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import { CreateWidgetDto } from './dto/create-widget.dto'
import { ListWidgetsQueryDto, WidgetListResponseDto } from './dto/list-widgets.dto'
import { PatchWidgetDto, UpdateWidgetDto } from './dto/update-widget.dto'
import { WidgetDto } from './dto/widget.dto'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

@Injectable()
export class WidgetsService {
  private readonly providerApiBaseUrl =
    process.env.PROVIDER_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3002/api/v1'
  private readonly providerApiClientId = process.env.PROVIDER_API_CLIENT_ID || 'local-provider-sdx-api'
  private readonly providerApiClientSecret = process.env.PROVIDER_API_CLIENT_SECRET
  private readonly providerApiTokenScope = process.env.PROVIDER_API_TOKEN_SCOPE
  private readonly explicitProviderApiTokenUrl = process.env.PROVIDER_API_TOKEN_URL
  private readonly oidcAuthority = process.env.OIDC_AUTHORITY
  private readonly openIdConnectUrl = process.env.OIDC_OPENID_CONNECT_URL
  private providerApiTokenEndpoint?: string
  private providerApiAccessToken?: { token: string; expiresAt: number }
  private providerApiTokenRequest?: Promise<string>

  async createForSubject(
    subject: string,
    username: string,
    dto: CreateWidgetDto,
    idempotencyKey?: string,
  ): Promise<WidgetDto> {
    this.validateSubject(subject)
    const headers = await this.jsonHeaders(subject, username)
    if (idempotencyKey) {
      headers.set('Idempotency-Key', idempotencyKey)
    }

    return this.providerRequest<WidgetDto>(`/subjects/${encodeURIComponent(subject)}/widgets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    })
  }

  async listForSubject(
    subject: string,
    username: string,
    query: ListWidgetsQueryDto,
  ): Promise<WidgetListResponseDto> {
    this.validateSubject(subject)
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value))
      }
    }

    const suffix = search.size ? `?${search.toString()}` : ''
    return this.providerRequest<WidgetListResponseDto>(
      `/subjects/${encodeURIComponent(subject)}/widgets${suffix}`,
      {
        headers: await this.authHeaders(subject, username),
      },
    )
  }

  async getForSubject(widgetId: string, subject: string, username: string): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    this.validateSubject(subject)
    return this.providerRequest<WidgetDto>(`/widgets/${encodeURIComponent(widgetId)}`, {
      headers: await this.authHeaders(subject, username),
    })
  }

  async replaceForSubject(
    widgetId: string,
    subject: string,
    username: string,
    dto: UpdateWidgetDto,
    ifMatch?: string,
  ): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    this.validateSubject(subject)
    return this.writeWidget<WidgetDto>(
      'PUT',
      widgetId,
      { ...dto, subject },
      subject,
      username,
      ifMatch,
    )
  }

  async patchForSubject(
    widgetId: string,
    subject: string,
    username: string,
    dto: PatchWidgetDto,
    ifMatch?: string,
  ): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    this.validateSubject(subject)
    return this.writeWidget<WidgetDto>(
      'PATCH',
      widgetId,
      { ...dto, subject },
      subject,
      username,
      ifMatch,
    )
  }

  async deleteForSubject(
    widgetId: string,
    subject: string,
    username: string,
    ifMatch?: string,
  ): Promise<void> {
    this.validateWidgetId(widgetId)
    this.validateSubject(subject)
    const headers = await this.authHeaders(subject, username)
    if (ifMatch) {
      headers.set('If-Match', ifMatch)
    }

    await this.providerRequest<void>(`/widgets/${encodeURIComponent(widgetId)}`, {
      method: 'DELETE',
      headers,
    })
  }

  etagForWidget(widget: Pick<WidgetDto, 'id' | 'updatedAt'>): string {
    const updatedAt =
      widget.updatedAt instanceof Date ? widget.updatedAt.toISOString() : String(widget.updatedAt)
    const hash = createHash('sha256')
      .update(`${widget.id}:${updatedAt}`, 'utf8')
      .digest('base64url')
    return `"${hash}"`
  }

  private async writeWidget<T>(
    method: 'PATCH' | 'PUT',
    widgetId: string,
    body: Record<string, unknown>,
    subject: string,
    username: string,
    ifMatch?: string,
  ): Promise<T> {
    const headers = await this.jsonHeaders(subject, username)
    if (ifMatch) {
      headers.set('If-Match', ifMatch)
    }

    return this.providerRequest<T>(`/widgets/${encodeURIComponent(widgetId)}`, {
      method,
      headers,
      body: JSON.stringify(body),
    })
  }

  private async providerRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.providerApiBaseUrl}${path}`, init)

    if (response.status === 204) {
      return undefined as T
    }

    const body = await this.parseResponse(response)
    if (!response.ok) {
      throw new HttpException(body, response.status)
    }
    return body as T
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) {
      return undefined
    }

    try {
      return JSON.parse(text)
    } catch {
      return { message: text }
    }
  }

  private async jsonHeaders(subject: string, username: string): Promise<Headers> {
    const headers = await this.authHeaders(subject, username)
    headers.set('Content-Type', 'application/json')
    return headers
  }

  private async authHeaders(subject: string, username: string): Promise<Headers> {
    this.validateUsername(username)
    return new Headers({
      Authorization: `Bearer ${await this.providerApiBearerToken()}`,
      'x-on-behalf-of-sub': subject,
      'x-on-behalf-of-username': username,
    })
  }

  private async providerApiBearerToken(): Promise<string> {
    const cachedToken = this.providerApiAccessToken
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.token
    }

    this.providerApiTokenRequest ??= this.fetchProviderApiBearerToken().finally(() => {
      this.providerApiTokenRequest = undefined
    })
    return this.providerApiTokenRequest
  }

  private async fetchProviderApiBearerToken(): Promise<string> {
    if (!this.providerApiClientSecret?.trim()) {
      throw new InternalServerErrorException(
        'PROVIDER_API_CLIENT_SECRET is required for provider API client-credentials authentication',
      )
    }

    const tokenEndpoint = await this.getProviderApiTokenEndpoint()
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.providerApiClientId,
      client_secret: this.providerApiClientSecret,
    })
    if (this.providerApiTokenScope?.trim()) {
      body.set('scope', this.providerApiTokenScope.trim())
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const tokenResponse = await this.parseResponse(response)

    if (!response.ok) {
      throw new BadGatewayException({
        message: 'Provider API service token request failed',
        statusCode: response.status,
        error: tokenResponse,
      })
    }

    const accessToken =
      tokenResponse &&
      typeof tokenResponse === 'object' &&
      'access_token' in tokenResponse &&
      typeof tokenResponse.access_token === 'string'
        ? tokenResponse.access_token
        : undefined
    if (!accessToken) {
      throw new BadGatewayException(
        'Provider API service token response did not include access_token',
      )
    }

    const expiresIn =
      tokenResponse &&
      typeof tokenResponse === 'object' &&
      'expires_in' in tokenResponse &&
      typeof tokenResponse.expires_in === 'number'
        ? tokenResponse.expires_in
        : 300
    this.providerApiAccessToken = {
      token: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    }
    return accessToken
  }

  private async getProviderApiTokenEndpoint(): Promise<string> {
    if (this.explicitProviderApiTokenUrl?.trim()) {
      return this.explicitProviderApiTokenUrl.trim()
    }
    if (this.providerApiTokenEndpoint) {
      return this.providerApiTokenEndpoint
    }

    const discoveryUrl =
      this.openIdConnectUrl?.trim() ||
      (this.oidcAuthority?.trim()
        ? `${this.oidcAuthority.replace(/\/+$/, '')}/.well-known/openid-configuration`
        : undefined)

    if (!discoveryUrl) {
      throw new InternalServerErrorException(
        'OIDC_AUTHORITY or PROVIDER_API_TOKEN_URL is required for provider API client-credentials authentication',
      )
    }

    const response = await fetch(discoveryUrl)
    const discovery = await this.parseResponse(response)
    if (!response.ok) {
      throw new BadGatewayException({
        message: 'OIDC discovery failed while loading provider API token endpoint',
        statusCode: response.status,
        error: discovery,
      })
    }

    const tokenEndpoint =
      discovery &&
      typeof discovery === 'object' &&
      'token_endpoint' in discovery &&
      typeof discovery.token_endpoint === 'string'
        ? discovery.token_endpoint
        : undefined
    if (!tokenEndpoint) {
      throw new BadGatewayException('OIDC discovery response did not include token_endpoint')
    }

    this.providerApiTokenEndpoint = tokenEndpoint
    return tokenEndpoint
  }

  private validateSubject(subject: string): void {
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) {
      throw new UnprocessableEntityException(
        'subject must be a non-empty string up to 255 characters',
      )
    }
  }

  private validateUsername(username: string): void {
    if (typeof username !== 'string' || !username.trim() || username.length > 255) {
      throw new UnprocessableEntityException(
        'username must be a non-empty string up to 255 characters',
      )
    }
  }

  private validateWidgetId(widgetId: string): void {
    if (typeof widgetId !== 'string' || !UUID_PATTERN.test(widgetId)) {
      throw new BadRequestException('widgetId must be a valid UUID')
    }
  }
}
