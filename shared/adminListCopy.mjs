/** Short admin help text — shown on list pages. */

import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from './worldCupBallGiveaway.mjs'

export const USERS_TAB_HELP = {
  users: {
    title: 'Users (contacts)',
    body:
      'Everyone who gave you their name and email on the site — paid ticket buyers, free online entrants, and shirt giveaway sign-ups. Use the competition menu to scope counts to one main prize draw (Signed Legacy Bundle or Michael Jackson Signed Album).',
  },
  entries: {
    title: 'Quiz entries (skill answers)',
    body:
      'Each time someone submits the skill quiz for a main prize draw. Paid customers submit after payment; free routes submit after verification. Pick the competition from the menu — Signed Legacy Bundle and MJ Album run in parallel with separate periods and draw pools.',
  },
}

export const TICKETS_PAGE_HELP =
  'Each row is one purchase (order) for the selected main prize draw: bundle, draw numbers issued, payment status, and competition period. Signed Legacy Bundle and MJ Album tickets stay separate.'

export const ENTRY_ATTEMPTS_PAGE_HELP =
  `Security and abuse log for free routes — filter by competition/route, flow, or outcome. ${WORLD_CUP_BALL_GIVEAWAY_LABEL} logs quiz starts (world_cup_ball_start), results (world_cup_ball_submit), and delivery form saves (world_cup_ball_claim). Shirt giveaway and Legacy free online log separately.`

export const SUBMISSIONS_PAGE_HELP =
  `Giveaway entries for the selected side promotion. Free Ronaldo shirt: direct sign-ups and automatic consolation rows from wrong Legacy quiz answers. ${WORLD_CUP_BALL_GIVEAWAY_LABEL}: one row per winner after they submit the delivery form (name, email, phone, UK address in Details). Pick the giveaway from the menu when you run more than one in parallel.`

/** Where World Cup Ball winner data lives in admin — shown on Giveaways hub and filtered list pages. */
export const WORLD_CUP_BALL_ADMIN_ROUTES = {
  winners: '/admin/submissions?competition=world_cup_ball_giveaway',
  monthlyDraw: '/admin/world-cup-ball-draw',
  failedAttempts: '/admin/world-cup-ball-failed',
  entryLog: '/admin/entry-attempts?competition=world_cup_ball_giveaway',
  testEmail: '/admin/test-email',
  liveRules: '/world-cup-ball-giveaway',
  devClaimForm: '/?preview-wc-ball=won',
}

export const WORLD_CUP_BALL_ADMIN_HELP = {
  hub:
    `Instant skill win — no draw. When someone answers all 10 questions correctly, they complete the delivery form in the entry modal. Failed attempts get one automatic entry into the monthly World Cup Ball draw (June / July 2026) — run that draw in WC Ball draw admin. Winner delivery details appear under Giveaway entries.`,
  submissions:
    'Each row is a confirmed winner who submitted delivery details. Win reference is WC-… in the Entry # column. Open Details for phone, UK address, age band, and guardian info (16–17). Approve when ready to ship the ball.',
  entryLog:
    'world_cup_ball_start = quiz opened. world_cup_ball_submit = finished quiz (outcome won, lost, or disqualified). world_cup_ball_monthly_draw = automatic monthly draw entry after a failed attempt. world_cup_ball_claim = delivery form saved successfully. world_cup_ball_failed_contact = email saved after a failed attempt.',
  failedAttempts:
    'One row per failed skill quiz (lost or disqualified). Email is optional — entrants can save it on the fail screen after their attempt. Draw entry # links to the monthly draw pool when awarded.',
}
