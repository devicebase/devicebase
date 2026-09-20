import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserPath } from '../src/api/browser.js'
import { bashTimeoutMs, computerPath, waitTimeoutMs } from '../src/api/computer.js'
import { mobilePath } from '../src/api/mobile.js'
import {
  AuthenticationError,
  DeviceBaseError,
  DeviceBaseHttpClient,
  DeviceNotFoundError,
  ValidationError,
} from '../src/http-client.js'

const API_KEY = 'test-api-key'
const BASE_URL = 'http://localhost:9999'

/** Stub fetch with a JSON body. */
function jsonFetch(body: unknown = { success: true }, status = 200) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    statusText: status < 400 ? 'OK' : 'Error',
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    arrayBuffer: async () => new ArrayBuffer(0),
  }))
}

function bytesFetch(bytes: number[]) {
  const buffer = new Uint8Array(bytes).buffer
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
    arrayBuffer: async () => buffer,
  }))
}

function lastCall(): [string, RequestInit] {
  const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
  return calls[calls.length - 1]
}

describe('deviceBaseHttpClient', () => {
  let client: DeviceBaseHttpClient

  beforeEach(() => {
    client = new DeviceBaseHttpClient({ baseUrl: BASE_URL, apiKey: API_KEY })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('throws AuthenticationError when no API key provided', () => {
      const orig = process.env.DEVICEBASE_API_KEY
      delete process.env.DEVICEBASE_API_KEY
      expect(() => new DeviceBaseHttpClient({ baseUrl: BASE_URL })).toThrow(AuthenticationError)
      process.env.DEVICEBASE_API_KEY = orig
    })

    it('reads API key from environment variable', () => {
      const orig = process.env.DEVICEBASE_API_KEY
      process.env.DEVICEBASE_API_KEY = 'env-key'
      expect(new DeviceBaseHttpClient({ baseUrl: BASE_URL })).toBeDefined()
      process.env.DEVICEBASE_API_KEY = orig
    })

    it('strips a trailing slash from the base URL', async () => {
      globalThis.fetch = jsonFetch()
      const slashed = new DeviceBaseHttpClient({ baseUrl: `${BASE_URL}/`, apiKey: API_KEY })
      await slashed.back('device123')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/back/device123`)
    })
  })

  describe('composed platform methods', () => {
    it('exposes the mobile, browser, computer and device families on one client', () => {
      const methods = [
        // mobile
        'getDeviceInfo',
        'tap',
        'doubleTap',
        'longPress',
        'swipe',
        'back',
        'home',
        'launchApp',
        'stopApp',
        'stopCurrentApp',
        'getCurrentApp',
        'inputText',
        'clearText',
        'bash',
        'dumpHierarchy',
        'installApp',
        'installStatus',
        'getScreenshot',
        // browser
        'browserNavigate',
        'browserRefresh',
        'browserGoBack',
        'browserGoForward',
        'browserInput',
        'browserClick',
        'browserFill',
        'browserSelect',
        'browserText',
        'browserAttribute',
        'browserExists',
        'browserExecute',
        'browserHotkey',
        'browserState',
        'browserTabs',
        'browserTabOpen',
        'browserTabClose',
        'browserTabCloseAll',
        'browserTabSwitch',
        'browserLaunch',
        'browserClose',
        // computer
        'computerClick',
        'computerDoubleClick',
        'computerLongClick',
        'computerMove',
        'computerDrag',
        'computerScroll',
        'computerTypeText',
        'computerPress',
        'computerHotkey',
        'computerPosition',
        'computerScreenSize',
        'computerPermissions',
        'computerLaunchApp',
        'computerWait',
        'computerBash',
        // device
        'listDevices',
      ] as const
      for (const method of methods) {
        expect(typeof (client as unknown as Record<string, unknown>)[method]).toBe('function')
      }
    })
  })

  describe('path templates', () => {
    it('match the Go CLI contract', () => {
      expect(mobilePath('tap', 'dev-1')).toBe('/v1/tap/dev-1')
      expect(mobilePath('install_status', 'dev-1')).toBe('/v1/install_status/dev-1')
      expect(browserPath('navigate', 'br-1')).toBe('/api/browser/br-1/navigate')
      expect(browserPath('tab/open', 'br-1')).toBe('/api/browser/br-1/tab/open')
      expect(computerPath('screen_size', 'pc-1')).toBe('/api/computer/pc-1/screen_size')
    })

    it('encode a serialno that needs escaping', () => {
      expect(mobilePath('tap', 'a b/c')).toBe('/v1/tap/a%20b%2Fc')
    })
  })

  describe('error handling', () => {
    const cases = [
      { status: 404, expected: DeviceNotFoundError },
      { status: 422, expected: ValidationError },
      { status: 401, expected: AuthenticationError },
      { status: 500, expected: DeviceBaseError },
    ] as const

    it.each(cases)('maps HTTP $status to the matching error class', async ({ status, expected }) => {
      globalThis.fetch = jsonFetch({ code: status, message: 'boom' }, status)
      await expect(client.getDeviceInfo('serial')).rejects.toThrow(expected)
    })

    it('keeps the server message in the error, the way the Go CLI reports it', async () => {
      globalThis.fetch = jsonFetch({ code: 404, message: '设备不存在: nope' }, 404)
      await expect(client.getDeviceInfo('nope')).rejects.toThrow(
        /API error \(HTTP 404\): \{"code":404,"message":"设备不存在: nope"\}/,
      )
    })

    it('surfaces a non-2xx envelope code carried by an HTTP 200', async () => {
      globalThis.fetch = jsonFetch({ code: 502, message: '-32602: Invalid parameters' })
      const error = await client.browserClick('br-1', '#x').catch((err: DeviceBaseError) => err)
      expect(error).toBeInstanceOf(DeviceBaseError)
      expect((error as DeviceBaseError).code).toBe(502)
      expect((error as Error).message).toMatch(/API error \(code 502\)/)
    })

    it('leaves an enveloped 2xx code alone', async () => {
      globalThis.fetch = jsonFetch({ code: 200, message: 'success', data: { ok: true } })
      await expect(client.browserState('br-1')).resolves.toMatchObject({ success: true })
    })

    it('does not mistake a non-envelope body for a failure', async () => {
      globalThis.fetch = jsonFetch([{ id: 1 }, { id: 2 }])
      await expect(client.listDevices()).resolves.toEqual([{ id: 1 }, { id: 2 }])
    })

    it('reports a non-JSON success body instead of throwing a raw SyntaxError', async () => {
      globalThis.fetch = jsonFetch('<html>nope</html>')
      await expect(client.listDevices()).rejects.toThrow(/Invalid JSON response: <html>nope<\/html>/)
    })

    it('inspects the envelope of a byte response, so a failed capture is not image data', async () => {
      const envelope = '{"code":500,"message":"Device not found for serialno x","data":null}'
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => envelope,
        arrayBuffer: async () => new TextEncoder().encode(envelope).buffer,
      }))
      await expect(client.getScreenshot('x')).rejects.toThrow(/API error \(code 500\)/)
    })

    it('returns real image bytes untouched', async () => {
      globalThis.fetch = bytesFetch([0xFF, 0xD8, 0xFF, 0xE0])
      const result = await client.getScreenshot('device123')
      expect(Array.from(new Uint8Array(result))).toEqual([0xFF, 0xD8, 0xFF, 0xE0])
    })
  })

  describe('mobile methods', () => {
    beforeEach(() => {
      globalThis.fetch = jsonFetch({ success: true })
    })

    it('getDeviceInfo sends POST to /v1/deviceinfo/{serialno}', async () => {
      globalThis.fetch = jsonFetch({ model: 'Pixel 7', os: 'Android 14' })
      const result = await client.getDeviceInfo('device123')
      expect(result.serialno).toBe('device123')
      expect(result.data).toEqual({ model: 'Pixel 7', os: 'Android 14' })
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/deviceinfo/device123`)
      expect(lastCall()[1].method).toBe('POST')
    })

    it('tap sends x/y in the body', async () => {
      await client.tap('device123', { x: 100, y: 200 })
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/tap/device123`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ x: 100, y: 200 }))
    })

    it('swipe sends four coordinates', async () => {
      await client.swipe('device123', { x1: 0, y1: 100, x2: 300, y2: 100 })
      expect(lastCall()[1].body).toBe(JSON.stringify({ x1: 0, y1: 100, x2: 300, y2: 100 }))
    })

    it('launchApp and stopApp send app_name', async () => {
      await client.launchApp('device123', 'com.tencent.mm')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/launch_app/device123`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ app_name: 'com.tencent.mm' }))

      await client.stopApp('device123', 'com.tencent.mm')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/stop_app/device123`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ app_name: 'com.tencent.mm' }))
    })

    it('inputText sends text', async () => {
      await client.inputText('device123', 'hello world')
      expect(lastCall()[1].body).toBe(JSON.stringify({ text: 'hello world' }))
    })

    it('bash sends command', async () => {
      await client.bash('device123', 'ls -la')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/bash/device123`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ command: 'ls -la' }))
    })

    it('installApp sends app_path and installStatus queries install_id', async () => {
      await client.installApp('device123', '/tmp/app.apk')
      expect(lastCall()[1].body).toBe(JSON.stringify({ app_path: '/tmp/app.apk' }))

      await client.installStatus('device123', 'install-42')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/install_status/device123?install_id=install-42`)
      expect(lastCall()[1].method).toBe('GET')
    })

    it('getScreenshot POSTs to /v1/screen/{serialno}', async () => {
      globalThis.fetch = bytesFetch([0xFF, 0xD8, 0xFF])
      await client.getScreenshot('device123')
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/screen/device123`)
      expect(lastCall()[1].method).toBe('POST')
    })

    it('getCurrentApp and dumpHierarchy wrap the response', async () => {
      globalThis.fetch = jsonFetch({ name: 'com.tencent.mm' })
      await expect(client.getCurrentApp('device123')).resolves.toEqual({ data: { name: 'com.tencent.mm' } })

      globalThis.fetch = jsonFetch({ nodes: [] })
      await expect(client.dumpHierarchy('device123')).resolves.toEqual({ data: { nodes: [] } })
    })
  })

  describe('browser methods', () => {
    beforeEach(() => {
      globalThis.fetch = jsonFetch({ success: true })
    })

    it('navigate, refresh and history use their own routes', async () => {
      await client.browserNavigate('br-1', 'https://example.com')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/navigate`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ url: 'https://example.com' }))

      await client.browserRefresh('br-1')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/refresh`)

      await client.browserGoBack('br-1')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/go_back`)

      await client.browserGoForward('br-1')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/go_forward`)
    })

    it('sends selectors as query params on the read routes', async () => {
      await client.browserText('br-1', '.title')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/text?selector=.title`)
      expect(lastCall()[1].method).toBe('GET')

      await client.browserAttribute('br-1', '#link', 'href')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/attribute?selector=%23link&attribute=href`)

      await client.browserExists('br-1', '.empty')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/exists?selector=.empty`)
    })

    it('fill and select send selector + value', async () => {
      await client.browserFill('br-1', '#q', 'devices')
      expect(lastCall()[1].body).toBe(JSON.stringify({ selector: '#q', value: 'devices' }))

      await client.browserSelect('br-1', '#sort', 'price')
      expect(lastCall()[1].body).toBe(JSON.stringify({ selector: '#sort', value: 'price' }))
    })

    it('hotkey sends the keys array intact', async () => {
      await client.browserHotkey('br-1', ['Meta', 'a'])
      expect(lastCall()[1].body).toBe(JSON.stringify({ keys: ['Meta', 'a'] }))
    })

    it('tab close and switch send tab_id', async () => {
      await client.browserTabClose('br-1', 'tab-1')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/browser/br-1/tab/close`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ tab_id: 'tab-1' }))

      await client.browserTabSwitch('br-1', 'tab-2')
      expect(lastCall()[1].body).toBe(JSON.stringify({ tab_id: 'tab-2' }))
    })

    it('execute sends the script', async () => {
      await client.browserExecute('br-1', 'document.title')
      expect(lastCall()[1].body).toBe(JSON.stringify({ script: 'document.title' }))
    })
  })

  describe('computer methods', () => {
    beforeEach(() => {
      globalThis.fetch = jsonFetch({ success: true })
    })

    it('omits the button when none was asked for', async () => {
      await client.computerClick('pc-1', { x: 10, y: 20 })
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/computer/pc-1/click`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ x: 10, y: 20 }))
    })

    it('sends the button when given', async () => {
      await client.computerClick('pc-1', { x: 10, y: 20, button: 'right' })
      expect(lastCall()[1].body).toBe(JSON.stringify({ x: 10, y: 20, button: 'right' }))
    })

    it('omits the long-click duration when not given', async () => {
      await client.computerLongClick('pc-1', { x: 5, y: 5 })
      expect(lastCall()[1].body).toBe(JSON.stringify({ x: 5, y: 5 }))

      await client.computerLongClick('pc-1', { x: 5, y: 5, duration: 2 })
      expect(lastCall()[1].body).toBe(JSON.stringify({ x: 5, y: 5, duration: 2 }))
    })

    it('omits the scroll amount when not given', async () => {
      await client.computerScroll('pc-1', 'down')
      expect(lastCall()[1].body).toBe(JSON.stringify({ direction: 'down' }))

      await client.computerScroll('pc-1', 'up', 3)
      expect(lastCall()[1].body).toBe(JSON.stringify({ direction: 'up', amount: 3 }))
    })

    it('drag sends bounds, type-text and press send their field', async () => {
      await client.computerDrag('pc-1', { x1: 0, y1: 0, x2: 100, y2: 200 })
      expect(lastCall()[1].body).toBe(JSON.stringify({ x1: 0, y1: 0, x2: 100, y2: 200 }))

      await client.computerTypeText('pc-1', 'hello')
      expect(lastCall()[1].body).toBe(JSON.stringify({ text: 'hello' }))

      await client.computerPress('pc-1', 'Enter')
      expect(lastCall()[1].body).toBe(JSON.stringify({ key: 'Enter' }))
    })

    it('system reads are GETs', async () => {
      for (const [method, action] of [
        [client.computerPosition, 'position'],
        [client.computerScreenSize, 'screen_size'],
        [client.computerPermissions, 'permissions'],
      ] as const) {
        await method.call(client, 'pc-1')
        expect(lastCall()[0]).toBe(`${BASE_URL}/api/computer/pc-1/${action}`)
        expect(lastCall()[1].method).toBe('GET')
      }
    })

    it('launchApp sends app_name', async () => {
      await client.computerLaunchApp('pc-1', 'Calculator')
      expect(lastCall()[0]).toBe(`${BASE_URL}/api/computer/pc-1/launch_app`)
      expect(lastCall()[1].body).toBe(JSON.stringify({ app_name: 'Calculator' }))
    })

    it('wait converts milliseconds to seconds', async () => {
      await client.computerWait('pc-1', 2000)
      expect(lastCall()[1].body).toBe(JSON.stringify({ seconds: 2 }))
    })

    it('bash omits a zero timeout so the server default applies', async () => {
      await client.computerBash('pc-1', 'ls')
      expect(lastCall()[1].body).toBe(JSON.stringify({ command: 'ls' }))

      await client.computerBash('pc-1', 'ls', 30)
      expect(lastCall()[1].body).toBe(JSON.stringify({ command: 'ls', timeout: 30 }))
    })

    it('blocking actions carry an abort signal', async () => {
      await client.computerWait('pc-1', 1000)
      expect(lastCall()[1].signal).toBeInstanceOf(AbortSignal)

      await client.computerBash('pc-1', 'ls')
      expect(lastCall()[1].signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('blocking-action deadlines', () => {
    it('wait allows the requested time plus a margin', () => {
      expect(waitTimeoutMs(300_000)).toBe(315_000)
      expect(waitTimeoutMs(0)).toBe(15_000)
      // A negative budget must not shrink the deadline below the margin.
      expect(waitTimeoutMs(-5)).toBe(15_000)
    })

    it('bash falls back to the server default when no timeout was asked for', () => {
      expect(bashTimeoutMs(0)).toBe(135_000)
      expect(bashTimeoutMs(-1)).toBe(135_000)
      expect(bashTimeoutMs(600)).toBe(615_000)
    })
  })

  describe('device listing', () => {
    it('forwards only the filters that were given', async () => {
      globalThis.fetch = jsonFetch({ code: 200, data: [] })
      await client.listDevices({ type: 'browser', state: 'free' })
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/devices?state=free&type=browser`)
      expect(lastCall()[1].method).toBe('GET')
    })

    it('forwards limit when given, and omits it otherwise', async () => {
      globalThis.fetch = jsonFetch({ code: 200, data: [] })
      await client.listDevices({ type: 'mobile', limit: 5 })
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/devices?type=mobile&limit=5`)

      await client.listDevices()
      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/devices`)
    })
  })

  describe('auth headers', () => {
    it('sends Authorization Bearer header', async () => {
      globalThis.fetch = jsonFetch()
      const authed = new DeviceBaseHttpClient({ baseUrl: BASE_URL, apiKey: 'my-key' })
      await authed.back('serial')
      expect(lastCall()[1].headers).toEqual({
        'Authorization': 'Bearer my-key',
        'Content-Type': 'application/json',
      })
    })
  })
})
