import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import type { UserSummaryDto } from './dto/user.dto'

type UserRecord = {
  subject: string
  displayName: string
  lastSeenAt: Date
}

@Injectable()
export class UserDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAuthenticatedUser(subject: string, claims: Record<string, unknown>): Promise<void> {
    const displayName = this.displayNameFromClaims(claims)

    await this.prisma.user.upsert({
      where: { subject },
      create: {
        subject,
        displayName: displayName ?? subject,
        lastSeenAt: new Date(),
      },
      update: {
        ...(displayName ? { displayName } : {}),
        lastSeenAt: new Date(),
      },
    })
  }

  async listUsersWithWidgets(): Promise<UserSummaryDto[]> {
    const ownership = await this.prisma.widget.groupBy({
      by: ['subject'],
      _count: { _all: true },
      orderBy: { subject: 'asc' },
    })
    const subjects = ownership.map((entry) => entry.subject)
    const users =
      subjects.length === 0
        ? []
        : ((await this.prisma.user.findMany({
            where: { subject: { in: subjects } },
          })) as UserRecord[])
    const usersBySubject = new Map(users.map((user) => [user.subject, user]))

    return ownership
      .map((entry) => {
        const user = usersBySubject.get(entry.subject)!
        return {
          subject: entry.subject,
          displayName: user.displayName,
          widgetCount: entry._count._all,
          lastSeenAt: user.lastSeenAt,
        }
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  }

  private displayNameFromClaims(claims: Record<string, unknown>): string | undefined {
    for (const claim of ['name', 'preferred_username', 'email']) {
      const value = claims[claim]
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 255)
      }
    }
    return undefined
  }
}
