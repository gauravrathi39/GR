/**
 * Augments Express's Request with the authenticated user id set by the auth
 * middleware. Keeps controllers type-safe when reading req.userId.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
