import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { Prisma } from '../../generated/prisma/client.js'
import type { InputJsonValue } from '@prisma/client/runtime/client'
import { CreateSdxWidgetDto } from './dto/create-sdx-widget.dto'
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

@Injectable()
export class SdxWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForSubject(subject: string, dto: CreateSdxWidgetDto): Promise<SdxWidgetDto> {
    const data = this.buildCreateData(subject, dto)
    const widget = await this.prisma.sdxWidget.create({ data })
    return this.toDto(widget)
  }

  async listForSubject(subject: string): Promise<SdxWidgetDto[]> {
    const widgets = await this.prisma.sdxWidget.findMany({
      where: { subject },
      orderBy: { createdAt: 'desc' },
    })
    return widgets.map((widget) => this.toDto(widget))
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

  async adminCreateForSubject(subject: string, dto: CreateSdxWidgetDto): Promise<SdxWidgetDto> {
    return this.createForSubject(subject, dto)
  }

  async adminListForSubject(subject: string): Promise<SdxWidgetDto[]> {
    return this.listForSubject(subject)
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
}
