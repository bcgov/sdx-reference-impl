import type { NestExpressApplication } from '@nestjs/platform-express'
import { bootstrap } from './app'
import { Logger } from '@nestjs/common'
const logger = new Logger('NestApplication')
bootstrap()
  .then(async (app: NestExpressApplication) => {
    const port = Number.parseInt(process.env.PORT || '3000', 10)
    const host = process.env.HOST || '0.0.0.0'
    await app.listen(port, host)
    logger.log(`Listening on ${await app.getUrl()}`)
    logger.log(`Process start up took ${process.uptime()} seconds`)
  })
  .catch((err) => {
    logger.error(err)
  })
