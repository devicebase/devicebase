import type { OptionValues } from 'commander'
import process from 'node:process'
import { Command } from 'commander'
import {
  createClient,
  parseBounds,
  parsePoint,
  printScreenshot,
  resolveSerial,
  send,
} from './helpers.js'

/**
 * Mobile platform commands — everything maps to the /v1 open API
 * (POST /v1/{action}/{serial}, GET /v1/{action}/{serial} for reads).
 *
 * Each leaf is defined once in MOBILE_LEAF_SPECS and then registered twice:
 * under the `mobile` group (canonical) and — for the original commands only —
 * as deprecated top-level aliases (legacy `devicebase -s <serial> tap ...`
 * style, behavior unchanged). Both registrations bind the *same* action
 * function; serial resolution walks the parent chain, so one action serves
 * the group `-s` and the root `-s` alike.
 */

export const MOBILE_GROUP = 'mobile'

const MOBILE_HINT = 'Hint: run "devicebase list-devices --type mobile" to find the target mobile device serial'

/** Serial resolution that only appends the platform hint when run through the `mobile` group. */
function mobileSerial(cmd: Command): string {
  const hint = cmd.parent?.name() === MOBILE_GROUP ? MOBILE_HINT : undefined
  return resolveSerial(cmd, hint)
}

// --- Shared actions -------------------------------------------------------

function actTap(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().tap(serial, parsePoint(coords)))
}

function actDoubleTap(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().doubleTap(serial, parsePoint(coords)))
}

function actLongPress(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().longPress(serial, parsePoint(coords)))
}

function actSwipe(coords: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().swipe(serial, parseBounds(coords)))
}

function actBack(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().back(serial))
}

function actHome(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().home(serial))
}

function actLaunchApp(appName: string, _options: OptionValues, cmd: Command): void {
  if (!appName) {
    console.error('Error: app_name cannot be empty')
    process.exit(1)
  }
  const serial = mobileSerial(cmd)
  send(createClient().launchApp(serial, appName))
}

function actInput(text: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().inputText(serial, text))
}

function actClearText(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().clearText(serial))
}

function actCurrentApp(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().getCurrentApp(serial))
}

function actDumpHierarchy(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().dumpHierarchy(serial))
}

function actDeviceInfo(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().getDeviceInfo(serial))
}

function actScreenshot(options: { output?: string }, cmd: Command): Promise<void> {
  return printScreenshot(mobileSerial(cmd), options.output)
}

function actStopApp(appName: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().requestJson('POST', `/v1/stop_app/${serial}`, { body: { app_name: appName } }))
}

function actStopCurrentApp(_options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().requestJson('POST', `/v1/stop_current_app/${serial}`))
}

function actBash(command: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().requestJson('POST', `/v1/bash/${serial}`, { body: { command } }))
}

// install_app body uses { app_path } — a file path on the agent host.
function actInstallApp(appPath: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().requestJson('POST', `/v1/install_app/${serial}`, { body: { app_path: appPath } }))
}

function actInstallStatus(installId: string, _options: OptionValues, cmd: Command): void {
  const serial = mobileSerial(cmd)
  send(createClient().requestJson('GET', `/v1/install_status/${serial}`, { query: { install_id: installId } }))
}

// --- Leaf spec table ------------------------------------------------------

type LeafAction = (...args: any[]) => void

interface MobileLeafSpec {
  name: string
  /** Command-argument usage string, e.g. '<coords>' ('' when no arguments). */
  usage: string
  summary: string
  action: LeafAction
  /** Extra options to attach to the leaf (e.g. screenshot -o). */
  options?: (leaf: Command) => void
  /** Only registered under the mobile group; no deprecated top-level alias. */
  groupOnly?: boolean
}

function screenshotOptions(leaf: Command): void {
  leaf.option('-o, --output <file>', 'Output file path (default: stdout)')
}

const MOBILE_LEAF_SPECS: MobileLeafSpec[] = [
  { name: 'tap', usage: '<coords>', summary: 'Tap on the device screen', action: actTap },
  { name: 'double-tap', usage: '<coords>', summary: 'Double tap on the device screen', action: actDoubleTap },
  { name: 'long-press', usage: '<coords>', summary: 'Long press on the device screen', action: actLongPress },
  { name: 'swipe', usage: '<coords>', summary: 'Swipe on the device screen (x1,y1,x2,y2)', action: actSwipe },
  { name: 'back', usage: '', summary: 'Press the back button', action: actBack },
  { name: 'home', usage: '', summary: 'Press the home button', action: actHome },
  { name: 'launch-app', usage: '<app>', summary: 'Launch an application by package/bundle name', action: actLaunchApp },
  { name: 'input', usage: '<text>', summary: 'Input text on the device', action: actInput },
  { name: 'clear-text', usage: '', summary: 'Clear text in the current input field', action: actClearText },
  { name: 'current-app', usage: '', summary: 'Get the current foreground app', action: actCurrentApp },
  { name: 'dump-hierarchy', usage: '', summary: 'Dump the UI hierarchy', action: actDumpHierarchy },
  { name: 'device-info', usage: '', summary: 'Get device information', action: actDeviceInfo },
  { name: 'screenshot', usage: '', summary: 'Take a screenshot of the device', action: actScreenshot, options: screenshotOptions },
  { name: 'stop-app', usage: '<app>', summary: 'Stop an application by package/bundle name', action: actStopApp, groupOnly: true },
  { name: 'stop-current-app', usage: '', summary: 'Stop the current foreground app', action: actStopCurrentApp, groupOnly: true },
  { name: 'bash', usage: '<command>', summary: 'Execute a shell command on the device (adb/hdc only)', action: actBash, groupOnly: true },
  { name: 'install-app', usage: '<app_path>', summary: 'Install an app from a file path on the agent host', action: actInstallApp, groupOnly: true },
  { name: 'install-status', usage: '<install_id>', summary: 'Query the status of a background app install', action: actInstallStatus, groupOnly: true },
]

// --- Registration ---------------------------------------------------------

function registerLeaf(owner: Command, spec: MobileLeafSpec, deprecated: boolean): Command {
  const leaf = new Command(spec.name)
  if (spec.usage) {
    leaf.argument(spec.usage)
  }
  leaf.description(deprecated
    ? `${spec.summary} (deprecated: use "mobile ${spec.name}" instead)`
    : spec.summary)
  spec.options?.(leaf)
  leaf.action(spec.action)
  owner.addCommand(leaf)
  return leaf
}

/** Register the `mobile` group (with its own persistent -s/--serial). */
export function registerMobileGroup(parent: Command): Command {
  const group = new Command(MOBILE_GROUP)
  group
    .description('Control a mobile device (Android / HarmonyOS / iOS) via the /v1 open API')
    .option('-s, --serial <serial>', 'Mobile device serial number')
  for (const spec of MOBILE_LEAF_SPECS) {
    registerLeaf(group, spec, false)
  }
  parent.addCommand(group)
  return group
}

/** Register the deprecated top-level aliases of the original flat CLI. */
export function registerMobileAliases(parent: Command): Command[] {
  const aliases: Command[] = []
  for (const spec of MOBILE_LEAF_SPECS) {
    if (spec.groupOnly) {
      continue
    }
    aliases.push(registerLeaf(parent, spec, true))
  }
  return aliases
}
