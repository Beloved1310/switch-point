/** Failure kinds use cases can raise; the HTTP layer maps them to status codes. */
export type ErrorKind =
  | "invalid"
  | "unauthorised"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unavailable";

export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const invalid = (message: string) => new AppError("invalid", message);
export const notFound = (message: string) => new AppError("not_found", message);
export const conflict = (message: string) => new AppError("conflict", message);
export const unavailable = (message: string) => new AppError("unavailable", message);
