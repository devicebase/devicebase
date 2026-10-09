import type { CreateCloudBrowserRequest } from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'

/**
 * Cloud browser lifecycle — `POST /v1/browser/create`, `DELETE /v1/browser/{serialno}`,
 * `GET /v1/browser/{serialno}/status`, `GET /v1/browser/quota`.
 *
 * Not to be confused with `BrowserApi`: those are *device actions* against an
 * already registered browser (`/api/browser/{serialno}/{action}`), while these
 * four are the account-level resource lifecycle that creates and destroys one.
 * A cloud browser is a browser the platform runs for you on its own cluster;
 * a Chrome you attached yourself is not one of them (the API marks the
 * difference as `is_cloud` in `/v1/devices`).
 *
 * The contract lives in `devicebase-ts/openapi/src/api/routes/browser.ts` — the
 * public API-key surface. Status codes carry the meaning here: 409 for a
 * conflict that retrying will not fix (quota exhausted, not a cloud browser),
 * 503 for the temporary kind (no capacity, node unreachable), 502 for a
 * platform↔node problem someone has to repair.
 */
/** The server's own default when the caller does not name one. */
const DEFAULT_WAIT_SECONDS = 15

/**
 * Dispatch budget (20s, the platform's own node-call deadline) plus slack.
 *
 * The timeout above is this plus the wait, so the client never gives up on a
 * request the server is still answering.
 */
const CREATE_TIMEOUT_SLACK_MS = 45_000

export function CloudBrowserApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class CloudBrowserApiMixin extends Base {
    /**
     * Ask the platform for a new cloud browser.
     *
     * Creation is asynchronous — the browser has to start and register itself —
     * so this call waits for that (15 seconds by default) and hands back the
     * `serialno` every other browser method takes. Nobody should have to write a
     * poll loop to use what they just created.
     *
     * If it has not come up within the wait the call still succeeds:
     * `registered` is false and `serialno` is null, with a `device_sn` that
     * `cloudBrowserStatus` and `cloudBrowserDelete` both accept. That is not an
     * error — a slow start is normal — and the individual fields are on
     * `data`, exactly as the API returns them.
     *
     * `data.name` is the platform's own identity for the machine; the name you
     * passed comes back as `data.alias_name`, verbatim and stable.
     */
    async cloudBrowserCreate(
      request: CreateCloudBrowserRequest = {},
    ): Promise<Record<string, unknown>> {
      const waitSeconds = request.waitSeconds ?? DEFAULT_WAIT_SECONDS
      return this.requestJson('POST', '/v1/browser/create', {
        body: {
          name: request.name,
          window_size: request.windowSize,
          wait_seconds: request.waitSeconds,
        },
        // The call blocks on the platform side for the dispatch (up to 20s) and
        // then the wait, so it has to raise its own deadline — the shared
        // default would abort a request the server is still working on. Same
        // reason computerWait and computerBash do.
        timeout: waitSeconds * 1000 + CREATE_TIMEOUT_SLACK_MS,
      })
    }

    /**
     * Destroy a cloud browser and its profile. Irreversible — and not the same
     * as `browserClose`, which only stops the CDP engine.
     *
     * `identifier` is the platform serialno (`db-…`) or the `device_sn` create
     * returned. The call does not wait for the machine: the platform queues the
     * reap and the node collects it on its next heartbeat, so this succeeds
     * even while the node is offline.
     */
    async cloudBrowserDelete(identifier: string): Promise<Record<string, unknown>> {
      return this.requestJson('DELETE', `/v1/browser/${encodeURIComponent(identifier)}`)
    }

    /**
     * Whether the browser has registered itself yet, and under which serialno.
     *
     * "Not up yet" is a normal answer (HTTP 200 with `registered: false`), so
     * polling this is quiet — it will not throw or log failures while waiting.
     */
    async cloudBrowserStatus(identifier: string): Promise<Record<string, unknown>> {
      return this.requestJson('GET', `/v1/browser/${encodeURIComponent(identifier)}/status`)
    }

    /**
     * How many cloud browsers this account may still create. Counted from the
     * same source as the check create performs, so the two cannot disagree.
     */
    async cloudBrowserQuota(): Promise<Record<string, unknown>> {
      return this.requestJson('GET', '/v1/browser/quota')
    }
  }
}
