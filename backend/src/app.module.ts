import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./common/app.service";
import { DatabaseService } from "./common/database.service";

@Module({
  controllers: [AppController],
  providers: [AppService, DatabaseService]
})
export class AppModule {}
