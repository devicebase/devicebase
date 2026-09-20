import type { OptionValues } from 'commander'
import type { MouseButton, ScrollDirection } from '../models.js'
import { Command } from 'commander'
import {
  createClient,
  fail,
  parseBounds,
  parseIntegerToken,
  parsePoint,
  printEnvelope,
  requireArg,
  resolveSerial,
} from './helpers.js'
import { createScreenshotCommand } from './screenshot.js'

export const COMPUTER_GROUP = 'computer'

const BUTTON_CHOICES: readonly MouseButton[] = ['left', 'right', 'middle']
const SCROLL_DIRECTIONS: readonly ScrollDirection[] = ['up', 'down', 'left', 'right']

/** Bounds for `computer wait`, in milliseconds (the route's documented ceiling). */
const MIN_WAIT_MS = 1
const MAX_WAIT_MS = 300_000

/** Bounds for `computer bash --timeout`, in seconds; 0 means "server default". */
const MAX_BASH_TIMEOUT_SECONDS = 600

/** Bounds for `computer long-click --seconds`; 0 means "driver default". */
const MAX_LONG_CLICK_SECONDS = 60

/**
 * Computer platform group (macOS / Windows / Linux desktops).
 *
 * Every action targets `POST/GET /api/computer/{serialno}/{action}`. The serial
 * is the platform `serialno` of a registered computer device — see
 * `devicebase list-devices --type computer`. Coordinates are absolute screen
 * pixels, in the same `x,y` / `x1,y1,x2,y2` style as the mobile group.
 */
export function createComputerCommand(): Command {
  const group = new Command(COMPUTER_GROUP)
    .description('Control a computer (desktop) platform device')
    .option('-s, --serialno <serialno>', 'Platform serialno (sn from device list)')

  const commands: Command[] = [
    new Command('click')
      .argument('<x,y>')
      .description('Click at absolute screen coordinates')
      // No default: the field is omitted and the server applies "left".
      .option('--button <button>', `Mouse button: ${BUTTON_CHOICES.join('|')} (default: left)`)
      .action(async (coords: string, options: { button?: string }, cmd: Command) => {
        const point = parsePoint(coords)
        const button = options.button
        // Validated here rather than with commander's .choices() so the message
        // matches the Go CLI byte for byte (`invalid button "x", expected …`).
        if (button !== undefined && !BUTTON_CHOICES.includes(button as MouseButton)) {
          return fail(`invalid button "${button}", expected one of: ${BUTTON_CHOICES.join(', ')}`)
        }
        printEnvelope(await createClient().computerClick(resolveSerial(cmd, COMPUTER_GROUP), {
          x: point.x,
          y: point.y,
          button: button as MouseButton | undefined,
        }))
      }),
    new Command('double-click')
      .argument('<x,y>')
      .description('Double click at absolute screen coordinates (left button)')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        const point = parsePoint(coords)
        printEnvelope(await createClient().computerDoubleClick(resolveSerial(cmd, COMPUTER_GROUP), {
          x: point.x,
          y: point.y,
        }))
      }),
    new Command('long-click')
      .argument('<x,y>')
      .description('Press and hold the left button at absolute screen coordinates')
      .option('--seconds <seconds>', 'Hold duration in seconds (1-60; default: driver default)')
      .action(async (coords: string, options: { seconds?: string }, cmd: Command) => {
        const point = parsePoint(coords)
        const seconds = parseSeconds(options.seconds)
        const serial = resolveSerial(cmd, COMPUTER_GROUP)
        printEnvelope(await createClient().computerLongClick(serial, {
          x: point.x,
          y: point.y,
          duration: seconds || undefined,
        }))
      }),
    new Command('move')
      .argument('<x,y>')
      .description('Move the mouse to absolute screen coordinates without clicking')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        const point = parsePoint(coords)
        printEnvelope(await createClient().computerMove(resolveSerial(cmd, COMPUTER_GROUP), {
          x: point.x,
          y: point.y,
        }))
      }),
    new Command('drag')
      .argument('<x1,y1,x2,y2>')
      .description('Press the left button at (x1,y1), move to (x2,y2) and release')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerDrag(resolveSerial(cmd, COMPUTER_GROUP), parseBounds(coords)))
      }),
    new Command('scroll')
      .argument('<direction>')
      .description(`Scroll the mouse wheel: ${SCROLL_DIRECTIONS.join('|')}`)
      .option('--amount <amount>', 'Scroll amount in wheel steps (default: driver default)')
      .action(async (direction: string, options: { amount?: string }, cmd: Command) => {
        if (!SCROLL_DIRECTIONS.includes(direction as ScrollDirection)) {
          return fail(`invalid direction "${direction}", expected one of: ${SCROLL_DIRECTIONS.join(', ')}`)
        }
        const amount = options.amount === undefined
          ? undefined
          : parseIntegerToken(options.amount, `invalid amount "${options.amount}", expected an integer`)
        printEnvelope(await createClient().computerScroll(
          resolveSerial(cmd, COMPUTER_GROUP),
          direction as ScrollDirection,
          amount,
        ))
      }),
    new Command('type-text')
      .argument('<text>')
      .description('Type text at the current caret position')
      .action(async (text: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerTypeText(resolveSerial(cmd, COMPUTER_GROUP), requireArg(text, 'text')))
      }),
    new Command('press')
      .argument('<key>')
      .description('Press a keyboard key, e.g. Enter, Escape, a, F5')
      .action(async (key: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerPress(resolveSerial(cmd, COMPUTER_GROUP), requireArg(key, 'key')))
      }),
    new Command('hotkey')
      .argument('<keys...>')
      .description('Press the given keys together, e.g. "hotkey Control Shift Escape"')
      .action(async (keys: string[], _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerHotkey(resolveSerial(cmd, COMPUTER_GROUP), keys))
      }),
    new Command('position')
      .description('Get the current absolute mouse position')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerPosition(resolveSerial(cmd, COMPUTER_GROUP)))
      }),
    new Command('screen-size')
      .description('Get the primary screen size in pixels')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerScreenSize(resolveSerial(cmd, COMPUTER_GROUP)))
      }),
    new Command('permissions')
      .description('Check the desktop control permissions (screen recording, accessibility, …)')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerPermissions(resolveSerial(cmd, COMPUTER_GROUP)))
      }),
    new Command('launch-app')
      .argument('<app>')
      .description('Launch a desktop application by name or path')
      .action(async (app: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().computerLaunchApp(resolveSerial(cmd, COMPUTER_GROUP), requireArg(app, 'app_name')))
      }),
    new Command('wait')
      .argument('<ms>')
      .description(`Block for a duration in milliseconds (${MIN_WAIT_MS}-${MAX_WAIT_MS})`)
      .action(async (milliseconds: string, _options: OptionValues, cmd: Command) => {
        const ms = parseIntegerToken(
          milliseconds,
          `invalid duration "${milliseconds}", expected milliseconds as an integer`,
        )
        if (ms < MIN_WAIT_MS || ms > MAX_WAIT_MS) {
          return fail(`wait duration must be between ${MIN_WAIT_MS} and ${MAX_WAIT_MS} ms`)
        }
        printEnvelope(await createClient().computerWait(resolveSerial(cmd, COMPUTER_GROUP), ms))
      }),
    new Command('bash')
      .argument('<command>')
      .description('Run a shell command on the host machine (danger tier — see --help)')
      .option('--timeout <seconds>', 'Command timeout in seconds (0-600; 0 or omitted: server default 120)')
      .action(async (command: string, options: { timeout?: string }, cmd: Command) => {
        const shellCommand = requireArg(command, 'command')
        const timeout = options.timeout === undefined
          ? 0
          : parseIntegerToken(options.timeout, `invalid timeout "${options.timeout}", expected an integer`)
        // 0 is valid — it means "omit the field" so the server default applies.
        if (timeout < 0 || timeout > MAX_BASH_TIMEOUT_SECONDS) {
          return fail(`--timeout must be between 0 and ${MAX_BASH_TIMEOUT_SECONDS} seconds (0 or omitted: server default)`)
        }
        printEnvelope(await createClient().computerBash(resolveSerial(cmd, COMPUTER_GROUP), shellCommand, timeout))
      }),
    createScreenshotCommand(COMPUTER_GROUP),
  ]

  for (const command of commands) {
    group.addCommand(command)
  }

  return group
}

function parseSeconds(raw: string | undefined): number {
  if (raw === undefined) {
    return 0
  }
  const seconds = parseIntegerToken(raw, `invalid seconds "${raw}", expected an integer`)
  // 0 is valid — it means "omit the field" so the driver default applies.
  if (seconds < 0 || seconds > MAX_LONG_CLICK_SECONDS) {
    return fail(`--seconds must be between 1 and ${MAX_LONG_CLICK_SECONDS}`)
  }
  return seconds
}
