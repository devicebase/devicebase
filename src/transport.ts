import process from 'node:process'
import {
  AuthenticationError,
  DeviceBaseError,
  DeviceNotFoundError,
  ValidationError,
} from './errors.js'

const DEFAULT_BASE_URL = 'https://api.devicebase.cn'
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Cap on the body text kept in an error message. A failed action's envelope is
 * small; this only guards against a misrouted binary response being pasted into
 * a terminal.
 */
const MAX_ERROR_BODY_CHARS = 4096

/**
 * Bodies larger than this are never sniffed for an envelope. Screenshots run to
 * hundreds of kilobytes and decoding one as UTF-8 to look for a JSON error would
 * waste the whole read.
 */
const ENVELOPE_SNIFF_BYTES = 64 * 1024

/** A constructor, as accepted by the per-platform API mixins in `./api`. */
export type Constructor<T = object> = new (...args: any[]) => T

export interface HttpClientConfig {
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

export interface RequestOptions {
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  /**
   * Deadline for this call in milliseconds, overriding the client-wide timeout.
   *
   * `fetch`'s abort signal bounds the whole request including the body read, so
   * an action that blocks server-side (`computer wait`, `computer bash`) has to
   * raise it per call — the 30s default would abort work the server is still
   * doing and report a transport error for a call that actually succeeded.
   */
  timeout?: number
}

/**
 * Bearer tokens, held outside the client object.
 *
 * `HttpTransport` carries no private members on purpose: `DeviceBaseHttpClient`
 * extends an anonymous class returned by the `./api` mixins, and TypeScript
 * cannot emit a declaration for such a base type if it has `private`,
 * `protected` or `#`-private members (TS4094). Keeping the token in a WeakMap
 * both satisfies that and keeps a credential out of `console.log(client)` and
 * `JSON.stringify(client)`.
 */
const API_KEYS = new WeakMap<object, string>()

/**
 * HTTP transport: base URL, Bearer auth, envelope inspection and error mapping.
 *
 * Platform methods live in the mixins under `./api`; this class deliberately
 * knows nothing about devices. `requestJson` / `requestBytes` are public so an
 * endpoint without a typed method can still be reached.
 */
export class HttpTransport {
  /** Base URL, trailing slashes removed. */
  readonly baseUrl: string
  /** Default deadline for a request, in milliseconds. */
  readonly timeout: number

  constructor(config: HttpClientConfig = {}) {
    // A trailing slash would turn every appended path into "//v1/…".
    this.baseUrl = (config.baseUrl ?? process.env.DEVICEBASE_BASE_URL ?? DEFAULT_BASE_URL)
      .replace(/\/+$/, '')
    const apiKey = config.apiKey ?? process.env.DEVICEBASE_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via \'apiKey\' config or DEVICEBASE_API_KEY environment variable.',
      )
    }
    API_KEYS.set(this, apiKey)
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS
  }

  /** Send a request and parse the JSON envelope it returns. */
  async requestJson(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<Record<string, unknown>> {
    const response = await send(this, method, path, options)
    const text = await response.text()
    if (!text) {
      return {}
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    }
    catch {
      throw new DeviceBaseError(
        `Invalid JSON response: ${truncate(text)}`,
        response.status,
      )
    }
    assertEnvelopeOk(text)
    return data as Record<string, unknown>
  }

  /**
   * Send a request and return the raw body, for endpoints that answer with bytes
   * rather than JSON (screenshots). The envelope is still inspected, so a failed
   * action that answers HTTP 200 with a JSON error is not handed back as image
   * data.
   */
  async requestBytes(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<ArrayBuffer> {
    const response = await send(this, method, path, options)
    const buffer = await response.arrayBuffer()
    assertEnvelopeOk(sniffJsonPrefix(new Uint8Array(buffer)))
    return buffer
  }
}

/** Send a request, mapping a non-2xx status onto the matching error class. */
async function send(
  transport: HttpTransport,
  method: string,
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const response = await fetch(buildUrl(transport.baseUrl, path, options.query), {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEYS.get(transport) ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout ?? transport.timeout),
  })
  if (!response.ok) {
    throw await describeHttpError(response)
  }
  return response
}

/** Build a full URL from a path and optional query params (null/undefined/empty values are skipped). */
function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  if (!query) {
    return `${baseUrl}${path}`
  }
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    searchParams.set(key, String(value))
  }
  const qs = searchParams.toString()
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`
}

function truncate(text: string): string {
  return text.length <= MAX_ERROR_BODY_CHARS
    ? text
    : `${text.slice(0, MAX_ERROR_BODY_CHARS)}… (truncated)`
}

/** Non-2xx status ⇒ error, carrying the server's own message. */
async function describeHttpError(response: Response): Promise<DeviceBaseError> {
  const body = await response.text().catch(() => '')
  const message = `API error (HTTP ${response.status}): ${body || response.statusText}`
  if (response.status === 404) {
    return new DeviceNotFoundError(message, response.status)
  }
  if (response.status === 422) {
    return new ValidationError(message, response.status)
  }
  if (response.status === 401) {
    return new AuthenticationError(message, response.status)
  }
  return new DeviceBaseError(message, response.status)
}

/**
 * Surface a failure reported inside an otherwise successful response.
 *
 * The control API answers HTTP 200 with a non-2xx `code` in the envelope, e.g.
 * `{"code":502,"message":"-32602: Invalid parameters"}` when a browser action
 * fails in the driver. Trusting the status line alone reports those as success
 * and exits 0, so the envelope is inspected too.
 *
 * Bodies that are not an envelope (arrays, images, empty, non-JSON) are left
 * alone, as are codes inside the 2xx range.
 */
function assertEnvelopeOk(body: string): void {
  const trimmed = body.trimStart()
  if (!trimmed.startsWith('{')) {
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  }
  catch {
    return
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return
  }
  const code = (parsed as { code?: unknown }).code
  if (typeof code !== 'number' || (code >= 200 && code < 300)) {
    return
  }
  throw new DeviceBaseError(`API error (code ${code}): ${truncate(body)}`, undefined, code)
}

/**
 * Decode a body that plausibly is a JSON envelope, or return '' when it is not
 * worth parsing — an empty, oversized or binary response.
 */
function sniffJsonPrefix(bytes: Uint8Array): string {
  if (bytes.byteLength === 0 || bytes.byteLength > ENVELOPE_SNIFF_BYTES) {
    return ''
  }
  const text = new TextDecoder().decode(bytes)
  return text.trimStart().startsWith('{') ? text : ''
}
