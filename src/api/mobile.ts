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
 * The serial is a mobile device serial (adb/hdc/ios), as listed by
 * `listDevices({ type: 'mobile' })`.
 */

/** Build `/v1/{action}/{serialno}`. */
export function mobilePath(action: string, serial: string): string {
  return `/v1/${action}/${encodeURIComponent(serial)}`
}

export function MobileApi<TBase extends Constructor<HttpTransport>>(Base: TBase) {
  return class MobileApiMixin extends Base {
    // Device Info

    /** POST /v1/deviceinfo/{serial} */
    async getDeviceInfo(serial: string): Promise<DeviceInfo> {
      const data = await this.requestJson('POST', mobilePath('deviceinfo', serial))
      return createDeviceInfo(serial, data)
    }

    // Touch Operations

    /** POST /v1/tap/{serial} — body {"x","y"}. */
    async tap(serial: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('tap', serial), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/double_tap/{serial} — body {"x","y"}. */
    async doubleTap(serial: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('double_tap', serial), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/long_press/{serial} — body {"x","y"}. */
    async longPress(serial: string, point: Point): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('long_press', serial), {
        body: { x: point.x, y: point.y },
      })
      return createOperationResult(data)
    }

    /** POST /v1/swipe/{serial} — body {"x1","y1","x2","y2"}. */
    async swipe(serial: string, bounds: Bounds): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('swipe', serial), {
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

    /** POST /v1/back/{serial} */
    async back(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('back', serial))
      return createOperationResult(data)
    }

    /** POST /v1/home/{serial} */
    async home(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('home', serial))
      return createOperationResult(data)
    }

    // App Operations

    /** POST /v1/launch_app/{serial} — body {"app_name"}. */
    async launchApp(serial: string, appName: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('launch_app', serial), {
        body: { app_name: appName },
      })
      return createOperationResult(data)
    }

    /** POST /v1/stop_app/{serial} — body {"app_name"}. */
    async stopApp(serial: string, appName: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('stop_app', serial), {
        body: { app_name: appName },
      })
      return createOperationResult(data)
    }

    /** POST /v1/stop_current_app/{serial} */
    async stopCurrentApp(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('stop_current_app', serial))
      return createOperationResult(data)
    }

    /** POST /v1/current_app/{serial} */
    async getCurrentApp(serial: string): Promise<AppInfo> {
      const data = await this.requestJson('POST', mobilePath('current_app', serial))
      return createAppInfo(data)
    }

    // Text Input

    /** POST /v1/input/{serial} — body {"text"}. */
    async inputText(serial: string, text: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('input', serial), {
        body: { text },
      })
      return createOperationResult(data)
    }

    /** POST /v1/clear_text/{serial} */
    async clearText(serial: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('clear_text', serial))
      return createOperationResult(data)
    }

    // Shell

    /** POST /v1/bash/{serial} — body {"command"} (adb/hdc only). */
    async bash(serial: string, command: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('bash', serial), {
        body: { command },
      })
      return createOperationResult(data)
    }

    // UI Hierarchy

    /** POST /v1/dump_hierarchy/{serial} */
    async dumpHierarchy(serial: string): Promise<HierarchyInfo> {
      const data = await this.requestJson('POST', mobilePath('dump_hierarchy', serial))
      return createHierarchyInfo(data)
    }

    // Install

    /**
     * POST /v1/install_app/{serial} — body {"app_path"}.
     *
     * A real handler rather than a redirect: a 302 would drop the JSON body.
     * Returns an install id for `installStatus`.
     */
    async installApp(serial: string, appPath: string): Promise<OperationResult> {
      const data = await this.requestJson('POST', mobilePath('install_app', serial), {
        body: { app_path: appPath },
      })
      return createOperationResult(data)
    }

    /** GET /v1/install_status/{serial}?install_id={id} */
    async installStatus(serial: string, installId: string): Promise<OperationResult> {
      const data = await this.requestJson('GET', mobilePath('install_status', serial), {
        query: { install_id: installId },
      })
      return createOperationResult(data)
    }

    // Capture

    /**
     * POST /v1/screen/{serial} — raw image bytes.
     *
     * Cross-family: the server dispatches by device type (computer → desktop
     * capture, browser → CDP capture, otherwise the device image queue), so this
     * serves every platform from one endpoint. The format is the server's choice
     * (JPEG today), independently of any file name the caller writes it to.
     */
    async getScreenshot(serial: string): Promise<ArrayBuffer> {
      return this.requestBytes('POST', mobilePath('screen', serial))
    }
  }
}
