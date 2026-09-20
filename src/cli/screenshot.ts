import type { Platform } from './helpers.js'
import { writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import process from 'node:process'
import { Command } from 'commander'
import { createClient, fail, resolveSerial } from './helpers.js'

/**
 * `screenshot` is the one **cross-family** command: it does not live under
 * `/api/browser/*` or `/api/computer/*`. The server dispatches
 * `POST /v1/screen/{serialno}` by device type (computer → full-desktop capture,
 * browser → CDP capture, otherwise the device image queue), so one command
 * serves every platform. It is registered in each platform group so `--help`
 * surfaces it there — hence the optional `platform`, which only decides whether
 * a missing serialno reports that group's discovery hint.
 */
export function createScreenshotCommand(platform?: Platform): Command {
  return new Command('screenshot')
    .description('Take a screenshot of the device')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .action(async (options: { output?: string }, cmd: Command) => {
      const client = createClient()
      const bytes = new Uint8Array(
        await client.getScreenshot(resolveSerial(cmd, platform)),
      )

      if (!options.output) {
        process.stdout.write(bytes)
        return
      }

      try {
        writeFileSync(options.output, bytes)
      }
      catch (err) {
        return fail(`failed to write ${options.output}: ${(err as Error).message}`)
      }
      console.log(`Screenshot saved to ${options.output}`)

      const warning = describeFormatMismatch(options.output, bytes)
      if (warning) {
        console.error(warning)
      }
    })
}

/** Container formats the capture path can plausibly return. */
const EXTENSION_FORMATS: Record<string, string> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
}

/** Sniff the container format from the leading bytes. */
function imageFormatFromBytes(data: Uint8Array): string {
  const startsWith = (signature: readonly number[], offset = 0): boolean =>
    signature.every((byte, index) => data[offset + index] === byte)

  if (startsWith([0xFF, 0xD8, 0xFF])) {
    return 'jpeg'
  }
  if (startsWith([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
    return 'png'
  }
  if (startsWith([0x47, 0x49, 0x46, 0x38]) && (data[4] === 0x37 || data[4] === 0x39) && data[5] === 0x61) {
    return 'gif'
  }
  if (data.length >= 12 && startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }
  return ''
}

/**
 * Report when a file's extension contradicts the bytes the server actually
 * returned. The server decides the format independently of the output name, so
 * a `.png` target quietly receives JPEG data — a mislabelled file that breaks
 * downstream readers. The file is written as asked; the contradiction is
 * surfaced on stderr.
 */
function describeFormatMismatch(path: string, data: Uint8Array): string {
  const actual = imageFormatFromBytes(data)
  if (actual === '') {
    return ''
  }
  const extension = extname(path).replace(/^\./, '').toLowerCase()
  const expected = EXTENSION_FORMATS[extension]
  if (expected === undefined || expected === actual) {
    return ''
  }
  return `Warning: ${path} has a .${extension} extension but the server returned ${actual.toUpperCase()} data`
}
