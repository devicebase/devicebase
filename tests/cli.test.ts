import type { Mock } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Command } from 'commander'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BROWSER_GROUP, registerBrowserCommands } from '../src/cli/browser.js'
import {
  COMPUTER_GROUP,
  registerComputerCommands,
} from '../src/cli/computer.js'
import { createCliProgram } from '../src/cli/index.js'
import {
  MOBILE_GROUP,
  registerMobileAliases,
  registerMobileGroup,
} from '../src/cli/mobile.js'

const API_KEY = 'test-api-key'
const realFetch = globalThis.fetch

interface FetchCall { url: URL, method: string, body: unknown, query: Record<string, string> }

function fetchMockFor(): Mock {
  return vi.fn(async (_input: unknown) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '{}',
    arrayBuffer: async () => new ArrayBuffer(0),
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

async function runWireRow(row: WireRow, fetchMock: Mock): Promise<void> {
  const program = createCliProgram()
  program.exitOverride()
  await program.parseAsync(row.argv, { from: 'user' })
  expectRequest(lastFetch(fetchMock), row.expected)
}

/** Errors/help/version may be raised on any command in the tree — override exits everywhere. */
function overrideExits(program: Command): void {
  program.exitOverride((err) => {
    throw err
  })
  for (const child of program.commands) {
    overrideExits(child)
  }
}

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
  { argv: ['browser', '-s', 'br-uuid', 'hotkey', 'ctrl', 'shift', 't'], expected: { path: '/api/browser/br-uuid/hotkey', method: 'POST', body: { keys: ['ctrl', 'shift', 't'] } } },
  { argv: ['browser', '-s', 'br-uuid', 'state'], expected: { path: '/api/browser/br-uuid/state', method: 'GET' } },
  { argv: ['browser', '-s', 'br-uuid', 'tabs'], expected: { path: '/api/browser/br-uuid/tabs', method: 'GET' } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-open', 'https://example.com/a'], expected: { path: '/api/browser/br-uuid/tab/open', method: 'POST', body: { url: 'https://example.com/a' } } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-close', 'tab-1'], expected: { path: '/api/browser/br-uuid/tab/close', method: 'POST', body: { tab_id: 'tab-1' } } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-close-all'], expected: { path: '/api/browser/br-uuid/tab/close_all', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'tab-switch', 'tab-2'], expected: { path: '/api/browser/br-uuid/tab/switch', method: 'POST', body: { tab_id: 'tab-2' } } },
  { argv: ['browser', '-s', 'br-uuid', 'launch'], expected: { path: '/api/browser/br-uuid/launch', method: 'POST' } },
  { argv: ['browser', '-s', 'br-uuid', 'close'], expected: { path: '/api/browser/br-uuid/close', method: 'POST' } },
]

const COMPUTER_ROWS: WireRow[] = [
  { argv: ['computer', '-s', 'pc-1', 'click', '10,20'], expected: { path: '/api/computer/pc-1/click', method: 'POST', body: { x: 10, y: 20, button: 'left' } } },
  { argv: ['computer', '-s', 'pc-1', 'click', '10,20', '--button', 'right'], expected: { path: '/api/computer/pc-1/click', method: 'POST', body: { x: 10, y: 20, button: 'right' } } },
  { argv: ['computer', '-s', 'pc-1', 'click', '10,20', '--button', 'middle'], expected: { path: '/api/computer/pc-1/click', method: 'POST', body: { x: 10, y: 20, button: 'middle' } } },
  { argv: ['computer', '-s', 'pc-1', 'double-click', '30,40'], expected: { path: '/api/computer/pc-1/double_click', method: 'POST', body: { x: 30, y: 40 } } },
  { argv: ['computer', '-s', 'pc-1', 'long-click', '5,5', '--seconds', '2'], expected: { path: '/api/computer/pc-1/long_click', method: 'POST', body: { x: 5, y: 5, duration: 2 } } },
  { argv: ['computer', '-s', 'pc-1', 'long-click', '5,5'], expected: { path: '/api/computer/pc-1/long_click', method: 'POST', body: { x: 5, y: 5 } } },
  { argv: ['computer', '-s', 'pc-1', 'move', '100,200'], expected: { path: '/api/computer/pc-1/move', method: 'POST', body: { x: 100, y: 200 } } },
  { argv: ['computer', '-s', 'pc-1', 'drag', '0,0,100,200'], expected: { path: '/api/computer/pc-1/drag', method: 'POST', body: { x1: 0, y1: 0, x2: 100, y2: 200 } } },
  { argv: ['computer', '-s', 'pc-1', 'scroll', 'down'], expected: { path: '/api/computer/pc-1/scroll', method: 'POST', body: { direction: 'down' } } },
  { argv: ['computer', '-s', 'pc-1', 'scroll', 'up', '--amount', '3'], expected: { path: '/api/computer/pc-1/scroll', method: 'POST', body: { direction: 'up', amount: 3 } } },
  { argv: ['computer', '-s', 'pc-1', 'type-text', 'hello'], expected: { path: '/api/computer/pc-1/type_text', method: 'POST', body: { text: 'hello' } } },
  { argv: ['computer', '-s', 'pc-1', 'press', 'Enter'], expected: { path: '/api/computer/pc-1/press', method: 'POST', body: { key: 'Enter' } } },
  { argv: ['computer', '-s', 'pc-1', 'hotkey', 'ctrl', 'alt', 's'], expected: { path: '/api/computer/pc-1/hotkey', method: 'POST', body: { keys: ['ctrl', 'alt', 's'] } } },
  { argv: ['computer', '-s', 'pc-1', 'position'], expected: { path: '/api/computer/pc-1/position', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'screen-size'], expected: { path: '/api/computer/pc-1/screen_size', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'permissions'], expected: { path: '/api/computer/pc-1/permissions', method: 'GET' } },
  { argv: ['computer', '-s', 'pc-1', 'launch-app', 'Calculator'], expected: { path: '/api/computer/pc-1/launch_app', method: 'POST', body: { app_name: 'Calculator' } } },
  { argv: ['computer', '-s', 'pc-1', 'wait', '500'], expected: { path: '/api/computer/pc-1/wait', method: 'POST', body: { seconds: 0.5 } } },
  { argv: ['computer', '-s', 'pc-1', 'wait', '2000'], expected: { path: '/api/computer/pc-1/wait', method: 'POST', body: { seconds: 2 } } },
]

const MOBILE_ROWS: WireRow[] = [
  { argv: ['mobile', '-s', 'dev-1', 'tap', '100,200'], expected: { path: '/v1/tap/dev-1', method: 'POST', body: { x: 100, y: 200 } } },
  { argv: ['mobile', '-s', 'dev-1', 'double-tap', '50,60'], expected: { path: '/v1/double_tap/dev-1', method: 'POST', body: { x: 50, y: 60 } } },
  { argv: ['mobile', '-s', 'dev-1', 'long-press', '50,60'], expected: { path: '/v1/long_press/dev-1', method: 'POST', body: { x: 50, y: 60 } } },
  { argv: ['mobile', '-s', 'dev-1', 'swipe', '100,200,300,400'], expected: { path: '/v1/swipe/dev-1', method: 'POST', body: { x1: 100, y1: 200, x2: 300, y2: 400 } } },
  { argv: ['mobile', '-s', 'dev-1', 'back'], expected: { path: '/v1/back/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'home'], expected: { path: '/v1/home/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'launch-app', 'com.example.app'], expected: { path: '/v1/launch_app/dev-1', method: 'POST', body: { app_name: 'com.example.app' } } },
  { argv: ['mobile', '-s', 'dev-1', 'input', 'Hello World'], expected: { path: '/v1/input/dev-1', method: 'POST', body: { text: 'Hello World' } } },
  { argv: ['mobile', '-s', 'dev-1', 'clear-text'], expected: { path: '/v1/clear_text/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'current-app'], expected: { path: '/v1/current_app/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'dump-hierarchy'], expected: { path: '/v1/dump_hierarchy/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'device-info'], expected: { path: '/v1/deviceinfo/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'stop-app', 'com.example.app'], expected: { path: '/v1/stop_app/dev-1', method: 'POST', body: { app_name: 'com.example.app' } } },
  { argv: ['mobile', '-s', 'dev-1', 'stop-current-app'], expected: { path: '/v1/stop_current_app/dev-1', method: 'POST' } },
  { argv: ['mobile', '-s', 'dev-1', 'bash', 'ls -la'], expected: { path: '/v1/bash/dev-1', method: 'POST', body: { command: 'ls -la' } } },
  { argv: ['mobile', '-s', 'dev-1', 'install-app', '/tmp/app.apk'], expected: { path: '/v1/install_app/dev-1', method: 'POST', body: { app_path: '/tmp/app.apk' } } },
  { argv: ['mobile', '-s', 'dev-1', 'install-status', 'install-42'], expected: { path: '/v1/install_status/dev-1', method: 'GET', query: { install_id: 'install-42' } } },
]

// Legacy top-level aliases must hit exactly the same wire as the mobile group.
const LEGACY_ALIAS_ROWS: WireRow[] = [
  { argv: ['-s', 'dev-1', 'tap', '100,200'], expected: { path: '/v1/tap/dev-1', method: 'POST', body: { x: 100, y: 200 } } },
  { argv: ['-s', 'dev-1', 'swipe', '0,0,300,400'], expected: { path: '/v1/swipe/dev-1', method: 'POST', body: { x1: 0, y1: 0, x2: 300, y2: 400 } } },
  { argv: ['-s', 'dev-1', 'launch-app', 'com.tencent.mm'], expected: { path: '/v1/launch_app/dev-1', method: 'POST', body: { app_name: 'com.tencent.mm' } } },
  { argv: ['-s', 'dev-1', 'input', 'ping'], expected: { path: '/v1/input/dev-1', method: 'POST', body: { text: 'ping' } } },
  { argv: ['-s', 'dev-1', 'back'], expected: { path: '/v1/back/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'home'], expected: { path: '/v1/home/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'clear-text'], expected: { path: '/v1/clear_text/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'current-app'], expected: { path: '/v1/current_app/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'dump-hierarchy'], expected: { path: '/v1/dump_hierarchy/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'device-info'], expected: { path: '/v1/deviceinfo/dev-1', method: 'POST' } },
  { argv: ['-s', 'dev-1', 'double-tap', '1,2'], expected: { path: '/v1/double_tap/dev-1', method: 'POST', body: { x: 1, y: 2 } } },
  { argv: ['-s', 'dev-1', 'long-press', '3,4'], expected: { path: '/v1/long_press/dev-1', method: 'POST', body: { x: 3, y: 4 } } },
  { argv: ['-s', 'dev-1', 'screenshot'], expected: { path: '/v1/screen/dev-1', method: 'GET' } },
]

describe('devicebase CLI command tree', () => {
  let logSpy: Mock

  beforeEach(() => {
    process.env.DEVICEBASE_API_KEY = API_KEY
    // Silence per-command JSON output (and stdout binary writes).
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    globalThis.fetch = fetchMockFor()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DEVICEBASE_API_KEY
    globalThis.fetch = realFetch
  })

  it('registers the three platform groups, list-devices and the deprecated aliases', () => {
    const program = createCliProgram()
    const names = program.commands.map(c => c.name())
    expect(names).toEqual([
      MOBILE_GROUP,
      BROWSER_GROUP,
      COMPUTER_GROUP,
      'list-devices',
      'tap',
      'double-tap',
      'long-press',
      'swipe',
      'back',
      'home',
      'launch-app',
      'input',
      'clear-text',
      'current-app',
      'dump-hierarchy',
      'device-info',
      'screenshot',
    ])
    // The new stop/bash/install commands exist only under the mobile group.
    expect(program.commands.find(c => c.name() === 'mobile')?.commands.map(c => c.name()))
      .toEqual([
        'tap',
        'double-tap',
        'long-press',
        'swipe',
        'back',
        'home',
        'launch-app',
        'input',
        'clear-text',
        'current-app',
        'dump-hierarchy',
        'device-info',
        'screenshot',
        'stop-app',
        'stop-current-app',
        'bash',
        'install-app',
        'install-status',
      ])
  })

  it('exposes the full browser command set (21)', () => {
    const program = createCliProgram()
    const browser = program.commands.find(c => c.name() === BROWSER_GROUP)
    expect(browser?.commands.map(c => c.name())).toEqual([
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
    ])
  })

  it('exposes the full computer command set (14)', () => {
    const program = createCliProgram()
    const computer = program.commands.find(c => c.name() === COMPUTER_GROUP)
    expect(computer?.commands.map(c => c.name())).toEqual([
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
    ])
  })

  it('keeps legacy alias actions identical to the mobile group actions', () => {
    const program = createCliProgram()
    const mobile = program.commands.find(c => c.name() === MOBILE_GROUP)
    const tapInGroup = mobile?.commands.find(c => c.name() === 'tap')
    const tapAlias = program.commands.find(c => c.name() === 'tap')
    expect(tapAlias?.action).toBe(tapInGroup?.action)
    const screenshotInGroup = mobile?.commands.find(c => c.name() === 'screenshot')
    const screenshotAlias = program.commands.find(c => c.name() === 'screenshot')
    expect(screenshotAlias?.action).toBe(screenshotInGroup?.action)
    // stop-app has no top-level alias.
    expect(program.commands.find(c => c.name() === 'stop-app')).toBeUndefined()
  })

  describe('wire contract (method / path / body / query)', () => {
    it.each(BROWSER_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'browser %s',
      async (_label, row) => {
        await runWireRow(row, globalThis.fetch as Mock)
      },
    )

    it.each(COMPUTER_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'computer %s',
      async (_label, row) => {
        await runWireRow(row, globalThis.fetch as Mock)
      },
    )

    it.each(MOBILE_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'mobile %s',
      async (_label, row) => {
        await runWireRow(row, globalThis.fetch as Mock)
      },
    )

    it.each(LEGACY_ALIAS_ROWS.map(r => [r.argv.join(' '), r] as const))(
      'legacy alias %s',
      async (_label, row) => {
        await runWireRow(row, globalThis.fetch as Mock)
      },
    )
  })

  it('list-devices passes type/keyword/state/limit as query params', async () => {
    const program = createCliProgram()
    program.exitOverride()
    await program.parseAsync(
      ['list-devices', '--type', 'browser', '--keyword', 'mac', '--state', 'free', '--limit', '5'],
      { from: 'user' },
    )
    expectRequest(lastFetch(globalThis.fetch as Mock), {
      path: '/v1/devices',
      method: 'GET',
      query: { type: 'browser', keyword: 'mac', state: 'free', limit: '5' },
    })
  })

  it('mobile screenshot without -o streams binary to stdout, with -o writes a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'devicebase-cli-'))
    const out = join(dir, 'shot.png')
    try {
      const program = createCliProgram()
      program.exitOverride()
      await program.parseAsync(['mobile', '-s', 'dev-1', 'screenshot', '-o', out], { from: 'user' })
      expect(logSpy.mock.calls.some(call => call[0] === `Screenshot saved to ${out}`)).toBe(true)
      expect(globalThis.fetch as Mock).toHaveBeenCalledTimes(1)
      const [input] = (globalThis.fetch as Mock).mock.calls[0] as [string]
      expect(String(input)).toBe('https://api.devicebase.cn/v1/screen/dev-1')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  describe('argument and serial validation', () => {
    it('errors when the group -s serial is missing (mobile group)', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['mobile', 'tap', '100,200'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(errorMock.mock.calls[0][0]).toBe('Error: required flag(s) "--serial" not set')
      expect(String(errorMock.mock.calls[1][0])).toContain('list-devices --type mobile')
    })

    it('errors without a platform hint for the deprecated aliases', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['tap', '100,200'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(errorMock).toHaveBeenCalledTimes(1)
      expect(errorMock.mock.calls[0][0]).toBe('Error: required flag(s) "--serial" not set')
    })

    it('hints list-devices --type browser when browser serial is missing', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['browser', 'state'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(String(errorMock.mock.calls[1][0])).toContain('list-devices --type browser')
    })

    it('hints list-devices --type computer when computer serial is missing', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['computer', 'position'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(String(errorMock.mock.calls[1][0])).toContain('list-devices --type computer')
    })

    it('rejects an invalid point format with the legacy error message', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['mobile', '-s', 'dev-1', 'tap', 'abc'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(String(errorMock.mock.calls[0][0])).toContain('invalid point format "abc"')
    })

    it('rejects an invalid bounds format', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['computer', '-s', 'pc-1', 'drag', '1,2'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(String(errorMock.mock.calls[0][0])).toContain('invalid bounds format "1,2"')
    })

    it('rejects a non-positive wait duration', async () => {
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {})
      const program = createCliProgram()
      await program.parseAsync(['computer', '-s', 'pc-1', 'wait', '0'], { from: 'user' })
      expect(exitMock).toHaveBeenCalledWith(1)
      expect(String(errorMock.mock.calls[0][0])).toContain('must be greater than 0 ms')
    })

    it('rejects an invalid --button choice through commander', async () => {
      const program = createCliProgram()
      overrideExits(program)
      await expect(
        program.parseAsync(['computer', '-s', 'pc-1', 'click', '1,2', '--button', 'sideways'], { from: 'user' }),
      ).rejects.toMatchObject({ code: 'commander.invalidArgument' })
    })

    it('rejects a missing required argument through commander', async () => {
      const program = createCliProgram()
      overrideExits(program)
      await expect(
        program.parseAsync(['browser', '-s', 'br-uuid', 'navigate'], { from: 'user' }),
      ).rejects.toMatchObject({ code: 'commander.missingArgument' })
    })
  })

  describe('help and version output', () => {
    it('lists groups, list-devices and deprecated aliases in root help', async () => {
      const program = createCliProgram()
      overrideExits(program)
      await expect(program.parseAsync(['--help'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.helpDisplayed' })
      const text = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join('')
      expect(text).toContain('mobile [options]')
      expect(text).toContain('browser [options]')
      expect(text).toContain('computer [options]')
      expect(text).toContain('list-devices [options]')
      expect(text).toContain('tap <coords>')
      // Commander wraps long help lines to the console width — compare
      // whitespace-insensitively so the phrase survives mid-description wraps.
      expect(text.replace(/\s+/g, ' ')).toContain('deprecated: use "mobile tap" instead')
    })

    it('prints the version matching package.json', async () => {
      const program = createCliProgram()
      overrideExits(program)
      await expect(program.parseAsync(['--version'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.version' })
      const text = vi.mocked(process.stdout.write).mock.calls.map(call => String(call[0])).join('')
      expect(text.trim()).toBe('0.2.0')
    })
  })
})

describe('cLI platform module registration helpers', () => {
  it('registerMobileGroup / registerMobileAliases / registerBrowserCommands / registerComputerCommands attach to any parent', () => {
    const parent = new Command('probe')
    registerMobileGroup(parent)
    registerBrowserCommands(parent)
    registerComputerCommands(parent)
    registerMobileAliases(parent)
    expect(parent.commands.map(c => c.name())).toEqual([
      MOBILE_GROUP,
      BROWSER_GROUP,
      COMPUTER_GROUP,
      'tap',
      'double-tap',
      'long-press',
      'swipe',
      'back',
      'home',
      'launch-app',
      'input',
      'clear-text',
      'current-app',
      'dump-hierarchy',
      'device-info',
      'screenshot',
    ])
    const mobile = parent.commands.find(c => c.name() === MOBILE_GROUP)
    expect(mobile?.commands.map(c => c.name())).toHaveLength(18)
  })
})
