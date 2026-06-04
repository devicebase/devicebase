import type { AppInfo, Bounds, DeviceInfo, HierarchyInfo, OperationResult, Point } from './models.js'
import process from 'node:process'
import {
  createAppInfo,
  createDeviceInfo,
  createHierarchyInfo,
  createOperationResult,
} from './models.js'

// --- Errors ---

export class DeviceBaseError extends Error {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'DeviceBaseError'
    this.statusCode = statusCode
  }
}

export class DeviceNotFoundError extends DeviceBaseError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode)
    this.name = 'DeviceNotFoundError'
  }
}

export class ValidationError extends DeviceBaseError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends DeviceBaseError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode)
    this.name = 'AuthenticationError'
  }
}

// --- HTTP Client ---

const DEFAULT_BASE_URL = 'https://api.devicebase.cn'

export interface HttpClientConfig {
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

export class DeviceBaseHttpClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeout: number

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl
      = config.baseUrl ?? process.env.DEVICEBASE_BASE_URL ?? DEFAULT_BASE_URL
    const apiKey = config.apiKey ?? process.env.DEVICEBASE_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via \'apiKey\' config or DEVICEBASE_API_KEY environment variable.',
      )
    }
    this.apiKey = apiKey
    this.timeout = config.timeout ?? 30_000
  }

  private authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  private handleError(response: Response): never {
    const statusCode = response.status
    if (statusCode === 404) {
      throw new DeviceNotFoundError(
        'Device not found or not connected',
        statusCode,
      )
    }
    if (statusCode === 422) {
      throw new ValidationError(
        `Validation error: ${response.statusText}`,
        statusCode,
      )
    }
    if (statusCode === 401) {
      throw new AuthenticationError(
        'Authentication failed - invalid API key',
        statusCode,
      )
    }
    throw new DeviceBaseError(
      `API error: ${statusCode} - ${response.statusText}`,
      statusCode,
    )
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    })
    if (!response.ok) {
      this.handleError(response)
    }
    const text = await response.text()
    if (!text)
      return {}
    return JSON.parse(text) as Record<string, unknown>
  }

  // Device Info

  async getDeviceInfo(serial: string): Promise<DeviceInfo> {
    const data = await this.request('POST', `/v1/deviceinfo/${serial}`)
    return createDeviceInfo(serial, data)
  }

  // Touch Operations

  async tap(serial: string, point: Point): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/tap/${serial}`, { x: point.x, y: point.y })
    return createOperationResult(data)
  }

  async doubleTap(serial: string, point: Point): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/double_tap/${serial}`, { x: point.x, y: point.y })
    return createOperationResult(data)
  }

  async longPress(serial: string, point: Point): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/long_press/${serial}`, { x: point.x, y: point.y })
    return createOperationResult(data)
  }

  async swipe(serial: string, bounds: Bounds): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/swipe/${serial}`, {
      x1: bounds.x1,
      y1: bounds.y1,
      x2: bounds.x2,
      y2: bounds.y2,
    })
    return createOperationResult(data)
  }

  // Navigation

  async back(serial: string): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/back/${serial}`)
    return createOperationResult(data)
  }

  async home(serial: string): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/home/${serial}`)
    return createOperationResult(data)
  }

  // App Operations

  async launchApp(serial: string, appName: string): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/launch_app/${serial}`, { app_name: appName })
    return createOperationResult(data)
  }

  async getCurrentApp(serial: string): Promise<AppInfo> {
    const data = await this.request('POST', `/v1/current_app/${serial}`)
    return createAppInfo(data)
  }

  // Text Input

  async inputText(serial: string, text: string): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/input/${serial}`, { text })
    return createOperationResult(data)
  }

  async clearText(serial: string): Promise<OperationResult> {
    const data = await this.request('POST', `/v1/clear_text/${serial}`)
    return createOperationResult(data)
  }

  // UI Hierarchy

  async dumpHierarchy(serial: string): Promise<HierarchyInfo> {
    const data = await this.request('POST', `/v1/dump_hierarchy/${serial}`)
    return createHierarchyInfo(data)
  }

  // Screenshots

  async getScreenshot(serial: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/v1/screen/${serial}`
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.timeout),
    })
    if (!response.ok) {
      this.handleError(response)
    }
    return response.arrayBuffer()
  }

  async downloadScreenshot(serial: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/v1/screenshot/${serial}`
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.timeout),
    })
    if (!response.ok) {
      this.handleError(response)
    }
    return response.arrayBuffer()
  }

  // List Devices

  async listDevices(params?: {
    keyword?: string
    state?: string
    limit?: number
  }): Promise<Record<string, unknown>> {
    const searchParams = new URLSearchParams()
    if (params?.keyword)
      searchParams.set('keyword', params.keyword)
    if (params?.state)
      searchParams.set('state', params.state)
    if (params?.limit !== undefined && params.limit > 0)
      searchParams.set('limit', String(params.limit))

    const qs = searchParams.toString()
    const path = `/v1/devices${qs ? `?${qs}` : ''}`
    return this.request('GET', path)
  }

  // Screenshot raw bytes (for CLI)

  async screenshotRaw(serial: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/v1/screen/${serial}`
    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.timeout),
    })
    if (!response.ok) {
      this.handleError(response)
    }
    return response.arrayBuffer()
  }
}
