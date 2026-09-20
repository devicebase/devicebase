import type { Command } from 'commander'
import type { Bounds, Point } from '../models.js'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { StringDecoder } from 'node:string_decoder'
import { DeviceBaseHttpClient } from '../http-client.js'

/** The three platform command groups. */
export type Platform = 'mobile' | 'browser' | 'computer'

/**
 * A failure the CLI reports as `Error: <message>` on stderr, exiting with
 * `exitCode`.
 *
 * Thrown rather than calling `process.exit` directly: writing to a pipe is
 * asynchronous on POSIX, so exiting mid-write can truncate the message (and
 * would drop any JSON still queued on stdout). Throwing hands the exit code back
 * to `main`, which lets the process end on its own once the streams have
 * drained — and keeps error paths reachable from tests.
 */
export class CliError extends Error {
  readonly exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.name = 'CliError'
    this.exitCode = exitCode
  }
}

/** Abort the command with `Error: <message>` on stderr. */
export function fail(message: string): never {
  throw new CliError(message)
}

export function createClient(): DeviceBaseHttpClient {
  try {
    return new DeviceBaseHttpClient()
  }
  catch (err) {
    return fail((err as Error).message)
  }
}

/**
 * Resolve the `-s/--serialno` option for an invoked command by walking up the
 * command tree (the leaf first, then the platform group, then the root), so
 * either of these works:
 *
 *   devicebase -s <serialno> mobile tap 100,200
 *   devicebase mobile -s <serialno> tap 100,200
 *
 * When no serial is given anywhere the command aborts with the conventional
 * message, plus a platform discovery hint when the caller named one.
 */
export function resolveSerial(cmd: Command, platform?: Platform): string {
  for (let node: Command | null | undefined = cmd; node; node = node.parent) {
    const serial = (node.opts() as { serialno?: string }).serialno
    if (serial) {
      return serial
    }
  }
  const hint = platform
    ? `\nHINT: find a ${platform} device to control first: devicebase list-devices --type ${platform}`
    : ''
  return fail(`required flag(s) "--serialno" not set${hint}`)
}

/** Reject a blank positional argument before it reaches the API. */
export function requireArg(value: string, label: string): string {
  if (value.trim() === '') {
    return fail(`${label} cannot be empty`)
  }
  return value
}

/**
 * Print the server's response envelope verbatim.
 *
 * The Go CLI's output contract is that a successful command prints the API's own
 * JSON envelope, so a script can pipe it straight into `jq`:
 *
 *   {"code":200,"message":"success","data":{…},"timestamp":"…"}
 *
 * The typed platform methods wrap that envelope in their result objects
 * (`OperationResult.data`, `DeviceInfo.data`, …), so unwrapping here keeps the
 * printed JSON identical to what the API returned.
 */
export function printEnvelope(result: { data: Record<string, unknown> }): void {
  printResult(result.data)
}

export function printResult(data: unknown): void {
  if (data == null) {
    return
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  if (text.length > 0) {
    console.log(text)
  }
}

const INTEGER_PATTERN = /^[+-]?\d+$/

/** Parse a strictly-integer token (Go's `strconv.Atoi` semantics), or abort. */
export function parseIntegerToken(token: string, message: string): number {
  const trimmed = token.trim()
  if (!INTEGER_PATTERN.test(trimmed)) {
    return fail(message)
  }
  return Number.parseInt(trimmed, 10)
}

/** Parse `x,y` into a Point. */
export function parsePoint(value: string): Point {
  const parts = value.split(',')
  if (parts.length !== 2) {
    return fail(`invalid point format "${value}", expected x,y`)
  }
  return {
    x: parseIntegerToken(parts[0], `invalid x coordinate "${parts[0].trim()}", expected an integer in "${value}"`),
    y: parseIntegerToken(parts[1], `invalid y coordinate "${parts[1].trim()}", expected an integer in "${value}"`),
  }
}

/** Parse `x1,y1,x2,y2` into Bounds. */
export function parseBounds(value: string): Bounds {
  const parts = value.split(',')
  if (parts.length !== 4) {
    return fail(`invalid bounds format "${value}", expected x1,y1,x2,y2`)
  }
  const values = parts.map((part, index) =>
    parseIntegerToken(
      part,
      `invalid coordinate at position ${index + 1} "${part.trim()}", expected an integer in "${value}"`,
    ))
  return { x1: values[0], y1: values[1], x2: values[2], y2: values[3] }
}

/**
 * Return the text from the first argument, or from stdin when no argument was
 * given, so callers can keep secrets out of shell history:
 *
 *   devicebase mobile -s <serialno> input "hello 世界"
 *   echo "hello 世界" | devicebase mobile -s <serialno> input
 *
 * `usage` names the command to suggest when stdin turns out to be empty.
 */
export async function readInputText(
  arg: string | undefined,
  usage: string,
  input: NodeJS.ReadableStream = process.stdin,
): Promise<string> {
  if (arg !== undefined && arg !== '') {
    return arg
  }
  if ((input as { isTTY?: boolean }).isTTY === true) {
    return fail(`no text given — pass it as an argument or pipe it in (e.g. echo hello | ${usage})`)
  }
  // StringDecoder rather than a plain toString: it holds back a partial
  // multi-byte sequence between chunks, so a CJK character split across a chunk
  // boundary is not mangled into replacement characters.
  const decoder = new StringDecoder('utf8')
  let text = ''
  for await (const chunk of input) {
    text += decoder.write(Buffer.from(chunk as string | Uint8Array))
  }
  text += decoder.end()
  // Drop one trailing newline so `echo hello | devicebase … input` sends exactly
  // "hello".
  text = text.replace(/[\r\n]+$/, '')
  if (text.trim() === '') {
    return fail(`no text received on stdin — pipe the text to insert (e.g. echo hello | ${usage})`)
  }
  return text
}
