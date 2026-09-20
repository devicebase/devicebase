import type { Mock } from 'vitest'
import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BROWSER_GROUP, createBrowserCommand } from '../src/cli/browser.js'
import { COMPUTER_GROUP, createComputerCommand } from '../src/cli/computer.js'
import { readInputText } from '../src/cli/helpers.js'
import { createCliProgram, run } from '../src/cli/index.js'
import { LIST_DEVICES_COMMAND } from '../src/cli/list-devices.js'
import { createMobileCommand, MOBILE_GROUP } from '../src/cli/mobile.js'

const API_KEY = 'test-api-key'
const realFetch = globalThis.fetch

interface FetchCall {
  url: URL
  method: string
  body: unknown
  query: Record<string, string>
}

/** A fetch stub answering with the given JSON body. */
function jsonResponse(body = '{}'): Mock {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  }))
}

/** A fetch stub answering with raw bytes (screenshots). */
function binaryResponse(bytes: number[]): Mock {
  const buffer = new Uint8Array(bytes).buffer
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
    arrayBuffer: async () => buffer,
  }))
}

function lastFetch(fetchMock: Mock): FetchCall {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  const url = new URL(String(input))
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  return {
    url,
    method: (init?.method ?? 'GET').toUpperCase(),
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    query,
  }
}

function expectRequest(
  call: FetchCall,
  expected: {
    path: string
    method: string
    body?: Record<string, unknown>
    query?: Record<string, string>
  },
): void {
  expect(call.url.origin).toBe('https://api.devicebase.cn')
  expect(call.url.pathname).toBe(expected.path)
  expect(call.method).toBe(expected.method)
  expect(call.body).toEqual(expected.body)
  expect(call.query).toEqual(expected.query ?? {})
}

interface WireRow {
  argv: string[]
  expected: {
    path: string
    method: string
    body?: Record<string, unknown>
    query?: Record<string, string>
  }
}

async function runCli(argv: string[]): Promise<void> {
  await createCliProgram().parseAsync(argv, { from: 'user' })
}

/** Run a command that must fail, returning the error for further assertions. */
async function expectFailure(argv: string[], message: string | RegExp): Promise<Error> {
  const error = await runCli(argv).then(
    () => {
      throw new Error(`expected "${argv.join(' ')}" to fail, but it succeeded`)
    },
    (err: Error) => err,
  )
  expect(error.message).toMatch(message)
  return error
}

// --- Wire contract rows ---------------------------------------------------

const MOBILE_ROWS: WireRow[] = [
  { argv: ['mobile', '-s', 'dev-1', 'tap', '100,200'], expected: { path: '/v1/tap/dev-1', method: 'POST', body: { x: 100, y: 200 } } },
  { argv: ['mobile', '-s', 'dev-1', 'double-tap', '50,60'], expected: { path: '/v1/double_tap/dev-1', method: 'POST', body: { x: 50, y: 60 } } },
  { argv: ['mobile', '-s', 'dev-1', 'long-press', '50,60'], expected: { path: '/v1/long_press/dev-1', method: 'POST', body: { x: 50, y: 60 } } },
  { argv: ['mobile', '-s', 'dev-1', 'swipe', '100,200,300,400'], expected: { path: '/v1/swipe/dev-1', method: 'POST', body: { x1: 100, y1: 200, x2: 300, y2: 400 } } },
  { argv: ['mobile', '-s', 'dev-1', 'back'], expected: { path: '/v1/back/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'home'], expected: { path: '/v1/home/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'launch-app', 'com.example.app'], expected: { path: '/v1/launch_app/dev-1', method: 'POST', body: { app_name: 'com.example.app' } } },
  { argv: ['mobile', '-s', 'dev-1', 'stop-app', 'com.example.app'], expected: { path: '/v1/stop_app/dev-1', method: 'POST', body: { app_name: 'com.example.app' } } },
  { argv: ['mobile', '-s', 'dev-1', 'stop-current-app'], expected: { path: '/v1/stop_current_app/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'bash', 'ls -la'], expected: { path: '/v1/bash/dev-1', method: 'POST', body: { command: 'ls -la' } } },
  { argv: ['mobile', '-s', 'dev-1', 'input', 'Hello 世界'], expected: { path: '/v1/input/dev-1', method: 'POST', body: { text: 'Hello 世界' } } },
  { argv: ['mobile', '-s', 'dev-1', 'clear-text'], expected: { path: '/v1/clear_text/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'current-app'], expected: { path: '/v1/current_app/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'dump-hierarchy'], expected: { path: '/v1/dump_hierarchy/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'device-info'], expected: { path: '/v1/deviceinfo/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'install-app', '/tmp/app.apk'], expected: { path: '/v1/install_app/dev-1', method: 'POST', body: { app_path: '/tmp/app.apk' } } },
  { argv: ['mobile', '-s', 'dev-1', 'install-status', 'install-42'], expected: { path: '/v1/install_status/dev-1', method: 'GET', query: { install_id: 'install-42' } } },
  // Cross-family: screenshot is /v1/screen/{serialno} for every platform.
  { argv: ['mobile', '-s', 'dev-1', 'screenshot'], expected: { path: '/v1/screen/dev-1', method: 'POST' } },
]

const BROWSER_ROWS: WireRow[] = [
  { argv: ['browser', '-s', 'br-uuid', 'navigate', 'https://example.com'], expected: { path: '/api/browser/br-uuid/navigate', method: 'POST', body: { url: 'https://example.com' } } },
  { argv: ['browser', '-s', 'br-uuid', 'refresh'], expected: { path: '/api/browser/br-uuid/refresh', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'go-back'], expected: { path: '/api/browser/br-uuid/go_back', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'go-forward'], expected: { path: '/api/browser/br-uuid/go_forward', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'input', 'hello world'], expected: { path: '/api/browser/br-uuid/input', method: 'POST', body: { text: 'hello world' } } },
  { argv: ['browser', '-s', 'br-uuid', 'click', '#submit'], expected: { path: '/api/browser/br-uuid/click', method: 'POST', body: { selector: '#submit' } } },
  { argv: ['browser', '-s', 'br-uuid', 'fill', '#query', 'devices'], expected: { path: '/api/browser/br-uuid/fill', method: 'POST', body: { selector: '#query', value: 'devices' } } },
  { argv: ['browser', '-s', 'br-uuid', 'select', '#sort', 'price'], expected: { path: '/api/browser/br-uuid/select', method: 'POST', body: { selector: '#sort', value: 'price' } } },
  { argv: ['browser', '-s', 'br-uuid', 'text', '.title'], expected: { path: '/api/browser/br-uuid/text', method: 'GET', query: { selector: '.title' } } },
  { argv: ['browser', '-s', 'br-uuid', 'attribute', '#link', 'href'], expected: { path: '/api/browser/br-uuid/attribute', method: 'GET', query: { selector: '#link', attribute: 'href' } } },
  { argv: ['browser', '-s', 'br-uuid', 'exists', '.empty'], expected: { path: '/api/browser/br-uuid/exists', method: 'GET', query: { selector: '.empty' } } },
  { argv: ['browser', '-s', 'br-uuid', 'execute', '1+1'], expected: { path: '/api/browser/br-uuid/execute', method: 'POST', body: { script: '1+1' } } },
  { argv: ['browser', '-s', 'br-uuid', 'hotkey', 'Meta', 'a'], expected: { path: '/api/browser/br-uuid/hotkey', method: 'POST', body: { keys: ['Meta', 'a'] } } },
  { argv: ['browser', '-s', 'br-uuid', 'state'], expected: { path: '/api/browser/br-uuid/state', method: 'GET' } },
  { argv: ['browser', '-s', 'br-uuid', 'tabs'], expected: { path: '/api/browser/br-uuid/tabs', method: 'GET' } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-open', 'https://example.com/a'], expected: { path: '/api/browser/br-uuid/tab/open', method: 'POST', body: { url: 'https://example.com/a' } } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-close', 'tab-1'], expected: { path: '/api/browser/br-uuid/tab/close', method: 'POST', body: { tab_id: 'tab-1' } } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-close-all'], expected: { path: '/api/browser/br-uuid/tab/close_all', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-switch', 'tab-2'], expected: { path: '/api/browser/br-uuid/tab/switch', method: 'POST', body: { tab_id: 'tab-2' } } },
  { argv: ['browser', '-s', 'br-uuid', 'launch'], expected: { path: '/api/browser/br-uuid/launch', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'close'], expected: { path: '/api/browser/br-uuid/close', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'screenshot'], expected: { path: '/v1/screen/br-uuid', method: 'POST' } },
]

const COMPUTER_ROWS: WireRow[] = [
  // No --button: the field is omitted so the server applies its own "left" default.
  { argv: ['computer', '-s', 'pc-1', 'click', '10,20'], expected: { path: '/api/computer/pc-1/click', method: 'POST', body: { x: 10, y: 20 } } },
  { argv: ['computer', '-s', 'pc-1', 'click', '10,20', '--button', 'right'], expected: { path: '/api/computer/pc-1/click', method: 'POST', body: { x: 10, y: 20, button: 'right' } } },
  { argv: ['computer', '-s', 'pc-1', 'double-click', '30,40'], expected: { path: '/api/computer/pc-1/double_click', method: 'POST', body: { x: 30, y: 40 } } },
  { argv: ['computer', '-s', 'pc-1', 'long-click', '5,5', '--seconds', '2'], expected: { path: '/api/computer/pc-1/long_click', method: 'POST', body: { x: 5, y: 5, duration: 2 } } },
  { argv: ['computer', '-s', 'pc-1', 'long-click', '5,5'], expected: { path: '/api/computer/pc-1/long_click', method: 'POST', body: { x: 5, y: 5 } } },
  { argv: ['computer', '-s', 'pc-1', 'move', '100,200'], expected: { path: '/api/computer/pc-1/move', method: 'POST', body: { x: 100, y: 200 } } },
  { argv: ['computer', '-s', 'pc-1', 'drag', '0,0,100,200'], expected: { path: '/api/computer/pc-1/drag', method: 'POST', body: { x1: 0, y1: 0, x2: 100, y2: 200 } } },
  { argv: ['computer', '-s', 'pc-1', 'scroll', 'down'], expected: { path: '/api/computer/pc-1/scroll', method: 'POST', body: { direction: 'down' } } },
  { argv: ['computer', '-s', 'pc-1', 'scroll', 'up', '--amount', '3'], expected: { path: '/api/computer/pc-1/scroll', method: 'POST', body: { direction: 'up', amount: 3 } } },
  { argv: ['computer', '-s', 'pc-1', 'type-text', 'hello'], expected: { path: '/api/computer/pc-1/type_text', method: 'POST', body: { text: 'hello' } } },
  { argv: ['computer', '-s', 'pc-1', 'press', 'Enter'], expected: { path: '/api/computer/pc-1/press', method: 'POST', body: { key: 'Enter' } } },
  { argv: ['computer', '-s', 'pc-1', 'hotkey', 'Control', 'Shift', 'Escape'], expected: { path: '/api/computer/pc-1/hotkey', method: 'POST', body: { keys: ['Control', 'Shift', 'Escape'] } } },
  { argv: ['computer', '-s', 'pc-1', 'position'], expected: { path: '/api/computer/pc-1/position', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'screen-size'], expected: { path: '/api/computer/pc-1/screen_size', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'permissions'], expected: { path: '/api/computer/pc-1/permissions', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'launch-app', 'Calculator'], expected: { path: '/api/computer/pc-1/launch_app', method: 'POST', body: { app_name: 'Calculator' } } },
  // The CLI takes milliseconds; the wire field is seconds.
  { argv: ['computer', '-s', 'pc-1', 'wait', '500'], expected: { path: '/api/computer/pc-1/wait', method: 'POST', body: { seconds: 0.5 } } },
  { argv: ['computer', '-s', 'pc-1', 'wait', '2000'], expected: { path: '/api/computer/pc-1/wait', method: 'POST', body: { seconds: 2 } } },
  { argv: ['computer', '-s', 'pc-1', 'bash', 'ls -la'], expected: { path: '/api/computer/pc-1/bash', method: 'POST', body: { command: 'ls -la' } } },
  { argv: ['computer', '-s', 'pc-1', 'bash', 'ls', '--timeout', '30'], expected: { path: '/api/computer/pc-1/bash', method: 'POST', body: { command: 'ls', timeout: 30 } } },
  { argv: ['computer', '-s', 'pc-1', 'screenshot'], expected: { path: '/v1/screen/pc-1', method: 'POST' } },
]

describe('devicebase CLI command tree', () => {
  let logSpy: Mock

  beforeEach(() => {
    process.env.DEVICEBASE_API_KEY = API_KEY
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Silence the binary stdout of `screenshot` without losing the call record.
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    globalThis.fetch = jsonResponse()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DEVICEBASE_API_KEY
    globalThis.fetch = realFetch
  })

  it('registers only list-devices and the three platform groups', () => {
    const names = createCliProgram().commands.map(c => c.name())
    expect(names).toEqual([
      LIST_DEVICES_COMMAND,
      MOBILE_GROUP,
      BROWSER_GROUP,
      COMPUTER_GROUP,
    ])
  })

  it('exposes the full mobile command set (18)', () => {
    const names = createMobileCommand().commands.map(c => c.name())
    expect(names).toEqual([
      'tap',
      'double-tap',
      'long-press',
      'swipe',
      'back',
      'home',
      'launch-app',
      'stop-app',
      'stop-current-app',
      'bash',
      'input',
      'clear-text',
      'current-app',
      'dump-hierarchy',
      'device-info',
      'install-app',
      'install-status',
      'screenshot',
    ])
  })

  it('exposes the full browser command set (22)', () => {
    const names = createBrowserCommand().commands.map(c => c.name())
    expect(names).toEqual([
      'navigate',
      'refresh',
      'go-back',
      'go-forward',
      'input',
      'click',
      'fill',
      'select',
      'text',
      'attribute',
      'exists',
      'execute',
      'hotkey',
      'state',
      'tabs',
      'tab-open',
      'tab-close',
      'tab-close-all',
      'tab-switch',
      'launch',
      'close',
      'screenshot',
    ])
  })

  it('exposes the full computer command set (16)', () => {
    const names = createComputerCommand().commands.map(c => c.name())
    expect(names).toEqual([
      'click',
      'double-click',
      'long-click',
      'move',
      'drag',
      'scroll',
      'type-text',
      'press',
      'hotkey',
      'position',
      'screen-size',
      'permissions',
      'launch-app',
      'wait',
      'bash',
      'screenshot',
    ])
  })

  it('drops the old flat top-level commands entirely', () => {
    const names = createCliProgram().commands.map(c => c.name())
    for (const legacy of ['tap', 'swipe', 'screenshot', 'device-info', 'dump-hierarchy']) {
      expect(names).not.toContain(legacy)
    }
  })

  describe('wire contract (method / path / body / query)', () => {
    it.each(MOBILE_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'mobile %s',
      async (_label, row) => {
        await runCli(row.argv)
        expectRequest(lastFetch(globalThis.fetch as Mock), row.expected)
      },
    )

    it.each(BROWSER_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'browser %s',
      async (_label, row) => {
        await runCli(row.argv)
        expectRequest(lastFetch(globalThis.fetch as Mock), row.expected)
      },
    )

    it.each(COMPUTER_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'computer %s',
      async (_label, row) => {
        await runCli(row.argv)
        expectRequest(lastFetch(globalThis.fetch as Mock), row.expected)
      },
    )

    it('accepts the root -s before the group, as the Go CLI does', async () => {
      await runCli(['-s', 'dev-1', 'mobile', 'tap', '100,200'])
      expectRequest(lastFetch(globalThis.fetch as Mock), {
        path: '/v1/tap/dev-1',
        method: 'POST',
        body: { x: 100, y: 200 },
      })
    })

    it('list-devices passes type/keyword/state/limit as query params', async () => {
      await runCli([
        'list-devices',
        '--type',
        'browser',
        '--keyword',
        'mac',
        '--state',
        'free',
        '--limit',
        '5',
      ])
      expectRequest(lastFetch(globalThis.fetch as Mock), {
        path: '/v1/devices',
        method: 'GET',
        query: { type: 'browser', keyword: 'mac', state: 'free', limit: '5' },
      })
    })

    it('list-devices defaults --limit to 10', async () => {
      await runCli(['list-devices'])
      expectRequest(lastFetch(globalThis.fetch as Mock), {
        path: '/v1/devices',
        method: 'GET',
        query: { limit: '10' },
      })
    })

    it('list-devices rejects a non-positive or non-numeric --limit', async () => {
      await expectFailure(['list-devices', '--limit', '0'], /--limit must be greater than 0, got 0/)
      await expectFailure(['list-devices', '--limit', 'abc'], /invalid limit "abc", expected a positive integer/)
    })
  })

  describe('output and exit handling', () => {
    it('prints the server envelope verbatim, not a wrapper', async () => {
      globalThis.fetch = jsonResponse(
        '{"code":200,"message":"success","data":{"width":1470,"height":956},"timestamp":"t"}',
      )
      await runCli(['computer', '-s', 'pc-1', 'screen-size'])
      expect(logSpy.mock.calls[0][0]).toBe(
        '{"code":200,"message":"success","data":{"width":1470,"height":956},"timestamp":"t"}',
      )
    })

    it('fails when an HTTP 200 carries a non-2xx envelope code', async () => {
      globalThis.fetch = jsonResponse(
        '{"code":502,"message":"Element not found: #nope","data":null}',
      )
      await expectFailure(
        ['browser', '-s', 'br-1', 'click', '#nope'],
        /API error \(code 502\): \{"code":502/,
      )
    })

    it('includes the server body in an HTTP error', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"code":404,"message":"设备不存在: nope"}',
        arrayBuffer: async () => new ArrayBuffer(0),
      }))
      await expectFailure(
        ['computer', '-s', 'nope', 'position'],
        /API error \(HTTP 404\): \{"code":404,"message":"设备不存在: nope"\}/,
      )
    })

    it('propagates a network failure', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('connect ECONNREFUSED')
      })
      await expectFailure(['computer', '-s', 'pc-1', 'position'], /ECONNREFUSED/)
    })
  })

  describe('screenshot', () => {
    // JPEG magic bytes — the format the server actually returns.
    const JPEG = [0xFF, 0xD8, 0xFF, 0xE0]

    it('streams raw bytes to stdout when no -o is given', async () => {
      globalThis.fetch = binaryResponse(JPEG)
      await runCli(['mobile', '-s', 'dev-1', 'screenshot'])
      const written = vi.mocked(process.stdout.write).mock.calls[0][0] as Uint8Array
      expect(Array.from(written)).toEqual(JPEG)
    })

    it('writes the file and stays quiet for a matching extension', async () => {
      globalThis.fetch = binaryResponse(JPEG)
      const dir = mkdtempSync(join(tmpdir(), 'devicebase-cli-'))
      const out = join(dir, 'shot.jpg')
      const errorSpy = vi.mocked(console.error)
      try {
        await runCli(['computer', '-s', 'pc-1', 'screenshot', '-o', out])
        expect(logSpy.mock.calls[0][0]).toBe(`Screenshot saved to ${out}`)
        expect(errorSpy).not.toHaveBeenCalled()
        expect(new Uint8Array(readFileSync(out))).toEqual(new Uint8Array(JPEG))
      }
      finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('warns when the extension contradicts the bytes returned', async () => {
      globalThis.fetch = binaryResponse(JPEG)
      const dir = mkdtempSync(join(tmpdir(), 'devicebase-cli-'))
      const out = join(dir, 'shot.png')
      try {
        await runCli(['computer', '-s', 'pc-1', 'screenshot', '-o', out])
        expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
          `Warning: ${out} has a .png extension but the server returned JPEG data`,
        )
      }
      finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  describe('argument and serialno validation', () => {
    it('reports a missing serialno with the mobile group message and no hint', async () => {
      // The mobile group is the broadest one: there is no narrower discovery
      // hint to give, so the message stands alone (the Go CLI does the same).
      const error = await expectFailure(
        ['mobile', 'tap', '100,200'],
        /^required flag\(s\) "--serialno" not set$/,
      )
      expect(error.message).not.toContain('HINT')
    })

    it('hints list-devices --type browser when the browser serialno is missing', async () => {
      await expectFailure(
        ['browser', 'state'],
        /HINT: find a browser device to control first: devicebase list-devices --type browser/,
      )
    })

    it('hints list-devices --type computer when the computer serialno is missing', async () => {
      await expectFailure(
        ['computer', 'position'],
        /HINT: find a computer device to control first: devicebase list-devices --type computer/,
      )
    })

    it('rejects an invalid point format', async () => {
      await expectFailure(['mobile', '-s', 'dev-1', 'tap', 'abc'], /invalid point format "abc", expected x,y/)
      await expectFailure(['mobile', '-s', 'dev-1', 'tap', '1,abc'], /invalid y coordinate "abc"/)
    })

    it('rejects an invalid bounds format', async () => {
      await expectFailure(['computer', '-s', 'pc-1', 'drag', '1,2'], /invalid bounds format "1,2", expected x1,y1,x2,y2/)
    })

    it('rejects a wait duration outside 1-300000 ms', async () => {
      await expectFailure(['computer', '-s', 'pc-1', 'wait', '0'], /must be between 1 and 300000 ms/)
      await expectFailure(['computer', '-s', 'pc-1', 'wait', '300001'], /must be between 1 and 300000 ms/)
    })

    it('rejects a long-click --seconds outside 1-60', async () => {
      await expectFailure(['computer', '-s', 'pc-1', 'long-click', '1,2', '--seconds', '61'], /--seconds must be between 1 and 60/)
    })

    it('rejects a bash --timeout above 600 seconds', async () => {
      await expectFailure(['computer', '-s', 'pc-1', 'bash', 'ls', '--timeout', '601'], /--timeout must be between 0 and 600 seconds/)
    })

    it('rejects an invalid scroll direction', async () => {
      await expectFailure(['computer', '-s', 'pc-1', 'scroll', 'sideways'], /invalid direction "sideways", expected one of: up, down, left, right/)
    })

    it('rejects an invalid --button with the Go CLI wording', async () => {
      await expectFailure(
        ['computer', '-s', 'pc-1', 'click', '1,2', '--button', 'sideways'],
        /invalid button "sideways", expected one of: left, right, middle/,
      )
    })

    it('rejects a blank positional argument', async () => {
      await expectFailure(['browser', '-s', 'br-1', 'fill', '   ', 'x'], /selector cannot be empty/)
      await expectFailure(['mobile', '-s', 'dev-1', 'launch-app', '  '], /app_name cannot be empty/)
    })

    it('rejects a missing required argument through commander', async () => {
      await expect(
        runCli(['browser', '-s', 'br-uuid', 'navigate']),
      ).rejects.toMatchObject({ code: 'commander.missingArgument' })
    })
  })

  describe('help and version output', () => {
    it('lists the four top-level commands in root help', async () => {
      await expect(runCli(['--help'])).rejects.toMatchObject({ code: 'commander.helpDisplayed' })
      const text = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join('')
      expect(text).toContain('list-devices [options]')
      expect(text).toContain('mobile [options]')
      expect(text).toContain('browser [options]')
      expect(text).toContain('computer [options]')
    })

    it('prints the version matching package.json', async () => {
      await expect(runCli(['--version'])).rejects.toMatchObject({ code: 'commander.version' })
      const text = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join('')
      expect(text.trim()).toBe('0.2.0')
    })
  })
})

describe('readInputText', () => {
  it('prefers the positional argument when given', async () => {
    await expect(readInputText('hello 世界', 'usage')).resolves.toBe('hello 世界')
  })

  it('reads stdin and drops the trailing newline', async () => {
    await expect(readInputText(undefined, 'usage', Readable.from(['hello\n']))).resolves.toBe('hello')
  })

  it('keeps a multi-byte character split across chunks intact', async () => {
    const bytes = Buffer.from('世界', 'utf8')
    const stream = Readable.from([
      bytes.subarray(0, 1),
      bytes.subarray(1, 4),
      bytes.subarray(4),
    ])
    await expect(readInputText(undefined, 'usage', stream)).resolves.toBe('世界')
  })

  it('fails on empty or whitespace-only stdin', async () => {
    await expect(readInputText(undefined, 'usage', Readable.from(['\n']))).rejects.toThrow(/no text received on stdin/)
    await expect(readInputText(undefined, 'usage', Readable.from(['   \n']))).rejects.toThrow(/no text received on stdin/)
  })

  it('fails fast on a TTY instead of blocking for input', async () => {
    const tty = Readable.from([]) as Readable & { isTTY?: boolean }
    tty.isTTY = true
    await expect(readInputText(undefined, 'usage', tty)).rejects.toThrow(/pass it as an argument or pipe it in/)
  })
})

describe('run() exit handling', () => {
  beforeEach(() => {
    process.env.DEVICEBASE_API_KEY = API_KEY
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    globalThis.fetch = jsonResponse()
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DEVICEBASE_API_KEY
    globalThis.fetch = realFetch
    process.exitCode = undefined
  })

  it('prints "Error: <message>" on stderr and sets exit code 1', async () => {
    await run(['node', 'devicebase', 'mobile', 'tap', '100,200'])
    expect(process.exitCode).toBe(1)
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      'Error: required flag(s) "--serialno" not set',
    )
  })

  it('leaves a successful command without an exit code', async () => {
    await run(['node', 'devicebase', 'mobile', '-s', 'dev-1', 'back'])
    expect(process.exitCode).toBeUndefined()
  })

  it('maps a commander usage error onto its exit code without re-printing', async () => {
    await run(['node', 'devicebase', 'computer', '-s', 'pc-1', 'click', '1,2', '--nosuchflag'])
    expect(process.exitCode).toBe(1)
    // Commander already wrote the usage error to stderr.
    expect(vi.mocked(console.error)).not.toHaveBeenCalled()
  })

  it('exits 0 for --help', async () => {
    await run(['node', 'devicebase', '--help'])
    expect(process.exitCode).toBe(0)
  })
})

describe('platform module factories', () => {
  it('each factory attaches its group to any parent command', () => {
    const parent = new Command('probe')
    parent.addCommand(createMobileCommand())
    parent.addCommand(createBrowserCommand())
    parent.addCommand(createComputerCommand())
    expect(parent.commands.map(c => c.name())).toEqual([
      MOBILE_GROUP,
      BROWSER_GROUP,
      COMPUTER_GROUP,
    ])
  })

  it('produces a fresh group per call so a command is never registered twice', () => {
    const first = createMobileCommand()
    const second = createMobileCommand()
    expect(first).not.toBe(second)
    expect(first.commands[0]).not.toBe(second.commands[0])
  })
})
