import type { OptionValues } from 'commander'
import { Command } from 'commander'
import {
  createClient,
  parseBounds,
  parsePoint,
  printEnvelope,
  readInputText,
  requireArg,
  resolveSerial,
} from './helpers.js'
import { createScreenshotCommand } from './screenshot.js'

export const MOBILE_GROUP = 'mobile'

/**
 * Mobile platform group — Android / HarmonyOS / iOS.
 *
 * Every action targets `POST/GET /v1/{action}/{serialno}` on the control API.
 * The serial is a mobile device serial (adb/hdc/ios) and the coordinates keep
 * the original CLI's style: points as `x,y`, bounds as `x1,y1,x2,y2`.
 *
 * The mobile group carries no discovery hint on a missing serial — there is
 * nothing narrower than `list-devices` to point at — unlike the browser and
 * computer groups, whose serials come from a typed lookup.
 */
export function createMobileCommand(): Command {
  const group = new Command(MOBILE_GROUP)
    .description('Control a mobile device (Android / HarmonyOS / iOS)')
    .option('-s, --serialno <serialno>', 'Platform serialno (sn from device list)')

  const commands: Command[] = [
    new Command('tap')
      .argument('<x,y>')
      .description('Tap on the device screen')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().tap(resolveSerial(cmd), parsePoint(coords)))
      }),
    new Command('double-tap')
      .argument('<x,y>')
      .description('Double tap on the device screen')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().doubleTap(resolveSerial(cmd), parsePoint(coords)))
      }),
    new Command('long-press')
      .argument('<x,y>')
      .description('Long press on the device screen')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().longPress(resolveSerial(cmd), parsePoint(coords)))
      }),
    new Command('swipe')
      .argument('<x1,y1,x2,y2>')
      .description('Swipe on the device screen')
      .action(async (coords: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().swipe(resolveSerial(cmd), parseBounds(coords)))
      }),
    new Command('back')
      .description('Press the back button')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().back(resolveSerial(cmd)))
      }),
    new Command('home')
      .description('Press the home button')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().home(resolveSerial(cmd)))
      }),
    new Command('launch-app')
      .argument('<app>')
      .description('Launch an application by package/bundle name')
      .action(async (app: string, _options: OptionValues, cmd: Command) => {
        const appName = requireArg(app, 'app_name')
        printEnvelope(await createClient().launchApp(resolveSerial(cmd), appName))
      }),
    new Command('stop-app')
      .argument('<app>')
      .description('Stop an application by package/bundle name')
      .action(async (app: string, _options: OptionValues, cmd: Command) => {
        const appName = requireArg(app, 'app_name')
        printEnvelope(await createClient().stopApp(resolveSerial(cmd), appName))
      }),
    new Command('stop-current-app')
      .description('Stop the current foreground app')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().stopCurrentApp(resolveSerial(cmd)))
      }),
    new Command('bash')
      .argument('<command>')
      .description('Execute a shell command on the device (adb/hdc only)')
      .action(async (command: string, _options: OptionValues, cmd: Command) => {
        const shellCommand = requireArg(command, 'command')
        printEnvelope(await createClient().bash(resolveSerial(cmd), shellCommand))
      }),
    new Command('input')
      .argument('[text]')
      .description('Input text on the device (reads stdin when omitted)')
      .action(async (text: string | undefined, _options: OptionValues, cmd: Command) => {
        const value = await readInputText(text, 'devicebase mobile -s <serialno> input')
        printEnvelope(await createClient().inputText(resolveSerial(cmd), value))
      }),
    new Command('clear-text')
      .description('Clear text in the current input field')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().clearText(resolveSerial(cmd)))
      }),
    new Command('current-app')
      .description('Get the current foreground app')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().getCurrentApp(resolveSerial(cmd)))
      }),
    new Command('dump-hierarchy')
      .description('Dump the UI hierarchy')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().dumpHierarchy(resolveSerial(cmd)))
      }),
    new Command('device-info')
      .description('Get device information')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().getDeviceInfo(resolveSerial(cmd)))
      }),
    new Command('install-app')
      .argument('<app_path>')
      .description('Install an app package from a host file path (returns an install_id)')
      .action(async (appPath: string, _options: OptionValues, cmd: Command) => {
        const path = requireArg(appPath, 'app_path')
        printEnvelope(await createClient().installApp(resolveSerial(cmd), path))
      }),
    new Command('install-status')
      .argument('<install_id>')
      .description('Query the status of a background app install')
      .action(async (installId: string, _options: OptionValues, cmd: Command) => {
        const id = requireArg(installId, 'install_id')
        printEnvelope(await createClient().installStatus(resolveSerial(cmd), id))
      }),
    createScreenshotCommand(),
  ]

  for (const command of commands) {
    group.addCommand(command)
  }

  return group
}
