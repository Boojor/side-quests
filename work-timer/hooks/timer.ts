// Pure rules of the work timer: no engine calls here, so the tests can check them directly.
// Why this mod exists: once, 35 minutes passed with nothing shown.

export const MIN = 60_000
/** Nothing shown for this long: notify you and remind Claude. Repeats every time this much more passes. */
export const WARN_AFTER = 10 * MIN
/** The status line appears only once a turn has run this long, so short turns stay quiet. */
export const STATUS_AFTER = 2 * MIN

export type Timer = {
  isTurnActive: boolean
  turnStartedAt: number
  lastShownAt: number
  warnings: number
  isReminderDue: boolean
  isOff: boolean
  /** Open waits on you (a permission prompt, a question). While above 0 the clock is paused. */
  waiting: number
}

export const idle = (): Timer => ({
  isTurnActive: false,
  turnStartedAt: 0,
  lastShownAt: 0,
  warnings: 0,
  isReminderDue: false,
  isOff: false,
  waiting: 0,
})

export const minutes = (ms: number): number => Math.max(0, Math.floor(ms / MIN))

export const startTurn = (t: Timer, now: number): Timer => ({
  ...t,
  isTurnActive: true,
  turnStartedAt: now,
  lastShownAt: now,
  warnings: 0,
  isReminderDue: false,
  waiting: 0,
})

export const endTurn = (t: Timer): Timer => ({ ...t, isTurnActive: false, isReminderDue: false, waiting: 0 })

/** A permission prompt or question opened: the ball is in your court, so the clock pauses. */
export const startWait = (t: Timer): Timer => ({ ...t, waiting: t.waiting + 1, isReminderDue: false })

/** You answered (the waiting tool call finished). The quiet time restarts from your answer. */
export const endWait = (t: Timer, now: number): Timer => {
  const waiting = Math.max(0, t.waiting - 1)
  return waiting > 0 ? { ...t, waiting } : { ...markShown(t, now), waiting }
}

export const markShown = (t: Timer, now: number): Timer => ({ ...t, lastShownAt: now, warnings: 0, isReminderDue: false })

/** Whether a new warning is due now. The next one comes WARN_AFTER after the last. */
export const isWarningDue = (t: Timer, now: number): boolean =>
  t.isTurnActive && !t.isOff && t.waiting === 0 && now - t.lastShownAt >= WARN_AFTER * (t.warnings + 1)

export const warn = (t: Timer): Timer => ({ ...t, warnings: t.warnings + 1, isReminderDue: true })

export const statusText = (t: Timer, now: number): string | undefined => {
  if (!t.isTurnActive || t.isOff || now - t.turnStartedAt < STATUS_AFTER) return undefined
  const working = minutes(now - t.turnStartedAt)
  if (t.waiting > 0) return `⏱ ${working} min working · waiting for your OK`
  const quiet = minutes(now - t.lastShownAt)
  const shown = quiet === 0 ? 'last shown just now' : `last shown ${quiet} min ago`
  return `⏱ ${working} min working · ${shown}`
}

/** "work timer off" / "work timer on" in a prompt switches it for this chat. Off wins if both. */
export const offSwitch = (text: string): 'off' | 'on' | undefined => {
  if (/\bwork[ -]?timer (off|stop)\b|\bstop (the )?work[ -]?timer\b/i.test(text)) return 'off'
  if (/\bwork[ -]?timer (on|back)\b/i.test(text)) return 'on'
  return undefined
}

/** Tools that wait for your answer: the clock pauses while they run. */
const WAIT_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

export const isWaitTool = (tool: string): boolean => WAIT_TOOLS.has(tool)

/** Tools that put something in front of you. A call to one counts as "shown". */
const SHOWN_TOOLS = new Set([
  'SendUserFile',
  'AskUserQuestion',
  'Artifact',
  'mcp__ccd_turn__wrap_up',
  'mcp__ccd_view__show_pane',
  'mcp__visualize__show_widget',
  'mcp__Claude_Browser__preview_start',
  'mcp__claude-artifacts__publish_version',
  'mcp__claude-artifacts__publish_files',
  'mcp__claude-artifacts__edit_version',
])

export const isShownTool = (tool: string): boolean => SHOWN_TOOLS.has(tool)

/** True when an assistant row holds visible text: Claude wrote you a line. */
export const hasVisibleText = (content: readonly { type: string; text?: unknown }[]): boolean =>
  content.some(b => b.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0)

export const reminder = (quietMinutes: number): string =>
  `work-timer: ${quietMinutes} minutes since the user last saw anything from you in this turn. ` +
  'Show them something to look at (a render, a draft, a page), or give a one-line status saying what is left and how long it will take. ' +
  'Do it before the next long step.'

export const notification = (quietMinutes: number): string =>
  `Claude has worked ${quietMinutes} min with nothing to show you.`
