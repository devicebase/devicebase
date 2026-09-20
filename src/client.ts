import type { Buffer } from 'node:buffer'
import type {
  AppInfo,
  DeviceInfo,
  HierarchyInfo,
  OperationResult,
} from './models.js'
import process from 'node:process'
import { AuthenticationError, ValidationError } from './errors.js'
import { DeviceBaseHttpClient } from './http-client.js'
import { MinicapClient, MinitouchClient } from './websocket-client.js'

export interface DeviceBaseClientConfig {
  /** The device's platform serialno, as returned by `list-devices`. */
  serialno?: string
  /** @deprecated Use `serialno`. Passing both is an error. */
  serial?: string
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

/**
 * Resolve the bound serialno, honouring the deprecated `serial` key.
 *
 * `serialno` is optional in the type only so the deprecated key stays
 * type-checkable; exactly one of the two has to be present at runtime.
 */
function resolveSerialno(config: DeviceBaseClientConfig): string {
  if (config.serialno !== undefined && config.serial !== undefined) {
    throw new ValidationError(
      'Pass either `serialno` or the deprecated `serial`, not both.',
    )
  }
  const serialno = config.serialno ?? config.serial
  if (serialno === undefined) {
    throw new ValidationError('`serialno` is required.')
  }
  if (config.serial !== undefined) {
    process.emitWarning('`serial` is deprecated; use `serialno`.', 'DeprecationWarning')
  }
  return serialno
}

/**
 * A serialno-bound facade over `DeviceBaseHttpClient` for one **mobile** device.
 *
 * Every call fills in the serialno, so an Android/HarmonyOS/iOS automation script
 * never repeats it. For the browser and computer platforms, where a "device" is
 * a single registered endpoint rather than a phone, use `DeviceBaseHttpClient`
 * directly and pass the serialno per call.
 */
export class DeviceBaseClient {
  private readonly serialno: string
  private readonly http: DeviceBaseHttpClient
  private readonly _baseUrl: string
  private readonly _apiKey: string

  constructor(config: DeviceBaseClientConfig) {
    const apiKey = config.apiKey ?? process.env.DEVICEBASE_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via \'apiKey\' config or DEVICEBASE_API_KEY environment variable.',
      )
    }
    const baseUrl
      = config.baseUrl ?? process.env.DEVICEBASE_BASE_URL ?? 'https://api.devicebase.cn'

    this.serialno = resolveSerialno(config)
    this._baseUrl = baseUrl
    this._apiKey = apiKey
    this.http = new DeviceBaseHttpClient({
      baseUrl,
      apiKey,
      timeout: config.timeout,
    })
  }

  // Device Info

  async getDeviceInfo(): Promise<DeviceInfo> {
    return this.http.getDeviceInfo(this.serialno)
  }

  // Touch Operations

  async tap(x: number, y: number): Promise<OperationResult> {
    return this.http.tap(this.serialno, { x, y })
  }

  async doubleTap(x: number, y: number): Promise<OperationResult> {
    return this.http.doubleTap(this.serialno, { x, y })
  }

  async longPress(x: number, y: number): Promise<OperationResult> {
    return this.http.longPress(this.serialno, { x, y })
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Promise<OperationResult> {
    return this.http.swipe(this.serialno, { x1, y1, x2, y2 })
  }

  // Navigation

  async back(): Promise<OperationResult> {
    return this.http.back(this.serialno)
  }

  async home(): Promise<OperationResult> {
    return this.http.home(this.serialno)
  }

  // App Operations

  async launchApp(appName: string): Promise<OperationResult> {
    return this.http.launchApp(this.serialno, appName)
  }

  async stopApp(appName: string): Promise<OperationResult> {
    return this.http.stopApp(this.serialno, appName)
  }

  async stopCurrentApp(): Promise<OperationResult> {
    return this.http.stopCurrentApp(this.serialno)
  }

  async getCurrentApp(): Promise<AppInfo> {
    return this.http.getCurrentApp(this.serialno)
  }

  // Text Input

  async inputText(text: string): Promise<OperationResult> {
    return this.http.inputText(this.serialno, text)
  }

  async clearText(): Promise<OperationResult> {
    return this.http.clearText(this.serialno)
  }

  // Shell

  async bash(command: string): Promise<OperationResult> {
    return this.http.bash(this.serialno, command)
  }

  // UI Hierarchy

  async dumpHierarchy(): Promise<HierarchyInfo> {
    return this.http.dumpHierarchy(this.serialno)
  }

  // Install

  async installApp(appPath: string): Promise<OperationResult> {
    return this.http.installApp(this.serialno, appPath)
  }

  async installStatus(installId: string): Promise<OperationResult> {
    return this.http.installStatus(this.serialno, installId)
  }

  // Screenshots

  /** Raw image bytes from `POST /v1/screen/{serialno}` (the format is the server's choice — JPEG today). */
  async getScreenshot(): Promise<ArrayBuffer> {
    return this.http.getScreenshot(this.serialno)
  }

  // WebSocket Clients

  minicapClient(): MinicapClient {
    return new MinicapClient({
      baseUrl: this._baseUrl,
      serialno: this.serialno,
      apiKey: this._apiKey,
    })
  }

  minitouchClient(): MinitouchClient {
    return new MinitouchClient({
      baseUrl: this._baseUrl,
      serialno: this.serialno,
      apiKey: this._apiKey,
    })
  }

  async* streamMinicap(): AsyncGenerator<Buffer> {
    const client = this.minicapClient()
    yield* client.streamFrames()
  }
}
