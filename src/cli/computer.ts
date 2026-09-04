import type { OptionValues } from 'commander'
import process from 'node:process'
import { Command, Option } from 'commander'
import {
  createClient,
  parseBounds,
  parseNumber,
  parsePoint,
  resolveSerial,
  send,
} from './helpers.js'

/**
 * Computer platform commands — everything maps to the platform computer open
 * API: /api/computer/{serial}/{action...}, where `serial` is the registered
 * computer device id (see "devicebase list-devices --type computer").
 *
 * Coordinates are absolute screen pixels ("x,y" / "x1,y1,x2,y2"). HTTP
 * methods, body and query field names below are the contract shared with the
 * Go CLI and mirror the TestClaw service route source.
 */

export const COMPUTER_GROUP = 'computer'

const COMPUTER_HINT = 'Hint: run "devicebase list-devices --type computer" to find the target computer device id'

function computerSerial(cmd: Command): string {
  return resolveSerial(cmd, COMPUTER_HINT)
}

// --- Actions --------------------------------------------------------------

function click(coords: string, options: { button?: string }, cmd: Command): void {
  const serial = computerSerial(cmd)
  const p = parsePoint(coords)
  send(createClient().requestJson('POST', `/api/computer/${serial}/click`, {
    body: { x: p.x, y: p.y, button: options.button ?? 'left' },
  }))
}

function doubleClick(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  const p = parsePoint(coords)
  send(createClient().requestJson('POST', `/api/computer/${serial}/double_click`, {
    body: { x: p.x, y: p.y },
  }))
}

function longClick(coords: string, options: { seconds?: string }, cmd: Command): void {
  const serial = computerSerial(cmd)
  const p = parsePoint(coords)
  // The wire field for the hold duration is `duration` (seconds).
  const duration = options.seconds === undefined
    ? undefined
    : parseNumber(options.seconds, 'seconds')
  send(createClient().requestJson('POST', `/api/computer/${serial}/long_click`, {
    body: duration === undefined ? { x: p.x, y: p.y } : { x: p.x, y: p.y, duration },
  }))
}

function move(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  const p = parsePoint(coords)
  send(createClient().requestJson('POST', `/api/computer/${serial}/move`, {
    body: { x: p.x, y: p.y },
  }))
}

function drag(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  const b = parseBounds(coords)
  send(createClient().requestJson('POST', `/api/computer/${serial}/drag`, {
    body: { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 },
  }))
}

function scroll(direction: string, options: { amount?: string }, cmd: Command): void {
  const serial = computerSerial(cmd)
  const amount = options.amount === undefined
    ? undefined
    : parseNumber(options.amount, 'amount')
  send(createClient().requestJson('POST', `/api/computer/${serial}/scroll`, {
    body: amount === undefined ? { direction } : { direction, amount },
  }))
}

function typeText(text: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('POST', `/api/computer/${serial}/type_text`, {
    body: { text },
  }))
}

function press(key: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('POST', `/api/computer/${serial}/press`, {
    body: { key },
  }))
}

function hotkey(keys: string[], _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('POST', `/api/computer/${serial}/hotkey`, {
    body: { keys },
  }))
}

function position(_options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('GET', `/api/computer/${serial}/position`))
}

function screenSize(_options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('GET', `/api/computer/${serial}/screen_size`))
}

function permissions(_options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('GET', `/api/computer/${serial}/permissions`))
}

function launchApp(app: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  send(createClient().requestJson('POST', `/api/computer/${serial}/launch_app`, {
    body: { app_name: app },
  }))
}

// CLI argument is milliseconds; the wire field is `seconds`.
function wait(milliseconds: string, _options: OptionValues, cmd: Command): void {
  const serial = computerSerial(cmd)
  const ms = parseNumber(milliseconds, 'duration')
  if (ms <= 0) {
    console.error('Error: wait duration must be greater than 0 ms')
    process.exit(1)
  }
  send(createClient().requestJson('POST', `/api/computer/${serial}/wait`, {
    body: { seconds: ms / 1000 },
  }))
}

// --- Registration ---------------------------------------------------------

const BUTTON_CHOICES = ['left', 'right', 'middle'] as const

export function registerComputerCommands(parent: Command): Command {
  const group = new Command(COMPUTER_GROUP)
  group
    .description('Control a computer device via /api/computer/{serial} (serial is the registered computer device id)')
    .option('-s, --serial <serial>', 'Computer device id')
    .addCommand(
      new Command('click')
        .argument('<coords>')
        .description('Click at coordinates (x,y)')
        .addOption(new Option('--button <button>', 'Mouse button to use').choices(BUTTON_CHOICES).default('left'))
        .action(click),
    )
    .addCommand(
      new Command('double-click')
        .argument('<coords>')
        .description('Double click at coordinates (x,y)')
        .action(doubleClick),
    )
    .addCommand(
      new Command('long-click')
        .argument('<coords>')
        .description('Press and hold at coordinates (x,y)')
        .option('--seconds <number>', 'Hold duration in seconds')
        .action(longClick),
    )
    .addCommand(
      new Command('move')
        .argument('<coords>')
        .description('Move the mouse to coordinates (x,y)')
        .action(move),
    )
    .addCommand(
      new Command('drag')
        .argument('<coords>')
        .description('Drag the mouse from (x1,y1) to (x2,y2)')
        .action(drag),
    )
    .addCommand(
      new Command('scroll')
        .argument('<direction>')
        .description('Scroll in a direction (up|down|left|right)')
        .option('--amount <number>', 'Scroll amount')
        .action(scroll),
    )
    .addCommand(
      new Command('type-text')
        .argument('<text>')
        .description('Type text at the current caret position')
        .action(typeText),
    )
    .addCommand(
      new Command('press')
        .argument('<key>')
        .description('Press a keyboard key')
        .action(press),
    )
    .addCommand(
      new Command('hotkey')
        .argument('<keys...>')
        .description('Send a keyboard shortcut, e.g. "hotkey ctrl shift s"')
        .action(hotkey),
    )
    .addCommand(
      new Command('position')
        .description('Get the current mouse position')
        .action(position),
    )
    .addCommand(
      new Command('screen-size')
        .description('Get the screen size')
        .action(screenSize),
    )
    .addCommand(
      new Command('permissions')
        .description('Get the accessibility/automation permission status')
        .action(permissions),
    )
    .addCommand(
      new Command('launch-app')
        .argument('<app>')
        .description('Launch an application on the computer')
        .action(launchApp),
    )
    .addCommand(
      new Command('wait')
        .argument('<ms>')
        .description('Wait for a duration in milliseconds')
        .action(wait),
    )
  parent.addCommand(group)
  return group
}
