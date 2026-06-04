import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { DeviceBaseHttpClient } from '../http-client.js'

export function createClient(): DeviceBaseHttpClient {
  try {
    return new DeviceBaseHttpClient()
  }
  catch (err) {
    console.error('Error:', (err as Error).message)
    process.exit(1)
  }
}

export function getSerial(options: { serial?: string }): string {
  if (!options.serial) {
    console.error('Error: required flag(s) "--serial" not set')
    process.exit(1)
  }
  return options.serial
}

export function printResult(data: unknown, err: unknown): void {
  if (err) {
    console.error('Error:', (err as Error).message)
    process.exit(1)
  }
  if (data != null) {
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    if (str.length > 0) {
      console.log(str)
    }
  }
}

export function printScreenshot(serial: string, outputPath: string | undefined): void {
  const client = createClient()
  client.getScreenshot(serial).then((buffer: ArrayBuffer) => {
    const data = new Uint8Array(buffer)
    if (outputPath) {
      writeFileSync(outputPath, data)
      console.log(`Screenshot saved to ${outputPath}`)
    }
    else {
      process.stdout.write(data)
    }
  }).catch((err: Error) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
}

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function parsePoint(s: string): Point {
  const parts = s.split(',', 2)
  if (parts.length !== 2) {
    console.error(`Error: invalid point format "${s}", expected x,y`)
    process.exit(1)
  }
  const x = Number.parseInt(parts[0].trim(), 10)
  const y = Number.parseInt(parts[1].trim(), 10)
  if (Number.isNaN(x) || Number.isNaN(y)) {
    console.error(`Error: invalid point format "${s}", expected x,y`)
    process.exit(1)
  }
  return { x, y }
}

export function parseBounds(s: string): Bounds {
  const parts = s.split(',', 4)
  if (parts.length !== 4) {
    console.error(`Error: invalid bounds format "${s}", expected x1,y1,x2,y2`)
    process.exit(1)
  }
  const vals = parts.map((p) => {
    const v = Number.parseInt(p.trim(), 10)
    if (Number.isNaN(v)) {
      console.error(`Error: invalid bounds format "${s}", expected x1,y1,x2,y2`)
      process.exit(1)
    }
    return v
  })
  return { x1: vals[0], y1: vals[1], x2: vals[2], y2: vals[3] }
}
