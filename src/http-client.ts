import { BrowserApi } from './api/browser.js'
import { ComputerApi } from './api/computer.js'
import { DeviceApi } from './api/device.js'
import { MobileApi } from './api/mobile.js'
import { HttpTransport } from './transport.js'

export {
  AuthenticationError,
  DeviceBaseError,
  DeviceNotFoundError,
  ValidationError,
} from './errors.js'

export type { RequestOptions } from './transport.js'
export type { HttpClientConfig } from './transport.js'

/**
 * Devicebase HTTP API client — the transport composed with every platform's
 * typed methods.
 *
 * Each platform lives in its own module under `./api`, so this file only wires
 * them together:
 *
 * - `mobile`   — Android / HarmonyOS / iOS over `/v1/{action}/{serial}`
 * - `browser`  — Chrome/Chromium/Edge over `/api/browser/{serial}/{action}`
 * - `computer` — desktop control over `/api/computer/{serial}/{action}`
 * - `device`   — `listDevices`
 *
 * Every method takes the device serialno as its first argument; see the Go CLI
 * (`internal/api`) for the contract each one encodes.
 */
export class DeviceBaseHttpClient extends ComputerApi(
  BrowserApi(MobileApi(DeviceApi(HttpTransport))),
) {}
