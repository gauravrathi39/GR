/**
 * Operational error carrying an HTTP status code. Thrown anywhere in the
 * service/controller layer and translated to a JSON response by the central
 * error handler. Distinguishes expected failures (400/401/404) from bugs (500).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message = "Bad request") {
    return new AppError(400, message);
  }
  static unauthorized(message = "Unauthorized") {
    return new AppError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, message);
  }
  static conflict(message = "Conflict") {
    return new AppError(409, message);
  }
}
