/** Domain errors that map cleanly onto HTTP status codes. */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const forbidden = (message = "You do not have permission to do that") =>
  new HttpError(403, message);
export const notFound = (what = "Record") => new HttpError(404, `${what} not found`);
export const conflict = (message: string) => new HttpError(409, message);
