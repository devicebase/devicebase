#!/usr/bin/env node
import process from 'node:process'
import { Command, CommanderError } from 'commander'
import { VERSION } from '../version.js'
import { createBrowserCommand } from './browser.js'
import { createComputerCommand } from './computer.js'
import { CliError } from './helpers.js'
import { createListDevicesCommand } from './list-devices.js'
import { createMobileCommand } from './mobile.js'

/**
 * Root command tree:
 *
 *   devicebase list-devices        device discovery (no serial required)
 *   devicebase mobile    -s <serialno>   Android / HarmonyOS / iOS — /v1/{action}/{serialno}
 *   devicebase browser   -s <serialno>   Chrome/CDP — /api/browser/{serialno}/{action}
 *   devicebase computer  -s <serialno>   desktop — /api/computer/{serialno}/{action}
 *
 * The root also declares `-s/--serialno`, bound to the same value as each
 * group's, so the flag may precede the group:
 *
 *   devicebase -s <serialno> mobile tap 100,200
 *   devicebase mobile -s <serialno> tap 100,200
 */
export function createCliProgram(): Command {
  const program = new Command()
    .name('devicebase')
    .description('Devicebase - A CLI tool for device control via HTTP API')
    .version(VERSION)
    .option('-s, --serialno <serialno>', 'Platform serialno (sn from device list)')

  for (const command of [
    createListDevicesCommand(),
    createMobileCommand(),
    createBrowserCommand(),
    createComputerCommand(),
  ]) {
    program.addCommand(command)
  }

  // Every command routes its exit through an exception, so `run` owns the exit
  // code instead of commander terminating mid-write.
  applyExitOverride(program)

  return program
}

function applyExitOverride(command: Command): void {
  command.exitOverride()
  for (const child of command.commands) {
    applyExitOverride(child)
  }
}

/**
 * Run the CLI, mapping failures onto an exit code.
 *
 * Nothing here calls `process.exit`: writing to a pipe is asynchronous on POSIX,
 * so exiting immediately can truncate a message (or drop JSON still queued on
 * stdout). Setting `process.exitCode` lets the process end once the streams have
 * drained.
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  try {
    await createCliProgram().parseAsync(argv)
  }
  catch (err) {
    if (err instanceof CliError) {
      console.error(`Error: ${err.message}`)
      process.exitCode = err.exitCode
      return
    }
    if (err instanceof CommanderError) {
      // Help, version and usage errors: commander has already written them.
      process.exitCode = err.exitCode
      return
    }
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  }
}

// Auto-run only when executed directly (node dist/bin/index.js or
// vite-node src/cli/index.ts). Under vitest the module is imported to build the
// program for command-registration tests, so parsing is skipped.
if (!process.env.VITEST) {
  void run()
}
