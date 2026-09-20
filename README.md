# Devicebase

[![npm version](https://img.shields.io/npm/v/devicebase.svg)](https://www.npmjs.com/package/devicebase)

JavaScript/TypeScript SDK & CLI for [DeviceBase](https://github.com/devicebase) — remote device automation across three device platforms: **mobile** (Android / HarmonyOS / iOS), **browser** (Chrome/Chromium/Edge over CDP) and **computer** (macOS / Windows / Linux desktops).

## Features

- **CLI** — three-platform command tree, matching the Go [`devicebase-cli`](https://github.com/devicebase/devicebase-cli) behaviour
- **SDK** — typed TypeScript client, one method per endpoint across all three platforms
- **WebSocket** — real-time screen streaming (Minicap) and touch control (Minitouch)

## Requirements

- Node.js >= 18.0.0 (native `fetch` and `WebSocket`)

## Installation

### As a CLI tool

Recommended — run directly with `npx` (no install needed):

```bash
npx devicebase
```

Or install globally:

```bash
npm install -g devicebase
```

### As an SDK dependency

```bash
npm install devicebase
```

## Environment Variables

Both are read on every invocation:

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DEVICEBASE_API_KEY` | yes | Bearer token. The CLI exits immediately if unset. |
| `DEVICEBASE_BASE_URL` | no | API base URL. Defaults to `https://api.devicebase.cn`. |

```bash
export DEVICEBASE_API_KEY=your_api_key
export DEVICEBASE_BASE_URL=https://api.devicebase.cn  # optional
```

## CLI Usage

### Command tree

```text
devicebase
├── list-devices                 # device discovery (no -s required)
├── mobile ...                   # Android / HarmonyOS / iOS  — /v1/{action}/{serialno}
├── browser ...                  # Chrome / Chromium / Edge   — /api/browser/{serialno}/{action}
└── computer ...                 # Desktop                    — /api/computer/{serialno}/{action}
```

Run `--help` at any level for full usage, e.g. `npx devicebase --help`, `npx devicebase mobile --help`, or `npx devicebase computer click --help`.

### Selecting a device (`-s, --serialno`)

Each platform group declares its own `-s, --serialno`, and the root declares one too — both bind the same value, so either position works:

```bash
npx devicebase mobile -s <serialno> tap 100,200    # group flag
npx devicebase -s <serialno> mobile tap 100,200    # root flag
```

The `serialno` value means different things per platform. A missing `-s` reports an error plus a hint pointing at the matching `list-devices` query:

```text
Error: required flag(s) "--serialno" not set
HINT: find a browser device to control first: devicebase list-devices --type browser
```

| Group      | `-s, --serialno` value              | How to find it                                |
| ---------- | ----------------------------------- | --------------------------------------------- |
| `mobile`   | Mobile device serial number         | `npx devicebase list-devices --type mobile`   |
| `browser`  | Registered browser device serialno  | `npx devicebase list-devices --type browser`  |
| `computer` | Registered computer device serialno | `npx devicebase list-devices --type computer` |

The `serialno` is the device's `serialno` field (e.g. `db-mttul4i41di8`). The `device_sn` UUID resolves too — the gateway looks devices up with `WHERE (serialno = ? OR device_sn = ?)`.

### Device Management

```bash
# List all devices
npx devicebase list-devices

# Filter by keyword (name/alias/brand/model/serialno/device_sn/type/os_type/os_version/location/operator)
npx devicebase list-devices --keyword "iPhone"

# Filter by state (busy/free/offline)
npx devicebase list-devices --state free

# Filter by category — bucket semantics are handled server-side
npx devicebase list-devices --type mobile      # adb | hdc | ios
npx devicebase list-devices --type browser
npx devicebase list-devices --type computer

# Filter by system type
npx devicebase list-devices --type android
npx devicebase list-devices --type chrome      # browser with os_type ~ Chrome

# Combine filters
npx devicebase list-devices --type mobile --keyword "Samsung" --state busy
npx devicebase list-devices --limit 50
```

| Option            | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `--type <type>`   | Category (`mobile`/`browser`/`computer`) or system type (`android`/`harmonyos`/`ios`/`macos`/`windows`/`linux`/`chrome`/`chromium`/`edge`/`other`) |
| `--keyword <kw>`  | Case-insensitive substring match across name/alias_name/brand/model/serialno/device_sn/type/os_type/os_version/location/operator |
| `--state <state>` | `busy` / `free` / `offline`                                                                                  |
| `--limit <n>`     | Maximum number of devices to return (default: `10`)                                                           |

`--limit` is the one filter here that the Go CLI does not expose — the `/v1/devices` route honours it, so it is kept.

System types are matched against `os_type`, not the device row's `type` — a device only carries the coarse type, so a Chrome browser is `type=browser` with `os_type=Chrome`. Two are defined by exclusion: `linux` is every computer that is neither macOS nor Windows (Deepin/UOS/Kylin and unknown systems included), and `other` is every browser that is not Chrome/Chromium/Edge. Values outside the list fall back to an exact match on `type`.

### Mobile platform (`npx devicebase mobile -s <serialno> …`)

Serial: mobile device serial (adb/hdc/ios). Endpoints: `POST/GET /v1/{action}/{serialno}`. Coordinates keep the original CLI's style: points as `x,y`, bounds as `x1,y1,x2,y2`.

| Command | Description |
| ------- | ----------- |
| `tap <x,y>` | Single tap |
| `double-tap <x,y>` | Double tap |
| `long-press <x,y>` | Long press |
| `swipe <x1,y1,x2,y2>` | Swipe gesture |
| `back` | Press the back button |
| `home` | Press the home button |
| `launch-app <app>` | Launch an app by name/package |
| `stop-app <app>` | Stop an app |
| `stop-current-app` | Stop the foreground app |
| `bash <command>` | Run a shell command (adb/hdc only) |
| `input [text]` | Type text into the focused field (reads stdin when omitted) |
| `clear-text` | Clear the focused text field |
| `current-app` | Get the foreground app |
| `dump-hierarchy` | Dump the UI hierarchy (JSON) |
| `device-info` | Get device information |
| `install-app <app_path>` | Install APK/HAP/IPA from an agent-host path (returns an `install_id`) |
| `install-status <install_id>` | Query a background install task |
| `screenshot [-o file]` | Capture the screen (stdout or `-o file`) |

```bash
npx devicebase mobile -s <serialno> tap 100,200
npx devicebase mobile -s <serialno> swipe 100,200,300,400
npx devicebase mobile -s <serialno> install-app /tmp/app.apk
npx devicebase mobile -s <serialno> install-status <install_id>
npx devicebase mobile -s <serialno> screenshot -o screen.jpg

# input reads stdin when no argument is given (keeps secrets out of shell history)
echo "hello 世界" | npx devicebase mobile -s <serialno> input
```

### Browser platform (`npx devicebase browser -s <serialno> …`)

Serial: the browser device's `serialno` from `list-devices --type browser`. Endpoints: `POST/GET /api/browser/{serialno}/{action...}`. Selectors are CSS selectors.

| Command | Description |
| ------- | ----------- |
| `navigate <url>` | Navigate the current tab |
| `refresh` | Reload the current page |
| `go-back` | History back |
| `go-forward` | History forward |
| `input [text]` | Insert text into the focused element (`Input.insertText`, reliable for CJK) |
| `click <selector>` | Click an element |
| `fill <selector> <text>` | Clear + type into an input |
| `select <selector> <value>` | Pick an option in a dropdown |
| `text <selector>` | Get an element's text content |
| `attribute <selector> <name>` | Get an element attribute |
| `exists <selector>` | Check element existence |
| `execute <js>` | Evaluate JavaScript in the page (danger tier, same as shell access) |
| `hotkey <keys...>` | Press keys together. Editing shortcuts act on the page (e.g. `hotkey Meta a` selects all); browser-chrome shortcuts like `Control t` are **not** reachable over CDP |
| `state` | URL / title / viewport / tab count |
| `tabs` | List open tabs |
| `tab-open <url>` | Open a new tab |
| `tab-close <id>` | Close a tab |
| `tab-close-all` | Close every tab |
| `tab-switch <id>` | Focus a tab |
| `launch` | Launch/start the browser (CDP) |
| `close` | Close/stop the browser (CDP) |
| `screenshot [-o file]` | Capture the browser viewport (see note) |

```bash
npx devicebase browser -s <serialno> navigate https://example.com
npx devicebase browser -s <serialno> click "button#submit"
npx devicebase browser -s <serialno> fill "#search" "devicebase"
npx devicebase browser -s <serialno> text "#search"
npx devicebase browser -s <serialno> tabs
npx devicebase browser -s <serialno> execute "document.title"
```

### Computer platform (`npx devicebase computer -s <serialno> …`)

Serial: the computer device's `serialno` from `list-devices --type computer`. Endpoints: `POST/GET /api/computer/{serialno}/{action}`. Coordinates are absolute screen pixels (`x,y` / `x1,y1,x2,y2`).

| Command | Description |
| ------- | ----------- |
| `click <x,y> [--button left\|right\|middle]` | Click (button omitted → server default `left`) |
| `double-click <x,y>` | Double click |
| `long-click <x,y> [--seconds N]` | Press and hold (N seconds, 1-60) |
| `move <x,y>` | Move the mouse |
| `drag <x1,y1,x2,y2>` | Click-drag between two points |
| `scroll <up\|down\|left\|right> [--amount N]` | Mouse-wheel scroll |
| `type-text <text>` | Type text at the caret |
| `press <key>` | Press a key (e.g. `Enter`, `F5`) |
| `hotkey <keys...>` | Key combination |
| `position` | Current mouse position |
| `screen-size` | Primary screen size |
| `permissions` | Desktop-control permission status |
| `launch-app <app>` | Launch a desktop app |
| `wait <ms>` | Sleep (1-300000 ms) — for agent scripts |
| `bash <command> [--timeout N]` | Run a shell command on the host machine (danger tier — see note) |
| `screenshot [-o file]` | Capture the desktop (see note) |

```bash
npx devicebase computer -s <serialno> click 640,360
npx devicebase computer -s <serialno> click 640,360 --button right
npx devicebase computer -s <serialno> drag 100,100,800,600
npx devicebase computer -s <serialno> scroll down --amount 5
npx devicebase computer -s <serialno> type-text "hello"
npx devicebase computer -s <serialno> hotkey Control Shift Escape
npx devicebase computer -s <serialno> wait 2000
npx devicebase computer -s <serialno> bash "ls && echo ok"
```

`bash` (**danger tier**) runs arbitrary commands on the host machine as the desktop user, under the platform default shell (`/bin/sh` on macOS/Linux, `cmd.exe` on Windows), so bash-only syntax such as `[[ ]]` may not work. Quote the command so the CLI does not parse its flags. `--timeout` is in **seconds** (default 120) — note that `wait` takes **milliseconds**. A non-zero command exit is reported in `data.exitCode`; the CLI still exits `0` because the API call succeeded.

### Screenshot (cross-family)

`screenshot` is the one **cross-family** command: it does not live under `/api/browser/*` or `/api/computer/*`. The server dispatches `POST /v1/screen/{serialno}` by device type — computer → full-desktop capture, browser → CDP capture, otherwise the device image queue — so one command serves every platform and is registered in each group so `--help` surfaces it.

The image is written to stdout by default, or to `-o <file>`. The **server** decides the format (JPEG), independently of the output file name, so a `.png` target still receives JPEG bytes; that contradiction is reported on stderr:

```text
Screenshot saved to shot.png
Warning: shot.png has a .png extension but the server returned JPEG data
```

### Output and exit codes

Successful commands print the server's JSON envelope to **stdout** and exit `0`:

```json
{ "code": 200, "message": "success", "data": { "width": 1470, "height": 956 }, "timestamp": "2026-09-20 03:21:06" }
```

Failures print `Error: …` to **stderr** and exit `1`. Two distinct error layers are surfaced:

| Layer | Shape | Example |
| ----- | ----- | ------- |
| Gateway (HTTP status is non-2xx) | `API error (HTTP <code>): <body>` | `API error (HTTP 404): {"code":404,"message":"设备不存在: nope"}` |
| Business (HTTP 200, non-2xx `code` in the envelope) | `API error (code <n>): <body>` | `API error (code 502): {"code":502,"message":"Element not found: #x"}` |

The second layer matters for automation: the control API reports action failures inside an otherwise successful response, so guarding on the HTTP status alone would treat a failed action as success. `npx devicebase … && next_step` is safe.

### Migrating from the old flat commands

The original flat top-level commands have been **removed**, under a `mobile` group. Each maps 1:1, so a script only needs `mobile` inserted after `devicebase`:

| Removed | Replacement |
| ------- | ----------- |
| `npx devicebase -s X tap 100,200` | `npx devicebase mobile -s X tap 100,200` |
| `npx devicebase -s X swipe 1,2,3,4` | `npx devicebase mobile -s X swipe 1,2,3,4` |
| `npx devicebase -s X screenshot -o s.jpg` | `npx devicebase mobile -s X screenshot -o s.jpg` |

The full removed set: `tap`, `double-tap`, `long-press`, `swipe`, `back`, `home`, `launch-app`, `input`, `clear-text`, `current-app`, `dump-hierarchy`, `screenshot`, `device-info` — all of them exist in the `mobile` group, which also adds `stop-app`, `stop-current-app`, `bash`, `install-app` and `install-status`.

## SDK Usage

### Mobile — `DeviceBaseClient`

A serial-bound facade for one mobile device:

```typescript
import { DeviceBaseClient } from 'devicebase'

const client = new DeviceBaseClient({
  apiKey: 'your-api-key',
  serial: 'device-serial-number',
})

const deviceInfo = await client.getDeviceInfo()
const screenshot = await client.getScreenshot()

await client.tap(100, 200)
await client.swipe(100, 500, 100, 100)
await client.back()
await client.launchApp('com.tencent.mm')
await client.inputText('hello world')
await client.dumpHierarchy()
```

### Browser and computer — `DeviceBaseHttpClient`

For the browser and computer platforms a "device" is a registered endpoint rather than a phone, so `DeviceBaseHttpClient` takes the serialno per call:

```typescript
import { DeviceBaseHttpClient } from 'devicebase'

const client = new DeviceBaseHttpClient({ apiKey: 'your-api-key' })

// Browser (serialno from listDevices({ type: 'browser' }))
await client.browserNavigate('db-mtsi49bf0mqb', 'https://example.com')
await client.browserClick('db-mtsi49bf0mqb', 'button#submit')
const text = await client.browserText('db-mtsi49bf0mqb', '.title')

// Computer (serialno from listDevices({ type: 'computer' }))
await client.computerClick('db-mtthisv311f1', { x: 640, y: 360, button: 'right' })
await client.computerTypeText('db-mtthisv311f1', 'hello')
const pos = await client.computerPosition('db-mtthisv311f1')

// Discovery
const { data } = await client.listDevices({ type: 'browser', state: 'free' })
```

## API Reference

### `DeviceBaseHttpClient`

Every method takes the device serialno first. Grouped by platform:

| Platform | Methods |
| -------- | ------- |
| Device | `listDevices({ keyword?, state?, type?, limit? })` |
| Mobile | `getDeviceInfo`, `tap`, `doubleTap`, `longPress`, `swipe`, `back`, `home`, `launchApp`, `stopApp`, `stopCurrentApp`, `getCurrentApp`, `inputText`, `clearText`, `bash`, `dumpHierarchy`, `installApp`, `installStatus`, `getScreenshot` |
| Browser | `browserNavigate`, `browserRefresh`, `browserGoBack`, `browserGoForward`, `browserInput`, `browserClick`, `browserFill`, `browserSelect`, `browserText`, `browserAttribute`, `browserExists`, `browserExecute`, `browserHotkey`, `browserState`, `browserTabs`, `browserTabOpen`, `browserTabClose`, `browserTabCloseAll`, `browserTabSwitch`, `browserLaunch`, `browserClose` |
| Computer | `computerClick`, `computerDoubleClick`, `computerLongClick`, `computerMove`, `computerDrag`, `computerScroll`, `computerTypeText`, `computerPress`, `computerHotkey`, `computerPosition`, `computerScreenSize`, `computerPermissions`, `computerLaunchApp`, `computerWait`, `computerBash` |

`computerWait` takes **milliseconds** and `computerBash` takes a timeout in **seconds**; both widen the HTTP deadline to cover the block, so a long action is not aborted client-side.

### `DeviceBaseClient`

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `getDeviceInfo()` | `Promise<DeviceInfo>` | Device status and hardware info |
| `tap(x, y)` | `Promise<OperationResult>` | Single tap at coordinates |
| `doubleTap(x, y)` | `Promise<OperationResult>` | Double tap at coordinates |
| `longPress(x, y)` | `Promise<OperationResult>` | Long press at coordinates |
| `swipe(x1, y1, x2, y2)` | `Promise<OperationResult>` | Swipe gesture |
| `back()` | `Promise<OperationResult>` | Press back button |
| `home()` | `Promise<OperationResult>` | Press home button |
| `launchApp(appName)` | `Promise<OperationResult>` | Launch app by package name |
| `stopApp(appName)` | `Promise<OperationResult>` | Stop an app |
| `stopCurrentApp()` | `Promise<OperationResult>` | Stop the foreground app |
| `getCurrentApp()` | `Promise<AppInfo>` | Foreground app info |
| `inputText(text)` | `Promise<OperationResult>` | Type text into the focused field |
| `clearText()` | `Promise<OperationResult>` | Clear the focused field |
| `bash(command)` | `Promise<OperationResult>` | Shell command on the device (adb/hdc only) |
| `dumpHierarchy()` | `Promise<HierarchyInfo>` | UI element tree |
| `installApp(appPath)` | `Promise<OperationResult>` | Install a package from an agent-host path |
| `installStatus(installId)` | `Promise<OperationResult>` | Query a background install |
| `getScreenshot()` | `Promise<ArrayBuffer>` | Screenshot bytes (JPEG) |
| `minicapClient()` | `MinicapClient` | Screen streaming WebSocket client |
| `minitouchClient()` | `MinitouchClient` | Touch control WebSocket client |
| `streamMinicap()` | `AsyncGenerator<Buffer>` | Stream JPEG frames |

### Errors

All API failures throw a subclass of `DeviceBaseError`, carrying `statusCode` (HTTP layer) or `code` (envelope layer):

| Class | Raised on |
| ----- | --------- |
| `AuthenticationError` | Missing API key, or HTTP 401 |
| `DeviceNotFoundError` | HTTP 404 |
| `ValidationError` | HTTP 422 |
| `DeviceBaseError` | Any other non-2xx status, or a non-2xx envelope `code` on an HTTP 200 |

### Configuration

```typescript
const client = new DeviceBaseClient({
  serial: 'device-serial', // Required: device serial number
  apiKey: 'your-api-key', // Optional: defaults to DEVICEBASE_API_KEY
  baseUrl: 'https://api.devicebase.cn', // Optional: API base URL
  timeout: 30000, // Optional: request timeout in ms (default: 30000)
})
```

## WebSocket Streaming

### Screen Streaming (Minicap)

```typescript
const minicap = client.minicapClient()

for await (const frame of minicap.streamFrames()) {
  // frame is a Buffer containing JPEG image data
  console.log('Frame:', frame.length, 'bytes')
}

// Or use the convenience method:
for await (const frame of client.streamMinicap()) {
  console.log('Frame:', frame.length, 'bytes')
}
```

### Touch Control (Minitouch)

```typescript
const minitouch = client.minitouchClient()
await minitouch.connect()

await minitouch.tap(100, 200)
await minitouch.swipe(100, 500, 100, 100, 300, 10)

// Low-level touch events
await minitouch.touchDown(0, 100, 200)
await minitouch.commit()
await minitouch.touchUp(0)
await minitouch.commit()

await minitouch.close()
```

## Development

```bash
pnpm install

pnpm dev:bin        # run the CLI from source
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm build:all      # SDK + CLI bundles
```

The HTTP contract (method, path, body and query fields) is fixed by the TestClaw service routes — `control.ts` / `device.ts` / `screen.ts` for mobile, `browser-control.ts`, `computer-control.ts`. It is defined once in [`src/api/`](./src/api) and consumed by the CLI, so a route change is a single edit.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup and contribution workflow.

## License

MIT
