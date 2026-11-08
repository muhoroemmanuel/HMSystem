import { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { HttpError } from "../lib/errors";

/** Wraps an async handler so rejected promises reach the error middleware. */
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

/** Validates `req.body` and replaces it with the parsed value. */
export function validate<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return res.status(400).json({
        message: details[0] ? `${details[0].path || "body"}: ${details[0].message}` : "Invalid request",
        errors: details,
      });
    }
    req.body = result.data;
    return next();
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Endpoint not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid request",
      errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // Postgres unique violation -> a friendly 409 instead of a 500
  const pgErr = err as { code?: string; constraint?: string; detail?: string };
  if (pgErr && typeof pgErr.code === "string") {
    if (pgErr.code === "23505" || pgErr.code === "23P01" || pgErr.code === "23505") {
      return res.status(409).json({ message: "That record already exists." });
    }
    if (pgErr.code === "23503") {
      // Raised by RESTRICT / NO ACTION foreign keys. Deleting a drug that has
      // been sold, or a doctor with appointments, would break the audit trail,
      // so the database protects it. Say so in plain language.
      const detail = pgErr.detail || "";
      const referenced = /table "(\w+)"/.exec(detail)?.[1];
      const friendly: Record<string, string> = {
        sale_items: "This item has already been sold and must be kept for the sales record. Mark it inactive instead.",
        prescription_items: "This item appears on a prescription and must be kept for the patient record. Mark it inactive instead.",
        appointments: "This doctor has appointments on record and cannot be removed. Mark them inactive instead.",
        invoices: "This patient has invoices on record and cannot be removed.",
        prescriptions: "This patient has prescriptions on record and cannot be removed.",
        roles: "This role is assigned to staff accounts.",
      };
      return res.status(409).json({
        message:
          (referenced && friendly[referenced]) ||
          "This record is linked to other records, so it cannot be deleted. Mark it inactive instead.",
      });
    }
    if (pgErr.code === "23514") {
      return res.status(400).json({ message: "A value is outside the allowed range." });
    }
  }
  console.error("[api] unhandled error", err);
  return res.status(500).json({ message: "Something went wrong on our side." });
}
