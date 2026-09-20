import type { OptionValues } from 'commander'
import type { ListDevicesRequest } from '../models.js'
import { Command } from 'commander'
import { createClient, fail, parseIntegerToken, printResult } from './helpers.js'

export const LIST_DEVICES_COMMAND = 'list-devices'

const DEFAULT_LIMIT = 10

/**
 * Device discovery — the one command that is not part of a platform group, and
 * the only one that takes no `-s/--serialno`.
 *
 * `--limit` is the single filter here that the Go CLI does not have; the
 * `/v1/devices` route supports it, so it is kept and defaults to 10.
 */
export function createListDevicesCommand(): Command {
  return new Command(LIST_DEVICES_COMMAND)
    .description('List devices accessible by the current user')
    .option(
      '--keyword <keyword>',
      'Filter by keyword: substring match (case-insensitive) across name/alias_name/brand/model/serialno/device_sn/type/os_type/os_version/location/operator',
    )
    .option('--state <state>', 'Filter by state (busy/free/offline)')
    .option(
      '--type <type>',
      'Filter by category (mobile|browser|computer) or system type (android|harmonyos|ios|macos|windows|linux|chrome|chromium|edge|other)',
    )
    .option('--limit <number>', 'Maximum number of devices to return', String(DEFAULT_LIMIT))
    .action(async (options: OptionValues) => {
      const { keyword, state, type, limit } = options as {
        keyword?: string
        state?: string
        type?: string
        limit?: string
      }

      const parsedLimit = parseIntegerToken(
        limit ?? String(DEFAULT_LIMIT),
        `invalid limit "${limit}", expected a positive integer`,
      )
      if (parsedLimit <= 0) {
        return fail(`--limit must be greater than 0, got ${parsedLimit}`)
      }

      // Undefined filters are dropped when the query string is built.
      const request: ListDevicesRequest = { keyword, state, type, limit: parsedLimit }
      printResult(await createClient().listDevices(request))
    })
}
