import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import compression from "compression";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { AppService } from "./common/app.service";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { DatabaseService } from "./common/database.service";
import { MetricsService } from "./common/metrics.service";

async function bootstrap() {
  const allowOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Session-Key", "X-Request-Id"]
    }
  });
  app.setGlobalPrefix("");
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      xFrameOptions: isProduction ? { action: "sameorigin" } : false
    })
  );
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    app.use((req: Request, res: Response, nextFn: NextFunction) => {
      const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.toLowerCase();
      if (forwardedProto !== "https") {
        res.status(400).json({ success: false, error: "HTTPS is required in production.", data: null });
        return;
      }
      nextFn();
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use(compression({ threshold: 1024 }));

  const metricsService = app.get(MetricsService);
  app.use((req: Request, res: Response, nextFn: NextFunction) => {
    const startedAt = Date.now();
    const requestId =
      (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()) ||
      randomUUID();
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      metricsService.recordRequest({
        timestamp: Date.now(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs
      });

      console.log(JSON.stringify({
        event: "http.request",
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        userAgent: req.headers["user-agent"] ?? null,
        remoteIp: req.ip,
        timestamp: new Date().toISOString()
      }));
    });

    nextFn();
  });

  const storageDir = path.resolve(process.cwd(), "storage");
  app.use((req: Request, res: Response, nextFn: NextFunction) => {
    const target = req.path || "";
    const blockedOnlyInProd =
      target.startsWith("/storage/attendance-selfies") ||
      target.startsWith("/storage/documents/employee-files") ||
      target.startsWith("/storage/reimbursements/receipts");
    if (isProduction && blockedOnlyInProd) {
      res.status(403).json({ success: false, error: "Forbidden", data: null });
      return;
    }
    nextFn();
  });
  app.use("/storage", express.static(storageDir));
  app.use(
    "/api/auth/employee-login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 15,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: "Too many login attempts. Please try again later.", data: null }
    })
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      max: 240,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.method === "GET"
    })
  );

  const databaseService = app.get(DatabaseService);
  await databaseService.ensureReady();

  const appService = app.get(AppService);
  await appService.onModuleInit();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`PulsePresence API listening on http://127.0.0.1:${port}`);
}

bootstrap();
