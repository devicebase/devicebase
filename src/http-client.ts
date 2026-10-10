import { BrowserApi } from './api/browser.js'
import { CloudBrowserApi } from './api/cloud-browser.js'
import { ComputerApi } from './api/computer.js'
import { DeviceApi } from './api/device.js'
import { MobileApi } from './api/mobile.js'
import { UserApi } from './api/user.js'
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
 * - `mobile`        — Android / HarmonyOS / iOS over `/v1/{action}/{serialno}`
 * - `browser`       — Chrome/Chromium/Edge over `/api/browser/{serialno}/{action}`
 * - `computer`      — desktop control over `/api/computer/{serialno}/{action}`
 * - `device`        — `listDevices`
 * - `cloud-browser` — cloud browser lifecycle over `/v1/browser/*` (create,
 *   delete, status, quota)
 * - `user`          — the account itself over `/v1/user/*` (info, checkin)
 *
 * Every device-action method takes the device serialno as its first argument.
 * The three account-level groups — `device`, `cloud-browser` and `user` — do not
 * belong to a device and take no serialno at all; see the Go CLI
 * (`internal/api`) for the contract each method encodes.
 */
export class DeviceBaseHttpClient extends ComputerApi(
  UserApi(CloudBrowserApi(BrowserApi(MobileApi(DeviceApi(HttpTransport))))),
) {}
