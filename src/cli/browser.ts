import type { OptionValues } from 'commander'
import { Command } from 'commander'
import {
  createClient,
  printEnvelope,
  readInputText,
  requireArg,
  resolveSerial,
} from './helpers.js'
import { createScreenshotCommand } from './screenshot.js'

export const BROWSER_GROUP = 'browser'

/**
 * Browser platform group (Chrome/Chromium/Edge over CDP).
 *
 * Every action targets `POST/GET /api/browser/{serialno}/{action...}`. The
 * serialno is the platform `serialno` of a registered browser device — see
 * `devicebase list-devices --type browser`.
 */
export function createBrowserCommand(): Command {
  const group = new Command(BROWSER_GROUP)
    .description('Control a browser (Chrome/CDP) platform device')
    .option('-s, --serialno <serialno>', 'Platform serialno (sn from device list)')

  const commands: Command[] = [
    new Command('navigate')
      .argument('<url>')
      .description('Navigate the browser to a URL')
      .action(async (url: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserNavigate(resolveSerial(cmd, BROWSER_GROUP), requireArg(url, 'url')))
      }),
    new Command('refresh')
      .description('Reload the current page')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserRefresh(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('go-back')
      .description('Go back in the browser history')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserGoBack(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('go-forward')
      .description('Go forward in the browser history')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserGoForward(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('input')
      .argument('[text]')
      .description('Insert text into the focused page element (reads stdin when omitted)')
      .action(async (text: string | undefined, _options: OptionValues, cmd: Command) => {
        const value = await readInputText(text, 'devicebase browser -s <serialno> input')
        printEnvelope(await createClient().browserInput(resolveSerial(cmd, BROWSER_GROUP), value))
      }),
    new Command('click')
      .argument('<selector>')
      .description('Click the element matching a CSS selector')
      .action(async (selector: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserClick(resolveSerial(cmd, BROWSER_GROUP), requireArg(selector, 'selector')))
      }),
    new Command('fill')
      .argument('<selector>')
      .argument('<text>')
      .description('Clear the element matching a CSS selector and type into it')
      .action(async (selector: string, text: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserFill(
          resolveSerial(cmd, BROWSER_GROUP),
          requireArg(selector, 'selector'),
          requireArg(text, 'value'),
        ))
      }),
    new Command('select')
      .argument('<selector>')
      .argument('<value>')
      .description('Select an option inside the element matching a CSS selector')
      .action(async (selector: string, value: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserSelect(
          resolveSerial(cmd, BROWSER_GROUP),
          requireArg(selector, 'selector'),
          requireArg(value, 'value'),
        ))
      }),
    new Command('text')
      .argument('<selector>')
      .description('Get the text content of an element')
      .action(async (selector: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserText(resolveSerial(cmd, BROWSER_GROUP), requireArg(selector, 'selector')))
      }),
    new Command('attribute')
      .argument('<selector>')
      .argument('<name>')
      .description('Get an attribute value of an element')
      .action(async (selector: string, name: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserAttribute(
          resolveSerial(cmd, BROWSER_GROUP),
          requireArg(selector, 'selector'),
          requireArg(name, 'attribute'),
        ))
      }),
    new Command('exists')
      .argument('<selector>')
      .description('Report whether at least one element matches the selector')
      .action(async (selector: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserExists(resolveSerial(cmd, BROWSER_GROUP), requireArg(selector, 'selector')))
      }),
    new Command('execute')
      .argument('<js>')
      .description('Evaluate JavaScript in the page (danger tier, same as shell access)')
      .action(async (script: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserExecute(resolveSerial(cmd, BROWSER_GROUP), requireArg(script, 'script')))
      }),
    new Command('hotkey')
      .argument('<keys...>')
      .description('Press the given keys together, e.g. "hotkey Meta a"')
      .action(async (keys: string[], _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserHotkey(resolveSerial(cmd, BROWSER_GROUP), keys))
      }),
    new Command('state')
      .description('Show the browser state (url, title, viewport, tab count)')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserState(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('tabs')
      .description('List the open browser tabs')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserTabs(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('tab-open')
      .argument('<url>')
      .description('Open a new tab and navigate it to the URL')
      .action(async (url: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserTabOpen(resolveSerial(cmd, BROWSER_GROUP), requireArg(url, 'url')))
      }),
    new Command('tab-close')
      .argument('<id>')
      .description('Close the tab with the given id')
      .action(async (tabId: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserTabClose(resolveSerial(cmd, BROWSER_GROUP), requireArg(tabId, 'tab_id')))
      }),
    new Command('tab-close-all')
      .description('Close every tab and land on a fresh about:blank tab')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserTabCloseAll(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('tab-switch')
      .argument('<id>')
      .description('Focus the tab with the given id')
      .action(async (tabId: string, _options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserTabSwitch(resolveSerial(cmd, BROWSER_GROUP), requireArg(tabId, 'tab_id')))
      }),
    new Command('launch')
      .description('Launch the browser instance (start CDP)')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserLaunch(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    new Command('close')
      .description('Close the browser instance (stop CDP)')
      .action(async (_options: OptionValues, cmd: Command) => {
        printEnvelope(await createClient().browserClose(resolveSerial(cmd, BROWSER_GROUP)))
      }),
    createScreenshotCommand(BROWSER_GROUP),
  ]

  for (const command of commands) {
    group.addCommand(command)
  }

  return group
}
