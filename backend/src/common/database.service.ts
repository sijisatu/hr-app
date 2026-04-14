import { Injectable, OnModuleDestroy } from "@nestjs/common";

type PrismaClientLike = {
  $disconnect(): Promise<void>;
  $queryRawUnsafe(query: string): Promise<unknown>;
};

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "development";
  private readonly storageMode = process.env.APP_STORAGE_MODE?.trim().toLowerCase() ?? "auto";
  private readonly databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  private prismaClient: PrismaClientLike | null = null;

  isEnabled() {
    if (this.storageMode === "json") {
      return false;
    }

    if (this.storageMode === "database") {
      return true;
    }

    return this.databaseUrl.length > 0;
  }

  isStrictDatabaseMode() {
    return this.storageMode === "database" || this.nodeEnv === "production";
  }

  getModeLabel() {
    return this.isEnabled() ? "postgresql-configured" : "local-json";
  }

  getClient() {
    if (!this.isEnabled()) {
      return null;
    }

    if (!this.databaseUrl) {
      throw new Error("DATABASE_URL is required when APP_STORAGE_MODE uses database.");
    }

    if (!this.prismaClient) {
      const { PrismaClient } = require("@prisma/client") as { PrismaClient: new () => PrismaClientLike };
      this.prismaClient = new PrismaClient();
    }

    return this.prismaClient;
  }

  async healthcheck() {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        status: "not-configured"
      } as const;
    }

    try {
      const prisma = this.getClient();
      if (!prisma) {
        return {
          enabled: false,
          status: "not-configured"
        } as const;
      }

      await prisma.$queryRawUnsafe("SELECT 1");
      return {
        enabled: true,
        status: "online"
      } as const;
    } catch (error) {
      return {
        enabled: true,
        status: "offline",
        message: error instanceof Error ? error.message : "Unknown database error"
      } as const;
      }
  }

  async ensureReady() {
    if (!this.isEnabled()) {
      if (this.isStrictDatabaseMode()) {
        throw new Error("Database is required in the current runtime mode, but DATABASE_URL is not configured.");
      }

      return;
    }

    const status = await this.healthcheck();
    if (status.status !== "online") {
      throw new Error(status.message ?? "Database connection is not ready.");
    }
  }

  async onModuleDestroy() {
    await this.prismaClient?.$disconnect();
  }
}
