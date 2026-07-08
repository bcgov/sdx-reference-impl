import { ApiProperty, ApiSchema } from '@nestjs/swagger'

@ApiSchema({
  name: 'UserSummary',
  description: 'A known user that currently owns one or more widgets.',
})
export class UserSummaryDto {
  @ApiProperty({
    description: 'Immutable subject identifier from the access token.',
    example: 'user-123',
  })
  subject: string

  @ApiProperty({
    description:
      'Most recently observed display name from the user access token, or the subject identifier until a name is observed.',
    example: 'Alex Smith',
  })
  displayName: string

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'Number of widgets currently owned by the subject.',
    example: 3,
  })
  widgetCount: number

  @ApiProperty({
    format: 'date-time',
    description: 'Last time the user made an authenticated request to this API.',
  })
  lastSeenAt: Date
}
