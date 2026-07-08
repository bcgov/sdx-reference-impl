import 'dotenv/config'
import type { MiddlewareConsumer } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HTTPLoggerMiddleware } from './middleware/req.res.logger'
import { ConfigModule } from '@nestjs/config'
import { WidgetsModule } from './widgets/widgets.module'
import { AppService } from './app.service'
import { AppController } from './app.controller'
import { MetricsController } from './metrics.controller'
import { HealthController } from './health.controller'
import { HttpExceptionFilter } from './common/http-exception.filter'

@Module({
  imports: [ConfigModule.forRoot(), WidgetsModule],
  controllers: [AppController, MetricsController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {
  // let's add a middleware on all routes
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HTTPLoggerMiddleware)
      .exclude(
        { path: 'metrics', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
      )
      .forRoutes('*')
  }
}
