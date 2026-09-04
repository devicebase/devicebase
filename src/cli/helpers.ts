import type { Command } from 'commander'
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

/**
 * Resolve the `-s/--serial` option for an invoked command by walking up the
 * command tree (the leaf first, then each parent). This supports both the
 * platform groups (`devicebase mobile -s <serial> tap ...`) and the
 * deprecated top-level aliases (`devicebase -s <serial> tap ...`).
 *
 * Prints the standard error message — plus an optional platform hint — and
 * exits when no serial is provided anywhere on the command line.
 */
export function resolveSerial(cmd: Command, hint?: string): string {
  for (let node: Command | null | undefined = cmd; node; node = node.parent) {
    const serial = (node.opts() as { serial?: string }).serial
    if (serial) {
      return serial
    }
  }
  console.error('Error: required flag(s) "--serial" not set')
  if (hint) {
    console.error(hint)
  }
  process.exit(1)
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

/** Attach the standard print-or-exit handling to an async action result. */
export function send(promise: Promise<unknown>): void {
  promise.then(
    data => printResult(data, null),
    err => printResult(null, err),
  )
}

export function printScreenshot(serial: string, outputPath: string | undefined): Promise<void> {
  const client = createClient()
  return client.getScreenshot(serial).then((buffer: ArrayBuffer) => {
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
  const x = Number.parseInt(parts[0]?.trim() ?? '', 10)
  const y = Number.parseInt(parts[1]?.trim() ?? '', 10)
  if (parts.length !== 2 || Number.isNaN(x) || Number.isNaN(y)) {
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

/** Parse a numeric option/argument value; prints an error and exits on NaN. */
export function parseNumber(s: string, label: string): number {
  const n = Number(s)
  if (!Number.isFinite(n)) {
    console.error(`Error: invalid ${label} "${s}", expected a number`)
    process.exit(1)
  }
  return n
}
