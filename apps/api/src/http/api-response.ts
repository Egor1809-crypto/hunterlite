export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiSuccess<TData> = {
  ok: true;
  data: TData;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export const ok = <TData>(data: TData, meta?: Record<string, unknown>): ApiSuccess<TData> => ({
  ok: true,
  data,
  ...(meta ? { meta } : {}),
});

export const fail = (
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiFailure => ({
  ok: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});
