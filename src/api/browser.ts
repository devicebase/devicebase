import type { OperationResult } from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'
import { createOperationResult } from '../models.js'

/**
 * Browser platform API (Chrome/Chromium/Edge over CDP).
 *
 * Path template: `POST/GET /api/browser/{serialno}/{action...}`. Contract mirrors
 * the Go CLI's `internal/api/browser.go` (single source of truth:
 * `browser-control.ts`).
 *
 * GET actions (state/tabs/text/attribute/exists) carry no body; selectors travel
 * as query parameters. The serialno is the platform `serialno` of a registered
 * browser device, as listed by `listDevices({ type: 'browser' })`.
 */

/** Build `/api/browser/{serialno}/{action}`. */
export function browserPath(action: string, serialno: string): string {
  return `/api/browser/${encodeURIComponent(serialno)}/${action}`
}

export function BrowserApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class BrowserApiMixin extends Base {
    // Navigation

    /** POST /api/browser/{serialno}/navigate — body {"url"}. */
    async browserNavigate(serialno: string, url: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('navigate', serialno), {
        body: { url },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/refresh */
    async browserRefresh(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('refresh', serialno))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/go_back */
    async browserGoBack(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('go_back', serialno))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/go_forward */
    async browserGoForward(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('go_forward', serialno))
      return createOperationResult(data)
    }

    /**
     * POST /api/browser/{serialno}/input — body {"text"}.
     *
     * CDP `Input.insertText` into the page's focused element — reliable for CJK,
     * unlike synthesised key events.
     */
    async browserInput(serialno: string, text: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('input', serialno), {
        body: { text },
      })
      return createOperationResult(data)
    }

    // DOM

    /** POST /api/browser/{serialno}/click — body {"selector"}. */
    async browserClick(serialno: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('click', serialno), {
        body: { selector },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/fill — body {"selector","value"}. */
    async browserFill(serialno: string, selector: string, value: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('fill', serialno), {
        body: { selector, value },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/select — body {"selector","value"}. */
    async browserSelect(serialno: string, selector: string, value: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('select', serialno), {
        body: { selector, value },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serialno}/text?selector={selector} */
    async browserText(serialno: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('text', serialno), {
        query: { selector },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serialno}/attribute?selector=&attribute= */
    async browserAttribute(
      serialno: string,
      selector: string,
      attribute: string,
    ): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('attribute', serialno), {
        query: { selector, attribute },
      })
      return createOperationResult(data)
    }

    /** GET /api/browser/{serialno}/exists?selector={selector} */
    async browserExists(serialno: string, selector: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('exists', serialno), {
        query: { selector },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/execute — body {"script"}. */
    async browserExecute(serialno: string, script: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('execute', serialno), {
        body: { script },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/hotkey — body {"keys": [...]}. */
    async browserHotkey(serialno: string, keys: readonly string[]): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('hotkey', serialno), {
        body: { keys },
      })
      return createOperationResult(data)
    }

    // State

    /** GET /api/browser/{serialno}/state — url, title, viewport, tab count. */
    async browserState(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('state', serialno))
      return createOperationResult(data)
    }

    /** GET /api/browser/{serialno}/tabs */
    async browserTabs(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', browserPath('tabs', serialno))
      return createOperationResult(data)
    }

    // Tabs

    /** POST /api/browser/{serialno}/tab/open — body {"url"}. */
    async browserTabOpen(serialno: string, url: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/open', serialno), {
        body: { url },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/tab/close — body {"tab_id"}. */
    async browserTabClose(serialno: string, tabId: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/close', serialno), {
        body: { tab_id: tabId },
      })
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/tab/close_all — lands on a fresh about:blank tab. */
    async browserTabCloseAll(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/close_all', serialno))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/tab/switch — body {"tab_id"}. */
    async browserTabSwitch(serialno: string, tabId: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('tab/switch', serialno), {
        body: { tab_id: tabId },
      })
      return createOperationResult(data)
    }

    // Lifecycle

    /** POST /api/browser/{serialno}/launch — start CDP; returns a connectable CDP URL. */
    async browserLaunch(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('launch', serialno))
      return createOperationResult(data)
    }

    /** POST /api/browser/{serialno}/close — stop CDP (the pooled entry is reused next time). */
    async browserClose(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', browserPath('close', serialno))
      return createOperationResult(data)
    }
  }
}
