import type {
  Bounds,
  ComputerClickRequest,
  ComputerLongClickRequest,
  ComputerPointRequest,
  OperationResult,
  ScrollDirection,
} from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'
import { createOperationResult } from '../models.js'

/**
 * Computer platform API (macOS / Windows / Linux desktops).
 *
 * Path template: `POST/GET /api/computer/{serialno}/{action}`. Contract mirrors
 * the Go CLI's `internal/api/computer.go` (single source of truth:
 * `computer-control.ts`).
 *
 * GET actions (position/screen_size/permissions) carry no body. Coordinates are
 * absolute screen pixels. The serialno is the platform `serialno` of a registered
 * computer device, as listed by `listDevices({ type: 'computer' })`.
 */

/** Build `/api/computer/{serialno}/{action}`. */
export function computerPath(action: string, serialno: string): string {
  return `/api/computer/${encodeURIComponent(serialno)}/${action}`
}

/** Mirrors the server's own default (and the agent Bash tool's). */
const DEFAULT_BASH_TIMEOUT_SECONDS = 120

/**
 * Headroom on top of whatever a blocking action was asked to wait for, covering
 * connect and body-read overhead. Both `bash` and `wait` size their deadline
 * from it, so it is the single knob for that margin.
 */
const ACTION_TIMEOUT_MARGIN_MS = 15_000

/**
 * Deadline for a bash call. It has to exceed the requested command timeout, or
 * the client would abort a command the server is still running and report a
 * transport error for work that would have succeeded.
 */
export function bashTimeoutMs(timeoutSeconds: number): number {
  const seconds = timeoutSeconds > 0 ? timeoutSeconds : DEFAULT_BASH_TIMEOUT_SECONDS
  return seconds * 1000 + ACTION_TIMEOUT_MARGIN_MS
}

/**
 * Deadline for `wait`, whose budget arrives as milliseconds. The shared 30s
 * default would abort every wait past 30s, well inside the route's 300s ceiling.
 */
export function waitTimeoutMs(milliseconds: number): number {
  return Math.max(0, milliseconds) + ACTION_TIMEOUT_MARGIN_MS
}

export function ComputerApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class ComputerApiMixin extends Base {
    // Mouse

    /** POST /api/computer/{serialno}/click — body {"x","y","button"?}. Omitted button ⇒ "left". */
    async computerClick(
      serialno: string,
      request: ComputerClickRequest,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('click', serialno), {
        body: { x: request.x, y: request.y, button: request.button },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/double_click — body {"x","y"} (left button). */
    async computerDoubleClick(
      serialno: string,
      request: ComputerPointRequest,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('double_click', serialno), {
        body: { x: request.x, y: request.y },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/long_click — body {"x","y","duration"?} in seconds. */
    async computerLongClick(
      serialno: string,
      request: ComputerLongClickRequest,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('long_click', serialno), {
        body: { x: request.x, y: request.y, duration: request.duration },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/move — body {"x","y"}. */
    async computerMove(
      serialno: string,
      request: ComputerPointRequest,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('move', serialno), {
        body: { x: request.x, y: request.y },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/drag — body {"x1","y1","x2","y2"}. */
    async computerDrag(serialno: string, bounds: Bounds): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('drag', serialno), {
        body: {
          x1: bounds.x1,
          y1: bounds.y1,
          x2: bounds.x2,
          y2: bounds.y2,
        },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/scroll — body {"direction","amount"?}. */
    async computerScroll(
      serialno: string,
      direction: ScrollDirection,
      amount?: number,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('scroll', serialno), {
        body: { direction, amount },
      })
      return createOperationResult(data)
    }

    // Keyboard

    /** POST /api/computer/{serialno}/type_text — body {"text"}. */
    async computerTypeText(serialno: string, text: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('type_text', serialno), {
        body: { text },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/press — body {"key"}. */
    async computerPress(serialno: string, key: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('press', serialno), {
        body: { key },
      })
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/hotkey — body {"keys": [...]}. */
    async computerHotkey(serialno: string, keys: readonly string[]): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('hotkey', serialno), {
        body: { keys },
      })
      return createOperationResult(data)
    }

    // System

    /** GET /api/computer/{serialno}/position — absolute mouse position. */
    async computerPosition(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', computerPath('position', serialno))
      return createOperationResult(data)
    }

    /** GET /api/computer/{serialno}/screen_size — primary screen in pixels. */
    async computerScreenSize(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', computerPath('screen_size', serialno))
      return createOperationResult(data)
    }

    /** GET /api/computer/{serialno}/permissions — screen recording, accessibility, … */
    async computerPermissions(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', computerPath('permissions', serialno))
      return createOperationResult(data)
    }

    /** POST /api/computer/{serialno}/launch_app — body {"app_name"}. */
    async computerLaunchApp(serialno: string, appName: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('launch_app', serialno), {
        body: { app_name: appName },
      })
      return createOperationResult(data)
    }

    // Blocking actions

    /**
     * POST /api/computer/{serialno}/wait — body {"seconds": ms/1000}.
     *
     * The CLI takes milliseconds; the API field is seconds. The transport
     * deadline is widened to cover the wait itself.
     */
    async computerWait(serialno: string, milliseconds: number): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('wait', serialno), {
        body: { seconds: milliseconds / 1000 },
        timeout: waitTimeoutMs(milliseconds),
      })
      return createOperationResult(data)
    }

    /**
     * POST /api/computer/{serialno}/bash — body {"command","timeout"?} with the
     * timeout in seconds (omitted when zero so the server applies its 120s
     * default).
     *
     * The command's own exit status comes back in the payload as `data.exitCode`
     * — a non-zero value is not an API error, so this does not reject for it.
     */
    async computerBash(
      serialno: string,
      command: string,
      timeoutSeconds = 0,
    ): Promise<OperationResult> {
      const data = await this.requestJson('POST', computerPath('bash', serialno), {
        body: { command, timeout: timeoutSeconds || undefined },
        timeout: bashTimeoutMs(timeoutSeconds),
      })
      return createOperationResult(data)
    }
  }
}
