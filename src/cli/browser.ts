import type { OptionValues } from 'commander'
import { Command } from 'commander'
import {
  createClient,
  resolveSerial,
  send,
} from './helpers.js'

/**
 * Browser platform commands — everything maps to the platform browser open
 * API: /api/browser/{serial}/{action...}, where `serial` is the registered
 * browser device UUID (see "devicebase list-devices --type browser").
 *
 * HTTP methods, body and query field names below are the contract shared
 * with the Go CLI and mirror the TestClaw service route source.
 */

export const BROWSER_GROUP = 'browser'

const BROWSER_HINT = 'Hint: run "devicebase list-devices --type browser" to find the target browser device UUID'

function browserSerial(cmd: Command): string {
  return resolveSerial(cmd, BROWSER_HINT)
}

// --- Actions --------------------------------------------------------------

function navigate(url: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/navigate`, { body: { url } }))
}

function refresh(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/refresh`))
}

function goBack(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/go_back`))
}

function goForward(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/go_forward`))
}

// Raw text insertion into the focused element (Input.insertText on the client).
function inputText(text: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/input`, { body: { text } }))
}

function click(selector: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/click`, { body: { selector } }))
}

function fill(selector: string, text: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/fill`, { body: { selector, value: text } }))
}

function select(selector: string, value: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/select`, { body: { selector, value } }))
}

function text(selector: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('GET', `/api/browser/${serial}/text`, { query: { selector } }))
}

function attribute(selector: string, attributeName: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('GET', `/api/browser/${serial}/attribute`, { query: { selector, attribute: attributeName } }))
}

function exists(selector: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('GET', `/api/browser/${serial}/exists`, { query: { selector } }))
}

function execute(script: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/execute`, { body: { script } }))
}

function hotkey(keys: string[], _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/hotkey`, { body: { keys } }))
}

function state(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('GET', `/api/browser/${serial}/state`))
}

function tabs(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('GET', `/api/browser/${serial}/tabs`))
}

function tabOpen(url: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/tab/open`, { body: { url } }))
}

// tab close/switch id field is tab_id on the wire.
function tabClose(tabId: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/tab/close`, { body: { tab_id: tabId } }))
}

function tabCloseAll(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/tab/close_all`))
}

function tabSwitch(tabId: string, _options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/tab/switch`, { body: { tab_id: tabId } }))
}

function launch(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/launch`))
}

function close(_options: OptionValues, cmd: Command): void {
  const serial = browserSerial(cmd)
  send(createClient().requestJson('POST', `/api/browser/${serial}/close`))
}

// --- Registration ---------------------------------------------------------

export function registerBrowserCommands(parent: Command): Command {
  const group = new Command(BROWSER_GROUP)
  group
    .description('Control a browser device via /api/browser/{serial} (serial is the registered browser device UUID)')
    .option('-s, --serial <serial>', 'Browser device UUID')
    .addCommand(
      new Command('navigate')
        .argument('<url>')
        .description('Navigate to a URL')
        .action(navigate),
    )
    .addCommand(
      new Command('refresh')
        .description('Refresh the current page')
        .action(refresh),
    )
    .addCommand(
      new Command('go-back')
        .description('Go back in history')
        .action(goBack),
    )
    .addCommand(
      new Command('go-forward')
        .description('Go forward in history')
        .action(goForward),
    )
    .addCommand(
      new Command('input')
        .argument('<text>')
        .description('Insert text into the focused element')
        .action(inputText),
    )
    .addCommand(
      new Command('click')
        .argument('<selector>')
        .description('Click the element matching the CSS selector')
        .action(click),
    )
    .addCommand(
      new Command('fill')
        .argument('<selector>')
        .argument('<text>')
        .description('Fill the element matching the CSS selector with text')
        .action(fill),
    )
    .addCommand(
      new Command('select')
        .argument('<selector>')
        .argument('<value>')
        .description('Select an option in the element matching the CSS selector')
        .action(select),
    )
    .addCommand(
      new Command('text')
        .argument('<selector>')
        .description('Get the text of the element matching the CSS selector')
        .action(text),
    )
    .addCommand(
      new Command('attribute')
        .argument('<selector>')
        .argument('<name>')
        .description('Get an attribute value of the element matching the CSS selector')
        .action(attribute),
    )
    .addCommand(
      new Command('exists')
        .argument('<selector>')
        .description('Check whether an element matching the CSS selector exists')
        .action(exists),
    )
    .addCommand(
      new Command('execute')
        .argument('<js>')
        .description('Execute a JavaScript snippet in the page')
        .action(execute),
    )
    .addCommand(
      new Command('hotkey')
        .argument('<keys...>')
        .description('Send a keyboard shortcut, e.g. "hotkey ctrl shift t"')
        .action(hotkey),
    )
    .addCommand(
      new Command('state')
        .description('Get the browser state (url, title, viewport, tab count)')
        .action(state),
    )
    .addCommand(
      new Command('tabs')
        .description('List the open tabs')
        .action(tabs),
    )
    .addCommand(
      new Command('tab-open')
        .argument('<url>')
        .description('Open a new tab with the given URL')
        .action(tabOpen),
    )
    .addCommand(
      new Command('tab-close')
        .argument('<id>')
        .description('Close the tab with the given id')
        .action(tabClose),
    )
    .addCommand(
      new Command('tab-close-all')
        .description('Close all tabs (a fresh blank tab is left open)')
        .action(tabCloseAll),
    )
    .addCommand(
      new Command('tab-switch')
        .argument('<id>')
        .description('Switch to the tab with the given id')
        .action(tabSwitch),
    )
    .addCommand(
      new Command('launch')
        .description('Launch (start) the browser instance')
        .action(launch),
    )
    .addCommand(
      new Command('close')
        .description('Close the browser instance')
        .action(close),
    )
  parent.addCommand(group)
  return group
}
