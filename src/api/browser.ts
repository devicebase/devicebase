import type { OperationResult } from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'
import { createOperationResult } from '../models.js'

/**
 * Browser platform API (Chrome/Chromium/Edge over CDP).
 *
 * Path template: `POST/GET /api/browser/{serial}/{action...}`. Contract mirrors
 * the Go CLI's `internal/api/browser.go` (single source of truth:
 * `browser-control.ts`).
 *
 * GET actions (state/tabs/text/attribute/exists) carry no body; selectors travel
 * as query parameters. The serial is the platform `serialno` of a registered
 * browser device, as listed by `listDevices({ type: 'browser' })`.
 */

/** Build `/api/browser/{serial}/{action}`. */
export function browserPath(action: string, serial: string): string {
  return `/api/browser/${encodeURIComponent(serial)}/${action}`
}

export function BrowserApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class BrowserApiMixin extends Base {
    // Navigation

    /** POST /api/browser/{serial}/navigate — body {"url"}. */
    async browserNavigate(serial: string, url: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('navigate', serial), {
        body: { url },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/refresh */
    async browserRefresh(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('refresh', serial))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/go_back */
    async browserGoBack(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('go_back', serial))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/go_forward */
    async browserGoForward(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('go_forward', serial))
      return createOperationResult(data)
    }

    /**
     * POST /api/browser/{serial}/input — body {"text"}.
     *
     * CDP `Input.insertText` into the page's focused element — reliable for CJK,
     * unlike synthesised key events.
     */
    async browserInput(serial: string, text: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('input', serial), {
        body: { text },
      })
      return createOperationResult(data)
    }

    // DOM

    /** POST /api/browser/{serial}/click — body {"selector"}. */
    async browserClick(serial: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('click', serial), {
        body: { selector },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/fill — body {"selector","value"}. */
    async browserFill(serial: string, selector: string, value: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('fill', serial), {
        body: { selector, value },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/select — body {"selector","value"}. */
    async browserSelect(serial: string, selector: string, value: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('select', serial), {
        body: { selector, value },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serial}/text?selector={selector} */
    async browserText(serial: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('text', serial), {
        query: { selector },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serial}/attribute?selector=&attribute= */
    async browserAttribute(
      serial: string,
      selector: string,
      attribute: string,
    ): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('attribute', serial), {
        query: { selector, attribute },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serial}/exists?selector={selector} */
    async browserExists(serial: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('exists', serial), {
        query: { selector },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/execute — body {"script"}. */
    async browserExecute(serial: string, script: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('execute', serial), {
        body: { script },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/hotkey — body {"keys": [...]}. */
    async browserHotkey(serial: string, keys: readonly string[]): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('hotkey', serial), {
        body: { keys },
      })
      return createOperationResult(data)
    }

    // State

    /** GET /api/browser/{serial}/state — url, title, viewport, tab count. */
    async browserState(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('state', serial))
      return createOperationResult(data)
    }

    /** GET /api/browser/{serial}/tabs */
    async browserTabs(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('tabs', serial))
      return createOperationResult(data)
    }

    // Tabs

    /** POST /api/browser/{serial}/tab/open — body {"url"}. */
    async browserTabOpen(serial: string, url: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/open', serial), {
        body: { url },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/tab/close — body {"tab_id"}. */
    async browserTabClose(serial: string, tabId: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/close', serial), {
        body: { tab_id: tabId },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/tab/close_all — lands on a fresh about:blank tab. */
    async browserTabCloseAll(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/close_all', serial))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/tab/switch — body {"tab_id"}. */
    async browserTabSwitch(serial: string, tabId: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/switch', serial), {
        body: { tab_id: tabId },
      })
      return createOperationResult(data)
    }

    // Lifecycle

    /** POST /api/browser/{serial}/launch — start CDP; returns a connectable CDP URL. */
    async browserLaunch(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('launch', serial))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serial}/close — stop CDP (the pooled entry is reused next time). */
    async browserClose(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('close', serial))
      return createOperationResult(data)
    }
  }
}
