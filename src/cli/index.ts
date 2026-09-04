#!/usr/bin/env node
import process from 'node:process'
import { Command } from 'commander'
import { VERSION } from '../version.js'
import { registerBrowserCommands } from './browser.js'
import { registerComputerCommands } from './computer.js'
import { createClient, printResult } from './helpers.js'
import { registerMobileAliases, registerMobileGroup } from './mobile.js'

/**
 * Root command tree:
 *
 *   devicebase list-devices ...                common top-level command
 *   devicebase mobile ...                      /v1 mobile platform group
 *   devicebase browser ...                     /api/browser/{serial} platform group
 *   devicebase computer ...                    /api/computer/{serial} platform group
 *   devicebase tap|double-tap|... (deprecated) top-level aliases of the old flat CLI
 *
 * The global -s/--serial is kept for the deprecated top-level aliases only;
 * the platform groups carry their own group-level -s/--serial.
 */
export function createCliProgram(): Command {
  const program = new Command()

  program
    .name('devicebase')
    .description('Devicebase - control mobile, browser and computer devices via the Devicebase HTTP API')
    .version(VERSION)
    .option('-s, --serial <serial>', 'Device serial number (for the deprecated top-level commands)')

  // Platform command groups (each with its own persistent -s/--serial).
  registerMobileGroup(program)
  registerBrowserCommands(program)
  registerComputerCommands(program)

  registerListDevices(program)

  // Deprecated aliases of the original flat CLI — same actions as the
  // `mobile` group, wired to the root so `devicebase -s <serial> tap ...`
  // keeps working unchanged.
  registerMobileAliases(program)

  return program
}

function registerListDevices(program: Command): Command {
  return program
    .command('list-devices')
    .description('List devices (optionally filtered by platform type, keyword, state or limit)')
    .option('--type <type>', 'Filter by platform type: mobile|browser|computer|adb|hdc|ios')
    .option('--keyword <keyword>', 'Filter by keyword (brand/model/serial/name)')
    .option('--state <state>', 'Filter by state (busy/free/offline)')
    .option('--limit <number>', 'Maximum number of devices to return', '10')
    .action((options: { type?: string, keyword?: string, state?: string, limit?: string }) => {
      const client = createClient()
      const params: { keyword?: string, state?: string, limit?: number, type?: string } = {}
      if (options.type)
        params.type = options.type
      if (options.keyword)
        params.keyword = options.keyword
      if (options.state)
        params.state = options.state
      const limit = Number.parseInt(options.limit ?? '10', 10)
      if (limit > 0)
        params.limit = limit

      client.listDevices(params).then(
        data => printResult(data, null),
        err => printResult(null, err),
      )
    })
}

const program = createCliProgram()

// Auto-run only when executed directly (node dist/bin/index.js or
// vite-node src/cli/index.ts). Under vitest the module is imported to build
// the program for command-registration tests, so parsing is skipped.
if (!process.env.VITEST) {
  program.parse()
}
