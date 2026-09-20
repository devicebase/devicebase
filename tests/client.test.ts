import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceBaseClient } from '../src/client.js'
import { AuthenticationError } from '../src/http-client.js'

const API_KEY = 'test-api-key'
const BASE_URL = 'http://localhost:9999'
const SERIAL = 'device123'

describe('deviceBaseClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('throws AuthenticationError without API key', () => {
      const orig = process.env.DEVICEBASE_API_KEY
      delete process.env.DEVICEBASE_API_KEY
      expect(() => new DeviceBaseClient({ serial: SERIAL })).toThrow(AuthenticationError)
      process.env.DEVICEBASE_API_KEY = orig
    })

    it('creates client with explicit config', () => {
      const client = new DeviceBaseClient({
        serial: SERIAL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
      })
      expect(client).toBeDefined()
    })

    it('reads API key from env', () => {
      const orig = process.env.DEVICEBASE_API_KEY
      process.env.DEVICEBASE_API_KEY = API_KEY
      const client = new DeviceBaseClient({ serial: SERIAL, baseUrl: BASE_URL })
      expect(client).toBeDefined()
      process.env.DEVICEBASE_API_KEY = orig
    })
  })

  describe('device operations', () => {
    let client: DeviceBaseClient

    beforeEach(() => {
      client = new DeviceBaseClient({
        serial: SERIAL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
      })
    })

    it('getDeviceInfo delegates to http client', async () => {
      const mockData = { model: 'Pixel 7' }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      })

      const result = await client.getDeviceInfo()
      expect(result.serial).toBe(SERIAL)
      expect(result.data).toEqual(mockData)
    })

    it('tap sends coordinates', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      const result = await client.tap(100, 200)
      expect(result.success).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/tap/${SERIAL}`,
        expect.objectContaining({
          body: JSON.stringify({ x: 100, y: 200 }),
        }),
      )
    })

    it('swipe sends four coordinates', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.swipe(0, 100, 300, 100)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/swipe/${SERIAL}`,
        expect.objectContaining({
          body: JSON.stringify({ x1: 0, y1: 100, x2: 300, y2: 100 }),
        }),
      )
    })

    it('launchApp sends app name', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.launchApp('com.tencent.mm')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/launch_app/${SERIAL}`,
        expect.objectContaining({
          body: JSON.stringify({ app_name: 'com.tencent.mm' }),
        }),
      )
    })

    it('inputText sends text', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.inputText('hello')
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/input/${SERIAL}`,
        expect.objectContaining({
          body: JSON.stringify({ text: 'hello' }),
        }),
      )
    })

    it('back calls correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.back()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/back/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('home calls correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.home()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/home/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('doubleTap calls correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.doubleTap(50, 60)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/double_tap/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('longPress calls correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.longPress(50, 60)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/long_press/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('clearText calls correct endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      })

      await client.clearText()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/clear_text/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('getCurrentApp returns AppInfo', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ name: 'com.tencent.mm' }),
      })

      const result = await client.getCurrentApp()
      expect(result.data).toEqual({ name: 'com.tencent.mm' })
    })

    it('dumpHierarchy returns HierarchyInfo', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ nodes: [] }),
      })

      const result = await client.dumpHierarchy()
      expect(result.data).toEqual({ nodes: [] })
    })

    it('getScreenshot returns ArrayBuffer', async () => {
      const fakeImage = new Uint8Array([0xFF, 0xD8]).buffer
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => fakeImage,
      })

      const result = await client.getScreenshot()
      expect(result).toBeInstanceOf(ArrayBuffer)
    })

    it('getScreenshot POSTs to the screen endpoint', async () => {
      const fakeImage = new Uint8Array([0xFF, 0xD8]).buffer
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => fakeImage,
      })

      await client.getScreenshot()
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v1/screen/${SERIAL}`,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('stopApp, stopCurrentApp, bash and install delegate to the http client', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{}',
      })

      await client.stopApp('com.example.app')
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `${BASE_URL}/v1/stop_app/${SERIAL}`,
        expect.objectContaining({ body: JSON.stringify({ app_name: 'com.example.app' }) }),
      )

      await client.stopCurrentApp()
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `${BASE_URL}/v1/stop_current_app/${SERIAL}`,
        expect.anything(),
      )

      await client.bash('ls -la')
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `${BASE_URL}/v1/bash/${SERIAL}`,
        expect.objectContaining({ body: JSON.stringify({ command: 'ls -la' }) }),
      )

      await client.installApp('/tmp/app.apk')
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `${BASE_URL}/v1/install_app/${SERIAL}`,
        expect.objectContaining({ body: JSON.stringify({ app_path: '/tmp/app.apk' }) }),
      )

      await client.installStatus('install-42')
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `${BASE_URL}/v1/install_status/${SERIAL}?install_id=install-42`,
        expect.anything(),
      )
    })
  })

  describe('webSocket client factories', () => {
    it('minicapClient returns configured MinicapClient', () => {
      const client = new DeviceBaseClient({
        serial: SERIAL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
      })
      const minicap = client.minicapClient()
      expect(minicap).toBeDefined()
    })

    it('minitouchClient returns configured MinitouchClient', () => {
      const client = new DeviceBaseClient({
        serial: SERIAL,
        apiKey: API_KEY,
        baseUrl: BASE_URL,
      })
      const minitouch = client.minitouchClient()
      expect(minitouch).toBeDefined()
    })
  })
})
