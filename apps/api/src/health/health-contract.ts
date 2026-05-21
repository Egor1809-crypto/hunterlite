import { ok, type ApiResponse } from "../http/api-response";

export type HealthStatus = {
  service: "hunterlite-api";
  status: "ok";
  database: "configured";
  timestamp: string;
};

export const createHealthStatus = (now = new Date()): ApiResponse<HealthStatus> =>
  ok({
    service: "hunterlite-api",
    status: "ok",
    database: "configured",
    timestamp: now.toISOString(),
  });
