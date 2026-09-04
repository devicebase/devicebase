# Devicebase

[![npm version](https://img.shields.io/npm/v/devicebase.svg)](https://www.npmjs.com/package/devicebase)

JavaScript/TypeScript SDK & CLI for [DeviceBase](https://github.com/devicebase) — remote Android, HarmonyOS, and iOS device automation via HTTP API.

## Features

- **CLI** — Cross-platform command-line tool for device control
- **SDK** — Full-featured TypeScript client for programmatic device automation
- **WebSocket** — Real-time screen streaming (Minicap) and touch control (Minitouch)

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

## CLI Usage

Set environment variables before using the CLI:

```bash
export DEVICEBASE_API_KEY=your_api_key
export DEVICEBASE_BASE_URL=https://api.devicebase.cn  # optional, defaults to this
```

The CLI is organized as one common top-level command plus three platform command groups:

```text
devicebase
├── list-devices      Common: list and search devices (the only top-level command)
├── mobile ...        Mobile devices: Android / HarmonyOS / iOS (via the /v1 open API)
├── browser ...       Browser devices (via /api/browser/{serial})
├── computer ...      Computer devices (via /api/computer/{serial})
└── tap, double-tap, ...  Deprecated top-level aliases of the old flat CLI
```

Run `--help` at any level for full usage, e.g. `npx devicebase --help`, `npx devicebase mobile --help`, or `npx devicebase computer click --help`.

### Selecting a device (`-s, --serial`)

Every device command targets one device, identified through its platform group's `-s, --serial` option. Place it right after the group name:

```bash
npx devicebase mobile -s <serial> tap 100,200
```

The `serial` value means different things per platform — see the table below. When `-s` is missing, the CLI prints an error plus a hint pointing at the matching `list-devices` query:

```text
Error: required flag(s) "--serial" not set
Hint: run "devicebase list-devices --type mobile" to find the target mobile device serial
```

| Group      | `-s, --serial` value                     | How to find it                                      |
| ---------- | ---------------------------------------- | --------------------------------------------------- |
| `mobile`   | Mobile device serial number              | `npx devicebase list-devices --type mobile`         |
| `browser`  | Registered browser device UUID           | `npx devicebase list-devices --type browser`        |
| `computer` | Registered computer device id            | `npx devicebase list-devices --type computer`       |

A root-level `-s, --serial` still exists on `devicebase`, but only for the deprecated top-level aliases (see below).

### Device Management

```bash
# List devices (default limit: 10)
npx devicebase list-devices

# Filter by platform type: mobile|browser|computer|adb|hdc|ios
npx devicebase list-devices --type mobile
npx devicebase list-devices --type browser

# Filter by keyword (brand/model/serial/name)
npx devicebase list-devices --keyword "iPhone"

# Filter by state (busy/free/offline)
npx devicebase list-devices --state free

# Combine filters with limit
npx devicebase list-devices --type adb --keyword "Samsung" --state busy --limit 20
```

| Option            | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `--type <type>`   | Filter by platform type: `mobile\|browser\|computer\|adb\|hdc\|ios` |
| `--keyword <kw>`  | Filter by keyword (brand/model/serial/name)             |
| `--state <state>` | Filter by state (`busy`/`free`/`offline`)               |
| `--limit <n>`     | Maximum number of devices to return (default: `10`)     |

### Mobile Devices (`mobile`)

Controls an Android / HarmonyOS / iOS device through the `/v1` open API. All actions print the API's JSON reply as a single line; errors go to stderr.

| Command            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `tap <coords>`     | Tap on the device screen (`x,y`)                             |
| `double-tap <coords>` | Double tap on the device screen (`x,y`)                   |
| `long-press <coords>` | Long press on the device screen (`x,y`)                   |
| `swipe <coords>`   | Swipe on the device screen (`x1,y1,x2,y2`)                   |
| `back`             | Press the back button                                        |
| `home`             | Press the home button                                        |
| `launch-app <app>` | Launch an application by package/bundle name                 |
| `input <text>`     | Input text on the device                                     |
| `clear-text`       | Clear text in the current input field                        |
| `current-app`      | Get the current foreground app                               |
| `dump-hierarchy`   | Dump the UI hierarchy                                        |
| `device-info`      | Get device information                                       |
| `screenshot`       | Take a screenshot of the device (`-o, --output <file>` saves to a file; default: raw JPEG to stdout) |
| `stop-app <app>`   | Stop an application by package/bundle name                   |
| `stop-current-app` | Stop the current foreground app                              |
| `bash <command>`   | Execute a shell command on the device (adb/hdc only)         |
| `install-app <app_path>` | Install an app from a file path on the agent host       |
| `install-status <install_id>` | Query the status of a background app install         |

```bash
# Tap at coordinates, then take a screenshot into a file
npx devicebase mobile -s <serial> tap 100,200
# {"success":true,"data":{...}}     <- JSON reply from the API (single line)

npx devicebase mobile -s <serial> screenshot -o screen.jpg
# Screenshot saved to screen.jpg

# Launch an app and dump the UI hierarchy
npx devicebase mobile -s <serial> launch-app com.example.app
npx devicebase mobile -s <serial> dump-hierarchy
# {"success":true,"data":{...}}     <- UI tree as JSON
```

### Browser Devices (`browser`)

Controls a browser device through `/api/browser/{serial}`, where `serial` is the registered browser device UUID (find it with `npx devicebase list-devices --type browser`). Selectors are CSS selectors. Reads (`text`, `attribute`, `exists`, `state`, `tabs`) print the API's JSON reply; actions do the same.

| Command                 | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `navigate <url>`        | Navigate to a URL                                                 |
| `refresh`               | Refresh the current page                                          |
| `go-back`               | Go back in history                                                |
| `go-forward`            | Go forward in history                                             |
| `input <text>`          | Insert text into the focused element                              |
| `click <selector>`      | Click the element matching the CSS selector                       |
| `fill <selector> <text>` | Fill the element matching the CSS selector with text            |
| `select <selector> <value>` | Select an option in the element matching the CSS selector    |
| `text <selector>`       | Get the text of the element matching the CSS selector             |
| `attribute <selector> <name>` | Get an attribute value of the element matching the CSS selector |
| `exists <selector>`     | Check whether an element matching the CSS selector exists         |
| `execute <js>`          | Execute a JavaScript snippet in the page                          |
| `hotkey <keys...>`      | Send a keyboard shortcut, e.g. `hotkey ctrl shift t`              |
| `state`                 | Get the browser state (url, title, viewport, tab count)           |
| `tabs`                  | List the open tabs                                                |
| `tab-open <url>`        | Open a new tab with the given URL                                 |
| `tab-close <id>`        | Close the tab with the given id                                   |
| `tab-close-all`         | Close all tabs (a fresh blank tab is left open)                   |
| `tab-switch <id>`       | Switch to the tab with the given id                               |
| `launch`                | Launch (start) the browser instance                               |
| `close`                 | Close the browser instance                                        |

```bash
# Open a page, fill a form field, then read it back
npx devicebase browser -s <uuid> navigate https://example.com
npx devicebase browser -s <uuid> fill "#search" "devicebase"
npx devicebase browser -s <uuid> text "#search"
# {"success":true,"data":{...}}    <- element text as JSON

# Query the browser state and the open tabs
npx devicebase browser -s <uuid> state
# {"success":true,"data":{"url":"...","title":"...","viewport":{...},"tabCount":...}}
npx devicebase browser -s <uuid> tabs
```

### Computer Devices (`computer`)

Controls a computer device through `/api/computer/{serial}`, where `serial` is the registered computer device id (find it with `npx devicebase list-devices --type computer`). Coordinates are absolute screen pixels. All commands print the API's JSON reply.

| Command                    | Description                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `click <coords>`           | Click at coordinates (`x,y`; `--button left\|right\|middle`, default `left`) |
| `double-click <coords>`    | Double click at coordinates (`x,y`)                                |
| `long-click <coords>`      | Press and hold at coordinates (`x,y`; `--seconds <n>` hold duration) |
| `move <coords>`            | Move the mouse to coordinates (`x,y`)                              |
| `drag <coords>`            | Drag the mouse from `x1,y1` to `x2,y2`                             |
| `scroll <direction>`       | Scroll in a direction (`up\|down\|left\|right`; `--amount <n>`)    |
| `type-text <text>`         | Type text at the current caret position                            |
| `press <key>`              | Press a keyboard key                                               |
| `hotkey <keys...>`         | Send a keyboard shortcut, e.g. `hotkey ctrl shift s`               |
| `position`                 | Get the current mouse position                                     |
| `screen-size`              | Get the screen size                                                |
| `permissions`              | Get the accessibility/automation permission status                 |
| `launch-app <app>`         | Launch an application on the computer                              |
| `wait <ms>`                | Wait for a duration in milliseconds                                |

```bash
# Move the mouse, click with the right button, then type some text
npx devicebase computer -s <id> move 800,450
npx devicebase computer -s <id> click 800,450 --button right
npx devicebase computer -s <id> type-text "hello"
# {"success":true,"data":{...}}   <- JSON reply from the API (single line)

# Scroll and save with a keyboard shortcut
npx devicebase computer -s <id> scroll down --amount 3
npx devicebase computer -s <id> hotkey ctrl s
```

### Deprecated Top-Level Commands (legacy flat CLI)

The original flat CLI of earlier versions — `devicebase -s <serial> tap 100,200` and friends — still works unchanged, but every top-level action command is **deprecated**: its help text reads `(deprecated: use "mobile <name>" instead)`. Migrate to the `mobile` group (same behavior, group-level `-s`):

```bash
# Deprecated top-level aliases
npx devicebase -s <serial> tap 100,200
npx devicebase -s <serial> dump-hierarchy
npx devicebase -s <serial> screenshot -o screenshot.jpg

# Same actions via the mobile group
npx devicebase mobile -s <serial> tap 100,200
npx devicebase mobile -s <serial> dump-hierarchy
npx devicebase mobile -s <serial> screenshot -o screenshot.jpg
```

Deprecated aliases: `tap`, `double-tap`, `long-press`, `swipe`, `back`, `home`, `launch-app`, `input`, `clear-text`, `current-app`, `dump-hierarchy`, `device-info`, `screenshot`. They are the reason a root-level `-s, --serial` remains on `devicebase`.

The mobile commands `stop-app`, `stop-current-app`, `bash`, `install-app`, and `install-status` exist under the `mobile` group only and never had a top-level alias.

`npx devicebase --help` shows the command tree; `npx devicebase --version` prints the installed version.

## SDK Usage

```typescript
import { DeviceBaseClient } from 'devicebase'

const client = new DeviceBaseClient({
  apiKey: 'your-api-key',
  serial: 'device-serial-number',
})

// Get device info
const deviceInfo = await client.getDeviceInfo()

// Take a screenshot
const screenshot = await client.getScreenshot()

// Touch operations
await client.tap(100, 200)
await client.doubleTap(100, 200)
await client.longPress(100, 200)
await client.swipe(100, 500, 100, 100)

// Navigation
await client.back()
await client.home()

// Launch an app
await client.launchApp('com.tencent.mm')

// Text input
await client.inputText('hello world')
await client.clearText()

// Get current foreground app
const appInfo = await client.getCurrentApp()

// Dump UI hierarchy
const hierarchy = await client.dumpHierarchy()
```

## Configuration

```typescript
const client = new DeviceBaseClient({
  serial: 'device-serial', // Required: device serial number
  apiKey: 'your-api-key', // Optional: defaults to DEVICEBASE_API_KEY env var
  baseUrl: 'https://api.devicebase.cn', // Optional: API base URL
  timeout: 30000, // Optional: request timeout in ms (default: 30000)
})
```

Environment variables:

- `DEVICEBASE_API_KEY` — API key for authentication
- `DEVICEBASE_BASE_URL` — API base URL (default: `https://api.devicebase.cn`)

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

// Tap
await minitouch.tap(100, 200)

// Swipe with custom duration and steps
await minitouch.swipe(100, 500, 100, 100, 300, 10)

// Low-level touch events
await minitouch.touchDown(0, 100, 200)
await minitouch.commit()
await minitouch.touchUp(0)
await minitouch.commit()

await minitouch.close()
```

## API Reference

### `DeviceBaseClient`

| Method                  | Returns                    | Description                              |
| ----------------------- | -------------------------- | ---------------------------------------- |
| `getDeviceInfo()`       | `Promise<DeviceInfo>`      | Get device status and hardware info      |
| `tap(x, y)`             | `Promise<OperationResult>` | Single tap at coordinates                |
| `doubleTap(x, y)`       | `Promise<OperationResult>` | Double tap at coordinates                |
| `longPress(x, y)`       | `Promise<OperationResult>` | Long press at coordinates                |
| `swipe(x1, y1, x2, y2)` | `Promise<OperationResult>` | Swipe gesture                            |
| `back()`                | `Promise<OperationResult>` | Press back button                        |
| `home()`                | `Promise<OperationResult>` | Press home button                        |
| `launchApp(appName)`    | `Promise<OperationResult>` | Launch app by package name               |
| `getCurrentApp()`       | `Promise<AppInfo>`         | Get foreground app info                  |
| `inputText(text)`       | `Promise<OperationResult>` | Type text into focused field             |
| `clearText()`           | `Promise<OperationResult>` | Clear text in focused field              |
| `dumpHierarchy()`       | `Promise<HierarchyInfo>`   | Get UI element tree                      |
| `getScreenshot()`       | `Promise<ArrayBuffer>`     | Screenshot as JPEG bytes                 |
| `downloadScreenshot()`  | `Promise<ArrayBuffer>`     | Download screenshot as attachment        |
| `minicapClient()`       | `MinicapClient`            | Create screen streaming WebSocket client |
| `minitouchClient()`     | `MinitouchClient`          | Create touch control WebSocket client    |
| `streamMinicap()`       | `AsyncGenerator<Buffer>`   | Stream JPEG frames                       |

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution workflow.

## License

MIT
