import { Command } from 'commander'
import { createClient, printResult } from './helpers.js'

/**
 * The `user` group — the account the API key belongs to, rather than a device.
 *
 * Every other group here drives a device with `-s`; this one drives nothing.
 * Neither command takes a serialno or any other argument: the key says who is
 * asking, and it can only ever be your own account.
 *
 * `checkin` is the one built for automation — a second run the same day answers
 * "今日已签到" instead of failing, so a daily scheduled task can run it
 * unconditionally.
 */
export const USER_GROUP = 'user'

export function createUserCommand(): Command {
  return new Command(USER_GROUP)
    .description('Your own account: profile and daily check-in')
    .addCommand(
      new Command('info')
        .description('Show your name, phone, points and registration date')
        .action(async () => {
          printResult(await createClient().userInfo())
        }),
    )
    .addCommand(
      new Command('checkin')
        .description('Claim today\'s points (once per day; safe to re-run)')
        .action(async () => {
          printResult(await createClient().userCheckin())
        }),
    )
}
