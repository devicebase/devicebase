import { Buffer } from 'node:buffer'
import process from 'node:process'
import { AuthenticationError, DeviceBaseError } from './http-client.js'

const BANNER_SIZE = 24
const FRAME_HEADER_SIZE = 4

function toWsUrl(baseUrl: string): string {
  return baseUrl
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
}

export interface WebSocketClientConfig {
  baseUrl: string
  serial: string
  apiKey?: string
}

// --- MinicapClient ---

export class MinicapClient {
  private readonly url: string
  private readonly apiKey: string

  constructor(config: WebSocketClientConfig) {
    const apiKey = config.apiKey ?? process.env.DEVICEBASE_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via \'apiKey\' config or DEVICEBASE_API_KEY environment variable.',
      )
    }
    this.apiKey = apiKey
    this.url = `${toWsUrl(config.baseUrl)}/v1/minicap/${config.serial}`
  }

  async* streamFrames(): AsyncGenerator<Buffer> {
    const ws = new WebSocket(this.url, ['Bearer', this.apiKey])

    await waitForOpen(ws)

    try {
      // Read banner (24 bytes)
      const banner = await receiveBinary(ws, BANNER_SIZE)
      if (banner.length < BANNER_SIZE) {
        throw new DeviceBaseError('Invalid minicap banner received')
      }

      // Read frames continuously
      while (ws.readyState === WebSocket.OPEN) {
        try {
          const header = await receiveBinary(ws, FRAME_HEADER_SIZE)
          if (header.length < FRAME_HEADER_SIZE)
            continue

          const frameSize = header.readUInt32BE(0)
          const frameData = await receiveBinary(ws, frameSize)
          // Yield raw Uint8Array instead of Buffer.from() to maintain type compatibility
          // with Node 22's stricter generic ArrayBuffer constraints
          yield frameData.subarray(0, frameSize)
        }
        catch {
          break
        }
      }
    }
    finally {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
  }

  async captureFrame(): Promise<Buffer> {
    const iterator = this.streamFrames()
    const nextFrame = await iterator.next()
    if (!nextFrame.done)
      return nextFrame.value
    throw new DeviceBaseError('No frame received from stream')
  }
}

// --- MinitouchClient ---

export class MinitouchClient {
  private readonly url: string
  private readonly apiKey: string
  private ws: WebSocket | null = null

  constructor(config: WebSocketClientConfig) {
    const apiKey = config.apiKey ?? process.env.DEVICEBASE_API_KEY
    if (!apiKey) {
      throw new AuthenticationError(
        'API key is required. Provide it via \'apiKey\' config or DEVICEBASE_API_KEY environment variable.',
      )
    }
    this.apiKey = apiKey
    this.url = `${toWsUrl(config.baseUrl)}/v1/minitouch/${config.serial}`
  }

  async connect(): Promise<void> {
    if (this.ws)
      return

    const ws = new WebSocket(this.url, ['Bearer', this.apiKey])
    await waitForOpen(ws)
    this.ws = ws
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private ensureConnected(): WebSocket {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new DeviceBaseError('WebSocket not connected. Call connect() first.')
    }
    return this.ws
  }

  private async sendCommand(command: string): Promise<string> {
    const ws = this.ensureConnected()
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const text = typeof event.data === 'string'
          ? event.data
          : Buffer.from(event.data as ArrayBuffer).toString()
        resolve(text)
      }
      const onError = (err: Event) => {
        reject(new DeviceBaseError(`WebSocket error: ${String(err)}`))
      }
      ws.addEventListener('message', onMessage, { once: true })
      ws.addEventListener('error', onError, { once: true })
      ws.send(command)
    })
  }

  async touchDown(
    contactId: number,
    x: number,
    y: number,
    pressure = 50,
    width = 0,
    height = 0,
  ): Promise<string> {
    return this.sendCommand(`d ${contactId} ${x} ${y} ${pressure} ${width} ${height}\n`)
  }

  async touchMove(
    contactId: number,
    x: number,
    y: number,
    pressure = 50,
    width = 0,
    height = 0,
  ): Promise<string> {
    return this.sendCommand(`m ${contactId} ${x} ${y} ${pressure} ${width} ${height}\n`)
  }

  async touchUp(
    contactId: number,
    x = 0,
    y = 0,
    pressure = 0,
    width = 0,
    height = 0,
  ): Promise<string> {
    return this.sendCommand(`u ${contactId} ${x} ${y} ${pressure} ${width} ${height}\n`)
  }

  async commit(): Promise<string> {
    return this.sendCommand('c\n')
  }

  async tap(x: number, y: number, durationMs = 50): Promise<void> {
    await this.touchDown(0, x, y)
    await this.commit()
    await new Promise(resolve => setTimeout(resolve, durationMs))
    await this.touchUp(0, x, y)
    await this.commit()
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs = 300,
    steps = 10,
  ): Promise<void> {
    await this.touchDown(0, x1, y1)
    await this.commit()

    const stepDelay = durationMs / steps
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps
      const x = Math.round(x1 + (x2 - x1) * progress)
      const y = Math.round(y1 + (y2 - y1) * progress)
      await this.touchMove(0, x, y)
      await this.commit()
      await new Promise(resolve => setTimeout(resolve, stepDelay))
    }

    await this.touchUp(0, x2, y2)
    await this.commit()
  }
}

// --- Helpers ---

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve()
      return
    }
    ws.addEventListener('open', () => resolve(), { once: true })
    ws.addEventListener('error', (event) => {
      reject(new DeviceBaseError(`WebSocket connection failed: ${String(event)}`))
    }, { once: true })
  })
}

function receiveBinary(ws: WebSocket, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Accumulate binary data as Uint8Array chunks to avoid type conflicts with Buffer.concat()
    // in Node 22 where Buffer extends Uint8Array<ArrayBuffer> with stricter generic constraints
    const chunks: Uint8Array[] = []
    let received = 0

    function cleanup() {
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('close', onClose)
      ws.removeEventListener('error', onError)
    }

    function onMessage(event: MessageEvent) {
      let buf: Uint8Array
      if (event.data instanceof ArrayBuffer) {
        buf = new Uint8Array(event.data)
      }
      else if (ArrayBuffer.isView(event.data)) {
        // Preserve byte offset and length when wrapping ArrayBuffer views
        buf = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
      }
      else {
        buf = new Uint8Array(event.data as ArrayBuffer)
      }
      chunks.push(buf)
      received += buf.length
      if (received >= size) {
        cleanup()
        resolve(Buffer.from(concatUint8Arrays(chunks, received)))
      }
    }

    function onClose() {
      cleanup()
      // Return accumulated data as Buffer when connection closes
      resolve(Buffer.from(concatUint8Arrays(chunks, received)))
    }

    function onError(err: Event) {
      cleanup()
      reject(new DeviceBaseError(`WebSocket read error: ${String(err)}`))
    }

    ws.addEventListener('message', onMessage)
    ws.addEventListener('close', onClose, { once: true })
    ws.addEventListener('error', onError, { once: true })
  })
}

/**
 * Manually concatenate multiple Uint8Array chunks into a single array.
 * This approach avoids Buffer.concat() type incompatibility issues with Node 22
 * where SharedArrayBuffer vs ArrayBuffer generic constraints create type conflicts.
 * @param chunks - Array of Uint8Array fragments to concatenate
 * @param totalLength - Total byte length of all chunks combined
 * @returns A single Uint8Array containing all chunk data
 */
function concatUint8Arrays(chunks: readonly Uint8Array[], totalLength: number): Uint8Array {
  const output = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}
