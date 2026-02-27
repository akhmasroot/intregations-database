import { PrismaLibSql } from "@prisma/adapter-libsql";

// Prisma 7 requires importing from .prisma/client for the generated client
const { PrismaClient } = require(".prisma/client");

type PrismaClientType = ReturnType<typeof PrismaClient.prototype.constructor> | Record<string, unknown>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function createPrismaClient(): PrismaClientType {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const db: PrismaClientType = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
