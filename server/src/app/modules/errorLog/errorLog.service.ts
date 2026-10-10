import { Prisma } from "@prisma/client";
import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TErrorLog } from "./errorLog.interface";

// ! 30 days. Rolling 30x24h window evaluated once a day by the cron route, so retention is
// ! "at least 30 days, up to ~31" — a row written Jan 1 10:00 is past the cutoff from
// ! Jan 31 10:00, so the 03:00 run on Feb 1 removes it. Erring long is the safe direction.
const RETENTION_DAYS = 30;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ! both clients read `_id`, same convention as transaction.service.ts's toApiShape
const toApiShape = <T extends { id: string }>(errorLog: T) => ({
  ...errorLog,
  _id: errorLog.id,
});

const createErrorLog = async (payload: TErrorLog) => {
  return await prisma.errorLog.create({
    data: {
      id: generateObjectId(),
      status: payload.status,
      message: payload.message,
      errorName: payload.errorName,
      errorSources: payload.errorSources as Prisma.InputJsonValue | undefined,
      stack: payload.stack,
      method: payload.method,
      path: payload.path,
      userId: payload.userId,
      userEmail: payload.userEmail,
    },
  });
};

// ! Query params are ALLOWLISTED and coerced, never spread into `where`. Passing them through
// ! (as the reference implementation does) is a 500 waiting to happen here: `status` is an Int
// ! column, so `?status=500` arrives as the string "500" and Prisma throws
// ! PrismaClientValidationError — as does any unrecognised key. There is no pre-existing
// ! pagination contract in this repo to stay compatible with, so this is a clean allowlist.
const buildListQuery = (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query.limit) || DEFAULT_LIMIT),
  );

  const allowedSorts: Record<string, Prisma.ErrorLogOrderByWithRelationInput> =
    {
      createdAt: { createdAt: "asc" },
      "-createdAt": { createdAt: "desc" },
      status: { status: "asc" },
      "-status": { status: "desc" },
    };
  const orderBy =
    allowedSorts[String(query.sort ?? "")] ?? allowedSorts["-createdAt"];

  const where: Prisma.ErrorLogWhereInput = {};

  const status = Number(query.status);
  if (query.status !== undefined && !Number.isNaN(status)) {
    where.status = status;
  }

  if (typeof query.method === "string" && query.method.trim()) {
    where.method = query.method.trim().toUpperCase();
  }

  // ! substring, not equality — "which routes are failing" is the actual question here
  if (typeof query.path === "string" && query.path.trim()) {
    where.path = { contains: query.path.trim(), mode: "insensitive" };
  }

  return { where, orderBy, skip: (page - 1) * limit, take: limit, page, limit };
};

const getErrorLogsFromDB = async (query: Record<string, unknown>) => {
  const { where, orderBy, skip, take, page, limit } = buildListQuery(query);

  const [rows, total] = await Promise.all([
    prisma.errorLog.findMany({ where, orderBy, skip, take }),
    prisma.errorLog.count({ where }),
  ]);

  return {
    result: rows.map(toApiShape),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getErrorLogByIdFromDB = async (id: string) => {
  const errorLog = await prisma.errorLog.findUnique({ where: { id } });

  if (!errorLog) {
    throw new AppError(httpStatus.NOT_FOUND, "Error log not found");
  }

  return toApiShape(errorLog);
};

// ! daily cron target — Postgres has no equivalent to Mongo's TTL-index background sweep,
// ! so expiry must be triggered externally (.github/workflows/daily-error-log-cleanup.yml)
const cleanupExpiredErrorLogsFromDB = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await prisma.errorLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deletedCount: count, cutoff };
};

export const errorLogServices = {
  createErrorLog,
  getErrorLogsFromDB,
  getErrorLogByIdFromDB,
  cleanupExpiredErrorLogsFromDB,
};
