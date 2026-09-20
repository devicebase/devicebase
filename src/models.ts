/**
 * Shared value and request-payload types.
 *
 * JSON field names follow the Devicebase control API. The request types below
 * are the single definition of every POST body the client sends — mirroring the
 * Go CLI's `internal/api/requests.go`, whose contract source is the TestClaw
 * service routes (`control.ts`, `browser-control.ts`, `computer-control.ts`).
 *
 * Optional fields are omitted from the wire body by `JSON.stringify`, which
 * drops `undefined` values — the equivalent of Go's `omitempty`.
 */

// --- Geometry -------------------------------------------------------------

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Bounds {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export type MouseButton = 'left' | 'right' | 'middle'
export type ScrollDirection = 'up' | 'down' | 'left' | 'right'

// --- Results --------------------------------------------------------------

export interface DeviceInfo {
  readonly serial: string
  readonly data: Record<string, unknown>
}

export interface AppInfo {
  readonly data: Record<string, unknown>
}

export interface HierarchyInfo {
  readonly data: Record<string, unknown>
}

export interface OperationResult {
  readonly success: boolean
  readonly data: Record<string, unknown>
}

// --- Request payloads -----------------------------------------------------

/** Bodies that take an app name: mobile launch-app/stop-app, computer launch_app. */
export interface LaunchAppRequest {
  readonly app_name: string
}

/** Bodies that insert text: mobile input, browser input, computer type_text. */
export interface InputTextRequest {
  readonly text: string
}

/** Mobile bash shell command. */
export interface CommandRequest {
  readonly command: string
}

/** Mobile install-app — a package path on the agent host. */
export interface InstallAppRequest {
  readonly app_path: string
}

/** Browser navigate and tab-open. */
export interface UrlRequest {
  readonly url: string
}

/** Browser click. */
export interface SelectorRequest {
  readonly selector: string
}

/** Browser fill and select. */
export interface SelectorValueRequest {
  readonly selector: string
  readonly value: string
}

/** Browser execute. */
export interface ScriptRequest {
  readonly script: string
}

/** Browser and computer hotkey — a non-empty array of keys pressed together. */
export interface KeysRequest {
  readonly keys: readonly string[]
}

/** Browser tab close/switch. */
export interface TabIdRequest {
  readonly tab_id: string
}

/** Computer double-click and move (the server defaults the button to left). */
export interface ComputerPointRequest {
  readonly x: number
  readonly y: number
}

/** Computer click, with an optional button (omitted → server default "left"). */
export interface ComputerClickRequest {
  readonly x: number
  readonly y: number
  readonly button?: MouseButton
}

/** Computer long-click; duration in seconds, omitted → driver default. */
export interface ComputerLongClickRequest {
  readonly x: number
  readonly y: number
  readonly duration?: number
}

/** Computer scroll; amount is omitted → driver default. */
export interface ScrollRequest {
  readonly direction: ScrollDirection
  readonly amount?: number
}

/** Computer key press. */
export interface PressRequest {
  readonly key: string
}

/** Computer wait; the CLI takes milliseconds and converts to seconds on the wire. */
export interface WaitRequest {
  readonly seconds: number
}

/**
 * Computer bash host-shell command. The optional timeout is in seconds and is
 * omitted when zero so the server applies its 120s default — distinct from
 * `CommandRequest`, which has no timeout field.
 */
export interface ComputerBashRequest {
  readonly command: string
  readonly timeout?: number
}

/**
 * Device listing filters. Values are forwarded verbatim: the control API
 * resolves both category buckets (mobile/browser/computer) and system types
 * (android/harmonyos/ios/macos/windows/linux/chrome/chromium/edge/other).
 *
 * `limit` caps how many devices come back. It is the one filter the Go CLI does
 * not expose, but the `/v1/devices` route honours it server-side — the CLI
 * sends 10 by default.
 */
export interface ListDevicesRequest {
  readonly keyword?: string
  readonly state?: string
  readonly type?: string
  readonly limit?: number
}

// --- Factories ------------------------------------------------------------

export function createPoint(x: number, y: number): Point {
  return Object.freeze({ x, y })
}

export function createBounds(x1: number, y1: number, x2: number, y2: number): Bounds {
  return Object.freeze({ x1, y1, x2, y2 })
}

export function createDeviceInfo(serial: string, data: Record<string, unknown>): DeviceInfo {
  return Object.freeze({ serial, data })
}

export function createAppInfo(data: Record<string, unknown>): AppInfo {
  return Object.freeze({ data })
}

export function createHierarchyInfo(data: Record<string, unknown>): HierarchyInfo {
  return Object.freeze({ data })
}

export function createOperationResult(data: Record<string, unknown>): OperationResult {
  const success = typeof data.success === 'boolean' ? data.success : true
  return Object.freeze({ success, data })
}

export function createLaunchAppRequest(app_name: string): LaunchAppRequest {
  return Object.freeze({ app_name })
}

export function createInputTextRequest(text: string): InputTextRequest {
  return Object.freeze({ text })
}
