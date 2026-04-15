import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import compression from "compression";
import express from "express";
import path from "node:path";
import { AppModule } from "./app.module";
import { AppService } from "./common/app.service";
import { DatabaseService } from "./common/database.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );
  app.use(compression({ threshold: 1024 }));

  const storageDir = path.resolve(process.cwd(), "storage");
  app.use("/storage", express.static(storageDir));

  const databaseService = app.get(DatabaseService);
  await databaseService.ensureReady();

  const appService = app.get(AppService);
  await appService.onModuleInit();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`PulsePresence API listening on http://127.0.0.1:${port}`);
}

bootstrap();
