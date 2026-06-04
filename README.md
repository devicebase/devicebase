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

### As a CLI tool (global install)

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

Most commands require the `-s <serial>` flag to specify the target device. The `list-devices` command is an exception.

### Device Management

```bash
# List all devices (no -s flag required)
devicebase list-devices

# Filter by keyword (brand/model/serial/name)
devicebase list-devices --keyword "iPhone"

# Filter by state (busy/free/offline)
devicebase list-devices --state free

# Combine filters with limit
devicebase list-devices --keyword "Samsung" --state busy --limit 20
```

### Touch Interactions

```bash
# Tap at coordinates
devicebase -s <serial> tap 100,200

# Double tap
devicebase -s <serial> double-tap 100,200

# Long press
devicebase -s <serial> long-press 100,200

# Swipe from (x1,y1) to (x2,y2)
devicebase -s <serial> swipe 100,200,300,400
```

### Navigation

```bash
# Press back button
devicebase -s <serial> back

# Press home button
devicebase -s <serial> home
```

### App Management

```bash
# Launch an app by name
devicebase -s <serial> launch-app com.example.app

# Get the current foreground app
devicebase -s <serial> current-app
```

### Text Input

```bash
# Input text
devicebase -s <serial> input "Hello World"

# Clear text field
devicebase -s <serial> clear-text
```

### Device Information

```bash
# Get device info
devicebase -s <serial> device-info

# Dump UI hierarchy (accessibility tree)
devicebase -s <serial> dump-hierarchy

# Take a screenshot (outputs to stdout)
devicebase -s <serial> screenshot

# Save screenshot to a file
devicebase -s <serial> screenshot -o screenshot.jpg
```

### Global Flags

| Flag        | Short | Description          |
| ----------- | ----- | -------------------- |
| `--serial`  | `-s`  | Device serial number |
| `--help`    | `-h`  | Show help            |
| `--version` |       | Show version         |

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

| Method | Returns | Description |
|--------|---------|-------------|
| `getDeviceInfo()` | `Promise<DeviceInfo>` | Get device status and hardware info |
| `tap(x, y)` | `Promise<OperationResult>` | Single tap at coordinates |
| `doubleTap(x, y)` | `Promise<OperationResult>` | Double tap at coordinates |
| `longPress(x, y)` | `Promise<OperationResult>` | Long press at coordinates |
| `swipe(x1, y1, x2, y2)` | `Promise<OperationResult>` | Swipe gesture |
| `back()` | `Promise<OperationResult>` | Press back button |
| `home()` | `Promise<OperationResult>` | Press home button |
| `launchApp(appName)` | `Promise<OperationResult>` | Launch app by package name |
| `getCurrentApp()` | `Promise<AppInfo>` | Get foreground app info |
| `inputText(text)` | `Promise<OperationResult>` | Type text into focused field |
| `clearText()` | `Promise<OperationResult>` | Clear text in focused field |
| `dumpHierarchy()` | `Promise<HierarchyInfo>` | Get UI element tree |
| `getScreenshot()` | `Promise<ArrayBuffer>` | Screenshot as JPEG bytes |
| `downloadScreenshot()` | `Promise<ArrayBuffer>` | Download screenshot as attachment |
| `minicapClient()` | `MinicapClient` | Create screen streaming WebSocket client |
| `minitouchClient()` | `MinitouchClient` | Create touch control WebSocket client |
| `streamMinicap()` | `AsyncGenerator<Buffer>` | Stream JPEG frames |

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution workflow.

## License

MIT
