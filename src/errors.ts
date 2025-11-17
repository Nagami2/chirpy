export class ValidationError extends Error {
  // 400 bad request
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  // 401 UnauthorizedError
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  // 403 ForbiddenError
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  // 404 NotFoundError
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
