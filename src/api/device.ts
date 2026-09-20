import type { ListDevicesRequest } from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'

/**
 * Device listing — `GET /v1/devices`.
 *
 * Filtering is bucket-typed server-side and values are forwarded verbatim:
 * `--type` accepts either a category (mobile / browser / computer) or a system
 * type (android / harmonyos / ios / macos / windows / linux / chrome / chromium
 * / edge / other). System types resolve against a device's `os_type`, because a
 * device row only carries the coarse `type` — a Chrome browser is `type=browser`
 * with `os_type=Chrome`.
 */
export function DeviceApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class DeviceApiMixin extends Base {
    async listDevices(
      request: ListDevicesRequest = {},
    ): Promise<Record<string, unknown>> {
      return this.requestJson('GET', '/v1/devices', {
        query: {
          keyword: request.keyword,
          state: request.state,
          type: request.type,
          limit: request.limit,
        },
      })
    }
  }
}
