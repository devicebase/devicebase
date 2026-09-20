/**
 * Error hierarchy shared by the SDK and the CLI.
 *
 * Two failure layers are surfaced, mirroring the Go CLI:
 *
 * - **Transport** — the HTTP status is non-2xx. `statusCode` carries it and the
 *   server's body is kept in the message, so `设备不存在: …` survives instead of
 *   being replaced by a generic label.
 * - **Business** — HTTP 200 with a non-2xx `code` in the response envelope.
 *   `code` carries it (see `HttpTransport`'s envelope check). This layer matters
 *   for automation: an action can fail inside an otherwise successful response,
 *   so guarding on the status line alone would report it as success.
 */

export class DeviceBaseError extends Error {
  readonly statusCode?: number
  readonly code?: number

  constructor(message: string, statusCode?: number, code?: number) {
    super(message)
    this.name = 'DeviceBaseError'
    this.statusCode = statusCode
    this.code = code
  }
}

export class DeviceNotFoundError extends DeviceBaseError {
  constructor(message: string, statusCode?: number, code?: number) {
    super(message, statusCode, code)
    this.name = 'DeviceNotFoundError'
  }
}

export class ValidationError extends DeviceBaseError {
  constructor(message: string, statusCode?: number, code?: number) {
    super(message, statusCode, code)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends DeviceBaseError {
  constructor(message: string, statusCode?: number, code?: number) {
    super(message, statusCode, code)
    this.name = 'AuthenticationError'
  }
}
