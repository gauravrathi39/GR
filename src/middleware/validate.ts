import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

type Schemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

/**
 * Validates and coerces request parts against zod schemas. On success the
 * parsed (typed, trimmed, coerced) values replace the raw ones. On failure the
 * ZodError propagates to the central error handler as a 400.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params) as Request["params"];
    if (schemas.query) {
      // req.query is a getter-only in some setups; assign parsed copy defensively.
      Object.assign(req.query, schemas.query.parse(req.query));
    }
    next();
  };
}

export type Infer<T extends ZodTypeAny> = ZodInfer<T>;
