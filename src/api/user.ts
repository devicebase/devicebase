import type { Constructor, HttpTransport } from '../transport.js'

/**
 * The account itself — `GET /v1/user/info` and `POST /v1/user/checkin`.
 *
 * The third account-level group, next to `device` (listDevices) and
 * `cloud-browser`: none of them addresses a device, so none takes a serialno.
 * This one answers "whose key is this, and what does the account have" — the
 * name, phone, points balance and registration date, plus the daily check-in
 * that earns more points.
 *
 * Only ever your own account: the API key decides whose record this is, and
 * there is no parameter for pointing it at somebody else.
 *
 * The contract lives in `devicebase-ts/openapi/src/api/routes/user.ts`; the
 * console carries the same two capabilities behind session auth
 * (`GET /api/v1/auth/me`, `POST /api/v1/credits/checkin`).
 */
export function UserApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class UserApiMixin extends Base {
    /**
     * The account behind this API key.
     *
     * `data` carries `username` (the name shown in the console), `mobile`,
     * `credits` (the points balance), `registered_at`, and `can_checkin` —
     * whether today's reward is still unclaimed.
     */
    async userInfo(): Promise<Record<string, unknown>> {
      return this.requestJson('GET', '/v1/user/info')
    }

    /**
     * Claim the daily points: 25 on the first day, +10 per consecutive day, up
     * to 95 a day.
     *
     * Claiming twice in one day is **not** an error — the second call returns
     * HTTP 200 with `already_checked: true` and the message "今日已签到", with
     * nothing granted. That is deliberate: it makes this call safe to put in a
     * daily scheduled task that may fire more than once, without the task having
     * to ask `can_checkin` first.
     *
     * `data` carries `{ success, credits_earned, consecutive_days,
     * already_checked, message, credits }` — `message` is the platform's own
     * wording for display.
     */
    async userCheckin(): Promise<Record<string, unknown>> {
      // An empty object rather than no body at all: the call has no parameters
      // either way, and `{}` is what a deployment predating the server's
      // body-less-POST tolerance also accepts (the transport always sends
      // content-type: application/json).
      return this.requestJson('POST', '/v1/user/checkin', { body: {} })
    }
  }
}
