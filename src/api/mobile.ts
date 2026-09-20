import type {
  AppInfo,
  Bounds,
  DeviceInfo,
  HierarchyInfo,
  OperationResult,
  Point,
} from '../models.js'
import type { Constructor, HttpTransport } from '../transport.js'
import {
  createAppInfo,
  createDeviceInfo,
  createHierarchyInfo,
  createOperationResult,
} from '../models.js'

/**
 * Mobile platform API — Android / HarmonyOS / iOS.
 *
 * Path template: `POST/GET /v1/{action}/{serialno}`. The control server
 * registers these routes and redirects (302/307) to the `/api/*` handlers, so
 * method and body survive. Contract mirrors the Go CLI's `internal/api/mobile.go`
 * (single source of truth: `control.ts` + `device.ts` + `screen.ts`).
 *
 * The serialno is a mobile device serialno (adb/hdc/ios), as listed by
 * `listDevices({ type: 'mobile' })`.
 */

/** Build `/v1/{action}/{serialno}`. */
export function mobilePath(action: string, serialno: string): string {
  return `/v1/${action}/${encodeURIComponent(serialno)}`
}

export function MobileApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class MobileApiMixin extends Base {
    // Device Info

    /** POST /v1/deviceinfo/{serialno} */
    async getDeviceInfo(serialno: string): Promise<DeviceInfo> {
      const data = await this.requestJson('POST', mobilePath('deviceinfo', serialno))
      return createDeviceInfo(serialno, data)
    }

    // Touch Operations

    /** POST /v1/tap/{serialno} — body {"x","y"}. */
    async tap(serialno: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('tap', serialno), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/double_tap/{serialno} — body {"x","y"}. */
    async doubleTap(serialno: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('double_tap', serialno), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/long_press/{serialno} — body {"x","y"}. */
    async longPress(serialno: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('long_press', serialno), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/swipe/{serialno} — body {"x1","y1","x2","y2"}. */
    async swipe(serialno: string, bounds: Bounds): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('swipe', serialno), {
        body: {
          x1: bounds.x1,
          y1: bounds.y1,
          x2: bounds.x2,
          y2: bounds.y2,
        },
      })
      return createOperationResult(data)
    }

    // Navigation

    /** POST /v1/back/{serialno} */
    async back(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('back', serialno))
      return createOperationResult(data)
    }

    /** POST /v1/home/{serialno} */
    async home(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('home', serialno))
      return createOperationResult(data)
    }

    // App Operations

    /** POST /v1/launch_app/{serialno} — body {"app_name"}. */
    async launchApp(serialno: string, appName: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('launch_app', serialno), {
        body: { app_name: appName },
      })
      return createOperationResult(data)
    }

    /** POST /v1/stop_app/{serialno} — body {"app_name"}. */
    async stopApp(serialno: string, appName: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('stop_app', serialno), {
        body: { app_name: appName },
      })
      return createOperationResult(data)
    }

    /** POST /v1/stop_current_app/{serialno} */
    async stopCurrentApp(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('stop_current_app', serialno))
      return createOperationResult(data)
    }

    /** POST /v1/current_app/{serialno} */
    async getCurrentApp(serialno: string): Promise<AppInfo> {
      const data = await this.requestJson('POST', mobilePath('current_app', serialno))
      return createAppInfo(data)
    }

    // Text Input

    /** POST /v1/input/{serialno} — body {"text"}. */
    async inputText(serialno: string, text: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('input', serialno), {
        body: { text },
      })
      return createOperationResult(data)
    }

    /** POST /v1/clear_text/{serialno} */
    async clearText(serialno: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('clear_text', serialno))
      return createOperationResult(data)
    }

    // Shell

    /** POST /v1/bash/{serialno} — body {"command"} (adb/hdc only). */
    async bash(serialno: string, command: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('bash', serialno), {
        body: { command },
      })
      return createOperationResult(data)
    }

    // UI Hierarchy

    /** POST /v1/dump_hierarchy/{serialno} */
    async dumpHierarchy(serialno: string): Promise<HierarchyInfo> {
      const data = await this.requestJson('POST', mobilePath('dump_hierarchy', serialno))
      return createHierarchyInfo(data)
    }

    // Install

    /**
     * POST /v1/install_app/{serialno} — body {"app_path"}.
     *
     * A real handler rather than a redirect: a 302 would drop the JSON body.
     * Returns an install id for `installStatus`.
     */
    async installApp(serialno: string, appPath: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('install_app', serialno), {
        body: { app_path: appPath },
      })
      return createOperationResult(data)
    }

    /** GET /v1/install_status/{serialno}?install_id={id} */
    async installStatus(serialno: string, installId: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', mobilePath('install_status', serialno), {
        query: { install_id: installId },
      })
      return createOperationResult(data)
    }

    // Capture

    /**
     * POST /v1/screen/{serialno} — raw image bytes.
     *
     * Cross-family: the server dispatches by device type (computer → desktop
     * capture, browser → CDP capture, otherwise the device image queue), so this
     * serves every platform from one endpoint. The format is the server's choice
     * (JPEG today), independently of any file name the caller writes it to.
     */
    async getScreenshot(serialno: string): Promise<ArrayBuffer> {
      return this.requestBytes('POST', mobilePath('screen', serialno))
    }
  }
}
