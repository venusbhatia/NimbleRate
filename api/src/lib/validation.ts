import type { Request } from "express";
import { z } from "zod";
import { RequestValidationError } from "./http.js";

function coerceQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export const zOptionalString = z.preprocess(
  coerceQueryValue,
  z
    .string()
    .trim()
    .min(1)
    .optional()
);

export const zRequiredString = z.preprocess(
  coerceQueryValue,
  z
    .string()
    .trim()
    .min(1)
);

export const zOptionalNumber = z.preprocess(
  coerceQueryValue,
  z.coerce.number().finite().optional()
);

export const zOptionalBoolean = z.preprocess(
  coerceQueryValue,
  z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional()
);

export function validateQuery<TSchema extends z.ZodTypeAny>(req: Request, schema: TSchema): z.infer<TSchema> {
  const parsed = schema.safeParse(req.query);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "query";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new RequestValidationError(message);
  }

  return parsed.data;
}
