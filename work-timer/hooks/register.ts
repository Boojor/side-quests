// work-timer: counts minutes while Claude works in the main conversation.
// - Status line under the prompt once a turn passes 2 minutes.
// - After 10 minutes with nothing shown to you: a notification for you, and a hidden
//   reminder for Claude attached to the next tool result. Repeats every 10 more minutes.
// - "work timer off" / "work timer on" switches it for one chat.
// Every hook falls through to the engine on any error, so a bug here never blocks work.

import type { Hook, Register } from 'claude-code'

import {
  MIN,
  endTurn,
  endWait,
  hasVisibleText,
  idle,
  isShownTool,
  isWaitTool,
  isWarningDue,
  markShown,
  minutes,
  notification,
  offSwitch,
  reminder,
  startTurn,
  startWait,
  statusText,
  warn,
} from './timer'

/** The engine interface `$` every hook receives. */
type Dollar = Parameters<Hook<'session.start'>>[0]

/** This session's timer. Module scope: a hot reload starts it over, which is harmless. */
let t = idle()

/** Main-loop tool calls now waiting on you (permission prompt or question), by tool_use_id. */
let waitingIds = new Set<string>()

// Notify the user. The desktop app has no terminal, so $.ui.notify answers `no-surface` there;
// macOS's own notifier (osascript, text passed as arguments, never in the script) covers it.
async function notifyUser($: Dollar, text: string): Promise<void> {
  try {
    $.ui.toast(text, { timeoutMs: 15_000 })
  } catch {}
  let isSent = false
  try {
    const sent = await $.ui.notify(text, { title: 'Work timer', key: 'work-timer' })
    isSent = sent.isSent === true
  } catch {}
  if (isSent) return
  try {
    await $.process.run(
      [
        '/usr/bin/osascript',
        '-e', 'on run argv',
        // The whole message goes in the TITLE: a notification raised by osascript shows the
        // word "Notification" in the body slot, whatever is passed (tested on macOS).
        '-e', 'display notification "" with title (item 1 of argv)',
        '-e', 'end run',
        `Work timer: ${text}`,
      ],
      { timeoutMs: 10_000 },
    )
  } catch {}
}

// Shared check, from the minute ticker and after every tool call.
async function check($: Dollar): Promise<void> {
  const now = await $.clock.now()
  if (isWarningDue(t, now)) {
    t = warn(t)
    await notifyUser($, notification(minutes(now - t.lastShownAt)))
  }
  $.ui.status(statusText(t, now))
}

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    t = idle()
    waitingIds = new Set()
    // One ticker for the whole session; it does nothing while no turn runs.
    $.clock.every(MIN, () => {
      check($).catch(() => {})
    })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('prompt.submit', ($, e, next) => {
    const sw = offSwitch(e.text)
    if (sw === 'off' && !t.isOff) {
      t = { ...t, isOff: true }
      $.ui.status(undefined)
      $.ui.toast('Work timer is off for this chat. Say "work timer on" to bring it back.')
    } else if (sw === 'on' && t.isOff) {
      t = { ...t, isOff: false }
      $.ui.toast('Work timer is on for this chat.')
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      t = startTurn(t, await $.clock.now())
      waitingIds = new Set()
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      t = endTurn(t)
      waitingIds = new Set()
      $.ui.status(undefined)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Claude wrote you a visible line in the main conversation: that counts as shown.
  on('session.append', async ($, e, next) => {
    if (
      e.agentId === undefined &&
      e.door === 'response' &&
      e.message.role === 'assistant' &&
      hasVisibleText(e.message.content as readonly { type: string; text?: unknown }[])
    ) {
      t = markShown(t, await $.clock.now())
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // A permission prompt is about to open for a main-loop call: pause the clock until the call
  // finishes (you answered). Waiting for your click is not Claude working quietly.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (
      e.agentId === undefined &&
      e.tool_use_id !== undefined &&
      verdict.decision === 'ask' &&
      !waitingIds.has(e.tool_use_id)
    ) {
      waitingIds.add(e.tool_use_id)
      t = startWait(t)
      $.ui.status(statusText(t, await $.clock.now()))
    }
    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const id = e.tool_use_id
    // A question or plan for you waits on you too.
    if (id !== undefined && isWaitTool(e.tool) && !waitingIds.has(id)) {
      waitingIds.add(id)
      t = startWait(t)
    }
    let ran
    try {
      ran = await next(e)
    } finally {
      if (id !== undefined && waitingIds.delete(id)) t = endWait(t, await $.clock.now())
    }
    if (ran.deny !== undefined || ran.isError === true) return ran

    if (isShownTool(e.tool)) t = markShown(t, await $.clock.now())
    await check($)

    if (!t.isReminderDue || t.isOff) return ran
    t = { ...t, isReminderDue: false }
    const quiet = minutes((await $.clock.now()) - t.lastShownAt)
    return { ...ran, context: [...(ran.context ?? []), reminder(quiet)] }
  }).catch(($, e, next) => next(e))
}
