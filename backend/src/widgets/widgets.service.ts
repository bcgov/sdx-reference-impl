import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { Prisma } from '../../generated/prisma/client.js'
import type { InputJsonValue } from '@prisma/client/runtime/client'
import { CreateWidgetDto } from './dto/create-widget.dto'
import {
  AdminPatchWidgetDto,
  AdminUpdateWidgetDto,
  PatchWidgetDto,
  UpdateWidgetDto,
} from './dto/update-widget.dto'
import { WidgetDto, WidgetStatus, WIDGET_STATUSES } from './dto/widget.dto'

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

@Injectable()
export class WidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForSubject(subject: string, dto: CreateWidgetDto): Promise<WidgetDto> {
    const data = this.buildCreateData(subject, dto)
    const widget = await this.prisma.widgets.create({ data })
    return this.toDto(widget)
  }

  async listForSubject(subject: string): Promise<WidgetDto[]> {
    const widgets = await this.prisma.widgets.findMany({
      where: { subject },
      orderBy: { createdAt: 'desc' },
    })
    return widgets.map((widget) => this.toDto(widget))
  }

  async getForSubject(widgetId: string, subject: string): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    const widget = await this.prisma.widgets.findFirst({
      where: { id: widgetId, subject },
    })
    return this.requireWidget(widget)
  }

  async replaceForSubject(
    widgetId: string,
    subject: string,
    dto: UpdateWidgetDto,
  ): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    const widget = await this.prisma.widgets.update({
      where: { id: widgetId },
      data: this.buildUpdateData(dto, true),
    })
    return this.toDto(widget)
  }

  async patchForSubject(
    widgetId: string,
    subject: string,
    dto: PatchWidgetDto,
  ): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    const widget = await this.prisma.widgets.update({
      where: { id: widgetId },
      data: this.buildUpdateData(dto, false),
    })
    return this.toDto(widget)
  }

  async deleteForSubject(widgetId: string, subject: string): Promise<void> {
    this.validateWidgetId(widgetId)
    await this.getForSubject(widgetId, subject)
    await this.prisma.widgets.delete({ where: { id: widgetId } })
  }

  async adminCreateForSubject(subject: string, dto: CreateWidgetDto): Promise<WidgetDto> {
    return this.createForSubject(subject, dto)
  }

  async adminListForSubject(subject: string): Promise<WidgetDto[]> {
    return this.listForSubject(subject)
  }

  async adminGet(widgetId: string): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    const widget = await this.prisma.widgets.findUnique({ where: { id: widgetId } })
    return this.requireWidget(widget)
  }

  async adminReplace(widgetId: string, dto: AdminUpdateWidgetDto): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    const widget = await this.prisma.widgets.update({
      where: { id: widgetId },
      data: this.buildAdminUpdateData(dto, true),
    })
    return this.toDto(widget)
  }

  async adminPatch(widgetId: string, dto: AdminPatchWidgetDto): Promise<WidgetDto> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    const widget = await this.prisma.widgets.update({
      where: { id: widgetId },
      data: this.buildAdminUpdateData(dto, false),
    })
    return this.toDto(widget)
  }

  async adminDelete(widgetId: string): Promise<void> {
    this.validateWidgetId(widgetId)
    await this.adminGet(widgetId)
    await this.prisma.widgets.delete({ where: { id: widgetId } })
  }

  private buildCreateData(subject: string, dto: CreateWidgetDto): Prisma.widgetsCreateInput {
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
    dto: UpdateWidgetDto | PatchWidgetDto,
    replace: boolean,
    allowEmpty = false,
  ): Prisma.widgetsUpdateInput {
    if (replace) {
      this.validateName(dto.name, true)
    } else if (dto.name !== undefined) {
      this.validateName(dto.name, false)
    }

    this.validateDescription(dto.description)
    this.validateStatus(dto.status)

    const data: Prisma.widgetsUpdateInput = {}
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

    if (!Object.keys(data).length && !allowEmpty) {
      throw new UnprocessableEntityException('At least one widget field is required')
    }
    return data
  }

  private buildAdminUpdateData(
    dto: AdminUpdateWidgetDto | AdminPatchWidgetDto,
    replace: boolean,
  ): Prisma.widgetsUpdateInput {
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
      (typeof status !== 'string' || !WIDGET_STATUSES.includes(status as WidgetStatus))
    ) {
      throw new UnprocessableEntityException(`status must be one of: ${WIDGET_STATUSES.join(', ')}`)
    }
  }

  private validateWidgetId(widgetId: string): void {
    if (typeof widgetId !== 'string' || !UUID_PATTERN.test(widgetId)) {
      throw new BadRequestException('widgetId must be a valid UUID')
    }
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

  private requireWidget(widget: WidgetRecord | null): WidgetDto {
    if (!widget) {
      throw new NotFoundException('Widget not found')
    }
    return this.toDto(widget)
  }

  private toDto(widget: WidgetRecord): WidgetDto {
    return {
      id: widget.id,
      subject: widget.subject,
      name: widget.name,
      description: widget.description,
      status: widget.status as WidgetStatus,
      metadata:
        widget.metadata && typeof widget.metadata === 'object' && !Array.isArray(widget.metadata)
          ? (widget.metadata as Record<string, unknown>)
          : {},
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
    }
  }
}
