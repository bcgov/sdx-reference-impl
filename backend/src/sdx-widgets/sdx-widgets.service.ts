import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { Prisma } from '../../generated/prisma/client.js'
import type { InputJsonValue } from '@prisma/client/runtime/client'
import { createHash } from 'crypto'
import { CreateSdxWidgetDto } from './dto/create-sdx-widget.dto'
import {
  ListSdxWidgetsQueryDto,
  SdxWidgetListResponseDto,
  SDX_WIDGET_SORT_DIRECTIONS,
  SDX_WIDGET_SORT_FIELDS,
  type SdxWidgetSortDirection,
  type SdxWidgetSortField,
} from './dto/list-sdx-widgets.dto'
import {
  AdminPatchSdxWidgetDto,
  AdminUpdateSdxWidgetDto,
  PatchSdxWidgetDto,
  UpdateSdxWidgetDto,
} from './dto/update-sdx-widget.dto'
import { SdxWidgetDto, SdxWidgetStatus, SDX_WIDGET_STATUSES } from './dto/sdx-widget.dto'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type WidgetRecord = {
  id: string
  subject: string
  name: string
  description: string | null
  status: string
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

type ParsedListQuery = {
  cursorOffset: number
  limit: number
  name?: string
  sortBy: SdxWidgetSortField
  sortOrder: SdxWidgetSortDirection
  status?: SdxWidgetStatus
}

@Injectable()
export class SdxWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForSubject(
    subject: string,
    dto: CreateSdxWidgetDto,
    idempotencyKey?: string,
  ): Promise<SdxWidgetDto> {
    const data = this.buildCreateData(subject, dto)
    const normalizedKey = this.normalizeIdempotencyKey(idempotencyKey)

    if (!normalizedKey) {
      const widget = await this.prisma.sdxWidget.create({ data })
      return this.toDto(widget)
    }

    const requestHash = this.hashIdempotentCreateRequest(data)

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sdxWidgetIdempotency.findUnique({
        where: {
          subject_idempotencyKey: {
            subject,
            idempotencyKey: normalizedKey,
          },
        },
      })

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency-Key was already used with a different request body',
          )
        }

        const widget = await tx.sdxWidget.findUnique({ where: { id: existing.widgetId } })
        return this.requireWidget(widget as WidgetRecord | null)
      }

      const widget = await tx.sdxWidget.create({ data })
      await tx.sdxWidgetIdempotency.create({
        data: {
          subject,
          idempotencyKey: normalizedKey,
          requestHash,
          widgetId: widget.id,
        },
      })
      return this.toDto(widget)
    })
  }

  async listForSubject(
    subject: string,
    query: ListSdxWidgetsQueryDto,
  ): Promise<SdxWidgetListResponseDto> {
    return this.listWidgets({ subject }, query)
  }

  async getForSubject(widgetId: string, subject: string): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    const widget = await this.prisma.sdxWidget.findFirst({
      where: { id: widgetId, subject },
    })
    return this.requireWidget(widget)
  }

  async replaceForSubject(
    widgetId: string,
    subject: string,
    dto: UpdateSdxWidgetDto,
  ): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    const widget = await this.prisma.sdxWidget.update({
      where: { id: widgetId },
      data: this.buildUpdateData(dto, true),
    })
    return this.toDto(widget)
  }

  async patchForSubject(
    widgetId: string,
    subject: string,
    dto: PatchSdxWidgetDto,
  ): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    const widget = await this.prisma.sdxWidget.update({
      where: { id: widgetId },
      data: this.buildUpdateData(dto, false),
    })
    return this.toDto(widget)
  }

  async deleteForSubject(widgetId: string, subject: string): Promise<void> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    await this.prisma.sdxWidget.delete({ where: { id: widgetId } })
  }

  async adminCreateForSubject(
    subject: string,
    dto: CreateSdxWidgetDto,
    idempotencyKey?: string,
  ): Promise<SdxWidgetDto> {
    return this.createForSubject(subject, dto, idempotencyKey)
  }

  async adminListForSubject(
    subject: string,
    query: ListSdxWidgetsQueryDto,
  ): Promise<SdxWidgetListResponseDto> {
    return this.listWidgets({ subject }, query)
  }

  async adminGet(widgetId: string): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    const widget = await this.prisma.sdxWidget.findUnique({ where: { id: widgetId } })
    return this.requireWidget(widget)
  }

  async adminReplace(widgetId: string, dto: AdminUpdateSdxWidgetDto): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    const widget = await this.prisma.sdxWidget.update({
      where: { id: widgetId },
      data: this.buildAdminUpdateData(dto, true),
    })
    return this.toDto(widget)
  }

  async adminPatch(widgetId: string, dto: AdminPatchSdxWidgetDto): Promise<SdxWidgetDto> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    const widget = await this.prisma.sdxWidget.update({
      where: { id: widgetId },
      data: this.buildAdminUpdateData(dto, false),
    })
    return this.toDto(widget)
  }

  async adminDelete(widgetId: string): Promise<void> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    await this.prisma.sdxWidget.delete({ where: { id: widgetId } })
  }

  private buildCreateData(subject: string, dto: CreateSdxWidgetDto): Prisma.SdxWidgetCreateInput {
    this.validateSubject(subject)
    this.validateName(dto.name, true)
    this.validateDescription(dto.description)
    this.validateStatus(dto.status)

    return {
      subject,
      name: dto.name.trim(),
      description: dto.description ?? null,
      status: dto.status ?? 'active',
      metadata: this.metadataOrDefault(dto.metadata),
    }
  }

  private buildUpdateData(
    dto: UpdateSdxWidgetDto | PatchSdxWidgetDto,
    replace: boolean,
    allowEmpty = false,
  ): Prisma.SdxWidgetUpdateInput {
    if (replace) {
      this.validateName(dto.name, true)
    } else if (dto.name !== undefined) {
      this.validateName(dto.name, false)
    }

    this.validateDescription(dto.description)
    this.validateStatus(dto.status)

    const data: Prisma.SdxWidgetUpdateInput = {}
    if (replace) {
      data.name = dto.name!.trim()
      data.description = dto.description ?? null
      data.status = dto.status ?? 'active'
      data.metadata = this.metadataOrDefault(dto.metadata)
    } else {
      if (dto.name !== undefined) {
        data.name = dto.name.trim()
      }
      if (dto.description !== undefined) {
        data.description = dto.description
      }
      if (dto.status !== undefined) {
        data.status = dto.status
      }
      if (dto.metadata !== undefined) {
        data.metadata = this.metadataOrDefault(dto.metadata)
      }
    }

    if (!Object.keys(data).length && !allowEmpty) {
      throw new UnprocessableEntityException('At least one widget field is required')
    }
    return data
  }

  private buildAdminUpdateData(
    dto: AdminUpdateSdxWidgetDto | AdminPatchSdxWidgetDto,
    replace: boolean,
  ): Prisma.SdxWidgetUpdateInput {
    const data = this.buildUpdateData(dto, replace, dto.subject !== undefined)
    if (dto.subject !== undefined) {
      this.validateSubject(dto.subject)
      data.subject = dto.subject
    }
    return data
  }

  private validateSubject(subject: string): void {
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) {
      throw new UnprocessableEntityException(
        'subject must be a non-empty string up to 255 characters',
      )
    }
  }

  private validateName(name: string | undefined, required: boolean): void {
    if (required && name === undefined) {
      throw new UnprocessableEntityException('name is required')
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 200)) {
      throw new UnprocessableEntityException('name must be a non-empty string up to 200 characters')
    }
  }

  private validateDescription(description: unknown): void {
    if (
      description !== undefined &&
      description !== null &&
      (typeof description !== 'string' || description.length > 1000)
    ) {
      throw new UnprocessableEntityException('description must be 1000 characters or fewer')
    }
  }

  private validateStatus(status: unknown): void {
    if (
      status !== undefined &&
      (typeof status !== 'string' || !SDX_WIDGET_STATUSES.includes(status as SdxWidgetStatus))
    ) {
      throw new UnprocessableEntityException(`status must be one of: ${SDX_WIDGET_STATUSES.join(', ')}`)
    }
  }

  private validateWidgetId(widgetId: string): void {
    if (typeof widgetId !== 'string' || !UUID_PATTERN.test(widgetId)) {
      throw new BadRequestException('widgetId must be a valid UUID')
    }
  }

  private normalizeIdempotencyKey(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined
    }
    if (typeof value !== 'string') {
      throw new UnprocessableEntityException('Idempotency-Key must be a string')
    }
    const trimmed = value.trim()
    if (trimmed.length < 8 || trimmed.length > 255) {
      throw new UnprocessableEntityException('Idempotency-Key must be between 8 and 255 characters')
    }
    return trimmed
  }

  private hashIdempotentCreateRequest(data: Prisma.SdxWidgetCreateInput): string {
    // The idempotency key is scoped to the authenticated subject, so we do not include subject here.
    // We do include server-applied defaults so retries can omit optional fields consistently.
    const canonical = this.stableStringify({
      name: data.name,
      description: data.description,
      status: data.status,
      metadata: data.metadata,
    })
    return createHash('sha256').update(canonical, 'utf8').digest('hex')
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return JSON.stringify(value)
    }
    if (typeof value !== 'object') {
      return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`
    }

    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const entries = keys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
    return `{${entries.join(',')}}`
  }

  private metadataOrDefault(metadata: unknown): InputJsonValue {
    if (metadata === undefined) {
      return {}
    }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      throw new UnprocessableEntityException('metadata must be a JSON object')
    }
    this.validateJsonValue(metadata, 'metadata')
    return metadata as InputJsonValue
  }

  private validateJsonValue(value: unknown, path: string): void {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => this.validateJsonValue(item, `${path}[${index}]`))
      return
    }

    if (typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) {
          throw new BadRequestException(`${path}.${key} must be valid JSON`)
        }
        this.validateJsonValue(item, `${path}.${key}`)
      }
      return
    }

    throw new BadRequestException(`${path} must be valid JSON`)
  }

  private requireWidget(widget: WidgetRecord | null): SdxWidgetDto {
    if (!widget) {
      throw new NotFoundException('SDX Widget not found')
    }
    return this.toDto(widget)
  }

  private toDto(widget: WidgetRecord): SdxWidgetDto {
    return {
      id: widget.id,
      subject: widget.subject,
      name: widget.name,
      description: widget.description,
      status: widget.status as SdxWidgetStatus,
      metadata:
        widget.metadata && typeof widget.metadata === 'object' && !Array.isArray(widget.metadata)
          ? (widget.metadata as Record<string, unknown>)
          : {},
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
    }
  }

  private async listWidgets(
    where: Pick<Prisma.SdxWidgetWhereInput, 'subject'>,
    query: ListSdxWidgetsQueryDto,
  ): Promise<SdxWidgetListResponseDto> {
    const parsed = this.parseListQuery(query)
    const widgets = await this.prisma.sdxWidget.findMany({
      where: {
        ...where,
        ...(parsed.status ? { status: parsed.status } : {}),
        ...(parsed.name
          ? {
              name: {
                contains: parsed.name,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: [
        { [parsed.sortBy]: parsed.sortOrder },
        { id: parsed.sortOrder },
      ],
      skip: parsed.cursorOffset,
      take: parsed.limit + 1,
    })

    const hasNextPage = widgets.length > parsed.limit
    const items = widgets.slice(0, parsed.limit).map((widget) => this.toDto(widget))

    return {
      items,
      nextCursor: hasNextPage
        ? this.encodeCursor(parsed.cursorOffset + parsed.limit)
        : null,
    }
  }

  private parseListQuery(query: ListSdxWidgetsQueryDto): ParsedListQuery {
    const limit = this.parseLimit(query.limit)
    const cursorOffset = this.parseCursor(query.cursor)
    const status = this.parseStatusFilter(query.status)
    const name = this.parseNameFilter(query.name)
    const sortBy = this.parseSortBy(query.sortBy)
    const sortOrder = this.parseSortOrder(query.sortOrder)

    return {
      cursorOffset,
      limit,
      ...(name ? { name } : {}),
      sortBy,
      sortOrder,
      ...(status ? { status } : {}),
    }
  }

  private parseLimit(limit: string | undefined): number {
    if (limit === undefined) {
      return 25
    }

    if (!/^\d+$/.test(limit)) {
      throw new BadRequestException('limit must be an integer between 1 and 100')
    }

    const parsed = Number.parseInt(limit, 10)
    if (parsed < 1 || parsed > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100')
    }

    return parsed
  }

  private parseCursor(cursor: string | undefined): number {
    if (cursor === undefined) {
      return 0
    }

    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        offset?: unknown
      }

      if (
        typeof decoded.offset !== 'number' ||
        !Number.isInteger(decoded.offset) ||
        decoded.offset < 0
      ) {
        throw new Error('invalid cursor offset')
      }

      return decoded.offset
    } catch {
      throw new BadRequestException('cursor must be a valid pagination cursor')
    }
  }

  private parseStatusFilter(status: string | undefined): SdxWidgetStatus | undefined {
    if (status === undefined) {
      return undefined
    }

    if (!SDX_WIDGET_STATUSES.includes(status as SdxWidgetStatus)) {
      throw new BadRequestException(`status must be one of: ${SDX_WIDGET_STATUSES.join(', ')}`)
    }

    return status as SdxWidgetStatus
  }

  private parseNameFilter(name: string | undefined): string | undefined {
    if (name === undefined) {
      return undefined
    }

    if (!name.trim() || name.length > 200) {
      throw new BadRequestException('name must be a non-empty string up to 200 characters')
    }

    return name.trim()
  }

  private parseSortBy(sortBy: string | undefined): SdxWidgetSortField {
    if (sortBy === undefined) {
      return 'createdAt'
    }

    if (!SDX_WIDGET_SORT_FIELDS.includes(sortBy as SdxWidgetSortField)) {
      throw new BadRequestException(
        `sortBy must be one of: ${SDX_WIDGET_SORT_FIELDS.join(', ')}`,
      )
    }

    return sortBy as SdxWidgetSortField
  }

  private parseSortOrder(sortOrder: string | undefined): SdxWidgetSortDirection {
    if (sortOrder === undefined) {
      return 'desc'
    }

    if (!SDX_WIDGET_SORT_DIRECTIONS.includes(sortOrder as SdxWidgetSortDirection)) {
      throw new BadRequestException(
        `sortOrder must be one of: ${SDX_WIDGET_SORT_DIRECTIONS.join(', ')}`,
      )
    }

    return sortOrder as SdxWidgetSortDirection
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
  }
}
