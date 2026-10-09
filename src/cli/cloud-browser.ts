import type { OptionValues } from 'commander'
import type { CreateCloudBrowserRequest } from '../models.js'
import { Command } from 'commander'
import { createClient, fail, parseIntegerToken, printResult, requireArg } from './helpers.js'

/**
 * Cloud browser lifecycle commands, registered inside the browser group.
 *
 * These are the only browser commands that address no existing device: `create`
 * makes one (there is no serialno yet — that is the point), and the other three
 * take the identifier as an argument rather than through `-s`, because the
 * handle you hold at that moment is the one `create` printed.
 *
 * Unlike the Go CLI, where the four are separate factories, this one returns
 * them as a list — the TS group builds a command array before adding it, so a
 * single factory keeps the registration site a one-liner.
 */

/** Mirrors the server's bound (devices.name is VARCHAR(200); the API takes half). */
const NAME_MAX_LENGTH = 100

/** The node's parseWindowSize shape, which the API validates against as well. */
const WINDOW_SIZE_PATTERN = /^\d{1,5}x\d{1,5}$/

export const CLOUD_BROWSER_COMMANDS = ['create', 'delete', 'status', 'quota'] as const

/** Blank or oversized names are rejected here, before the round trip. */
function validatedName(name: string | undefined): { name?: string } {
  if (name === undefined) {
    return {}
  }
  const trimmed = name.trim()
  if (trimmed === '') {
    return fail('--name cannot be empty')
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return fail(`--name is longer than ${NAME_MAX_LENGTH} characters`)
  }
  return { name: trimmed }
}

/** Wait bounds — the server's own (it rejects anything outside them). */
const DEFAULT_WAIT_SECONDS = 15
const MAX_WAIT_SECONDS = 60

function validatedWait(wait: string | undefined): { waitSeconds?: number } {
  if (wait === undefined) {
    return {}
  }
  const seconds = parseIntegerToken(
    wait,
    `--wait must be an integer between 0 and ${MAX_WAIT_SECONDS}, got "${wait}"`,
  )
  if (seconds < 0 || seconds > MAX_WAIT_SECONDS) {
    return fail(`--wait must be between 0 and ${MAX_WAIT_SECONDS} seconds, got ${seconds}`)
  }
  return { waitSeconds: seconds }
}

function validatedWindowSize(windowSize: string | undefined): { windowSize?: string } {
  if (windowSize === undefined) {
    return {}
  }
  const size = windowSize.trim()
  if (!WINDOW_SIZE_PATTERN.test(size)) {
    return fail(`--window-size must look like 1366x768, got "${windowSize}"`)
  }
  return { windowSize: size }
}

export function createCloudBrowserCommands(): Command[] {
  return [
    new Command('create')
      .description('Create a cloud browser on the platform\'s cluster (always headless)')
      .option('--name <name>', `Display name for the browser (max ${NAME_MAX_LENGTH} characters)`)
      .option('--window-size <WxH>', 'Window size, e.g. 1366x768')
      // No commander default: when the flag is absent nothing is sent and the
      // server's own default (15) governs. Restating it here would silently
      // pin the CLI to today's number.
      .option('--wait <seconds>', `Seconds to wait for it to register before printing (default ${DEFAULT_WAIT_SECONDS}, max ${MAX_WAIT_SECONDS}; 0 = return at once)`)
      .action(async (options: OptionValues) => {
        const { name, windowSize, wait } = options as {
          name?: string
          windowSize?: string
          wait?: string
        }

        const request: CreateCloudBrowserRequest = {
          ...validatedName(name),
          ...validatedWindowSize(windowSize),
          // Only forwarded when the flag was given: the server's own default
          // governs otherwise, so this command does not restate it.
          ...validatedWait(wait),
        }

        printResult(await createClient().cloudBrowserCreate(request))
      }),

    new Command('delete')
      .argument('<serialno>')
      .description('Delete a cloud browser (irreversible)')
      .action(async (serialno: string) => {
        printResult(await createClient().cloudBrowserDelete(requireArg(serialno, 'serialno')))
      }),

    new Command('status')
      .argument('<serial>')
      .description('Check whether a created browser has come up yet')
      .action(async (serial: string) => {
        printResult(await createClient().cloudBrowserStatus(requireArg(serial, 'serial')))
      }),

    new Command('quota')
      .description('Show how many cloud browsers you may still create')
      .action(async () => {
        printResult(await createClient().cloudBrowserQuota())
      }),
  ]
}
