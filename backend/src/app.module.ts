import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./common/app.service";
import { RolesGuard, SessionAuthGuard } from "./common/authz";
import { DatabaseService } from "./common/database.service";
import { IdempotencyInterceptor } from "./common/idempotency.interceptor";
import { MetricsService } from "./common/metrics.service";

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseService,
    MetricsService,
    IdempotencyInterceptor,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
