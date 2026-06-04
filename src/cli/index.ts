#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { Command } from 'commander'
import { VERSION } from '../version.js'
import { createClient, getSerial, parseBounds, parsePoint, printResult } from './helpers.js'

const program = new Command()

program
  .name('devicebase')
  .description('Devicebase - A CLI tool for device control via HTTP API')
  .version(VERSION)
  .option('-s, --serial <serial>', 'Device serial number')

function serialFromCmd(cmd: Command): string {
  const parentOpts = cmd.parent?.opts() ?? {}
  return getSerial(parentOpts)
}

// --- tap ---
program
  .command('tap <coords>')
  .description('Tap on the device screen')
  .action((coords, cmd) => {
    const serial = serialFromCmd(cmd)
    const p = parsePoint(coords)
    const client = createClient()
    client.tap(serial, p).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- double-tap ---
program
  .command('double-tap <coords>')
  .description('Double tap on the device screen')
  .action((coords, cmd) => {
    const serial = serialFromCmd(cmd)
    const p = parsePoint(coords)
    const client = createClient()
    client.doubleTap(serial, p).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- long-press ---
program
  .command('long-press <coords>')
  .description('Long press on the device screen')
  .action((coords, cmd) => {
    const serial = serialFromCmd(cmd)
    const p = parsePoint(coords)
    const client = createClient()
    client.longPress(serial, p).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- swipe ---
program
  .command('swipe <coords>')
  .description('Swipe on the device screen')
  .action((coords, cmd) => {
    const serial = serialFromCmd(cmd)
    const b = parseBounds(coords)
    const client = createClient()
    client.swipe(serial, b).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- back ---
program
  .command('back')
  .description('Press the back button')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.back(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- home ---
program
  .command('home')
  .description('Press the home button')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.home(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- launch-app ---
program
  .command('launch-app <app_name>')
  .description('Launch an application on the device')
  .action((appName, cmd) => {
    if (!appName) {
      console.error('Error: app_name cannot be empty')
      process.exit(1)
    }
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.launchApp(serial, appName).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- input ---
program
  .command('input <text>')
  .description('Input text on the device')
  .action((text, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.inputText(serial, text).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- clear-text ---
program
  .command('clear-text')
  .description('Clear text in the current input field')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.clearText(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- current-app ---
program
  .command('current-app')
  .description('Get the current foreground app')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.getCurrentApp(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- dump-hierarchy ---
program
  .command('dump-hierarchy')
  .description('Dump the UI hierarchy')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.dumpHierarchy(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- device-info ---
program
  .command('device-info')
  .description('Get device information')
  .action((_args, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.getDeviceInfo(serial).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

// --- screenshot ---
program
  .command('screenshot')
  .description('Take a screenshot of the device')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .action((cmdOptions, cmd) => {
    const serial = serialFromCmd(cmd)
    const client = createClient()
    client.getScreenshot(serial).then((buffer: ArrayBuffer) => {
      const data = new Uint8Array(buffer)
      if (cmdOptions.output) {
        writeFileSync(cmdOptions.output, data)
        console.log(`Screenshot saved to ${cmdOptions.output}`)
      }
      else {
        process.stdout.write(data)
      }
    }).catch((err: Error) => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  })

// --- list-devices ---
program
  .command('list-devices')
  .description('List all devices')
  .option('--keyword <keyword>', 'Filter by keyword (brand/model/serial/name)')
  .option('--state <state>', 'Filter by state (busy/free/offline)')
  .option('--limit <number>', 'Maximum number of devices to return', '10')
  .action((cmdOptions) => {
    const client = createClient()
    const params: { keyword?: string, state?: string, limit?: number } = {}
    if (cmdOptions.keyword)
      params.keyword = cmdOptions.keyword
    if (cmdOptions.state)
      params.state = cmdOptions.state
    const limit = Number.parseInt(cmdOptions.limit, 10)
    if (limit > 0)
      params.limit = limit

    client.listDevices(params).then(
      data => printResult(data, null),
      err => printResult(null, err),
    )
  })

program.parse()
