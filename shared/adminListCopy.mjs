/** Short admin help text — shown on list pages. */

export const USERS_TAB_HELP = {
  users: {
    title: 'Users (contacts)',
    body:
      'Everyone who gave you their name and email on the site — paid ticket buyers, free online entrants, and shirt giveaway sign-ups. This is the person record, not the quiz itself. One user can have several tickets or entries.',
  },
  entries: {
    title: 'Quiz entries (skill answers)',
    body:
      'Each time someone submits the skill quiz for the Ronaldo Legacy competition. Paid customers submit after payment; free routes submit after verification. “Auto-correct” is the system grade; “Valid” is your manual approval for the draw. Only correct, qualified entries count toward the weighted draw pool.',
  },
}

export const TICKETS_PAGE_HELP =
  'Each row is one purchase (order): bundle, how many draw numbers were issued, and payment status. Ticket numbers are the individual draw chances for that order.'

export const ENTRY_ATTEMPTS_PAGE_HELP =
  'Security and abuse log for free routes (legacy free online and shirt giveaway) — VPN blocks, duplicate device, rate limits. This is not the skill quiz list; see Quiz entries for answers and draw qualification.'

export const SUBMISSIONS_PAGE_HELP =
  'Free Ronaldo shirt giveaway sign-ups (video upload or qualification answer). Approve or reject for your own review process — separate from paid draw tickets and quiz entries.'
