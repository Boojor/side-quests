import { expect, mock, test } from 'claude-code/testing'

import { MIN, endWait, hasVisibleText, idle, isWarningDue, markShown, offSwitch, startTurn, startWait, statusText, warn } from './timer'

// ---- Pure rules ----

test('status line stays quiet for the first 2 minutes, then counts', async () => {
  const t = startTurn(idle(), 0)
  expect(statusText(t, 1 * MIN)).toBe(undefined)
  expect(statusText(t, 3 * MIN)).toBe('⏱ 3 min working · last shown 3 min ago')
  expect(statusText(markShown(t, 3 * MIN), 3 * MIN + 10_000)).toBe('⏱ 3 min working · last shown just now')
  expect(statusText({ ...t, isOff: true }, 5 * MIN)).toBe(undefined)
})

test('a warning is due at 10 minutes quiet, then every 10 more, and resets when something is shown', async () => {
  let t = startTurn(idle(), 0)
  expect(isWarningDue(t, 9 * MIN)).toBe(false)
  expect(isWarningDue(t, 10 * MIN)).toBe(true)
  t = warn(t)
  expect(isWarningDue(t, 15 * MIN)).toBe(false)
  expect(isWarningDue(t, 20 * MIN)).toBe(true)
  t = markShown(t, 20 * MIN)
  expect(isWarningDue(t, 29 * MIN)).toBe(false)
  expect(isWarningDue(t, 30 * MIN)).toBe(true)
})

test('the off switch reads the phrases, off wins', async () => {
  expect(offSwitch('work timer off')).toBe('off')
  expect(offSwitch('please stop the work timer')).toBe('off')
  expect(offSwitch('Work timer on')).toBe('on')
  expect(offSwitch('work timer on, no, work timer off')).toBe('off')
  expect(offSwitch('how does the timer work?')).toBe(undefined)
})

test('visible text means a non-empty text block', async () => {
  expect(hasVisibleText([{ type: 'text', text: 'Rendering the speed test now.' }])).toBe(true)
  expect(hasVisibleText([{ type: 'text', text: '  ' }, { type: 'tool_use' }])).toBe(false)
  expect(hasVisibleText([{ type: 'thinking' }])).toBe(false)
})

test('waiting on you pauses the clock; your answer restarts it', async () => {
  let t = startWait(startTurn(idle(), 0))
  expect(isWarningDue(t, 30 * MIN)).toBe(false)
  expect(statusText(t, 30 * MIN)).toBe('⏱ 30 min working · waiting for your OK')
  t = endWait(t, 30 * MIN)
  expect(isWarningDue(t, 39 * MIN)).toBe(false)
  expect(isWarningDue(t, 40 * MIN)).toBe(true)
})

// ---- The mod through the engine ----

const engine = (on: any, toolCall: () => unknown = () => ({ result: { stdout: 'ok' } })) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const status: (string | undefined)[] = []
  const toasts: string[] = []
  const runs: string[][] = []
  on('ui.status', (_: any, e: any) => {
    status.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } }))
  on('process.run', (_: any, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('tool.call', toolCall)
  return { clock, status, toasts, runs }
}

test('10 quiet minutes: you get a notification, Claude gets one reminder on the next tool result', async ($, on) => {
  const w = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })

  await w.clock.advance(10 * MIN)
  expect(w.runs.length).toBe(1)
  expect(w.runs[0]?.[0]).toBe('/usr/bin/osascript')
  expect(w.runs[0]).toContain('Work timer: Claude has worked 10 min with nothing to show you.')
  expect(w.status.at(-1)).toBe('⏱ 10 min working · last shown 10 min ago')

  const first = await $.tool.call({ tool: 'Bash', command: 'python3 fit.py' })
  expect(first.context?.length).toBe(1)
  expect(first.context?.[0]).toContain('10 minutes since the user last saw anything')

  const second = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(second.context).toBe(undefined)
})

test('showing something resets the clock; ending the turn clears the line', async ($, on) => {
  const w = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })

  await w.clock.advance(8 * MIN)
  await $.tool.call({ tool: 'SendUserFile', files: ['/tmp/a.mp4'], status: 'normal' })
  await w.clock.advance(8 * MIN)
  expect(w.runs.length).toBe(0)

  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as any)
  expect(w.status.at(-1)).toBe(undefined)
  await w.clock.advance(30 * MIN)
  expect(w.runs.length).toBe(0)
})

test('"work timer off" silences it for the chat', async ($, on) => {
  const w = engine(on)
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'work timer off' } as any)
  await $.turn.start({ text: 'work timer off', turnId: 't1' })
  await w.clock.advance(25 * MIN)
  expect(w.runs.length).toBe(0)
  expect(w.toasts.at(-1)).toContain('off for this chat')
})

test('subagent turns and tools are ignored', async ($, on) => {
  const w = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'research', turnId: 's1', agentId: 'a1' })
  await w.clock.advance(15 * MIN)
  expect(w.runs.length).toBe(0)
})

test('a line of chat text from Claude counts as shown', async ($, on) => {
  const w = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await w.clock.advance(9 * MIN)
  await $.session.append({
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'Speed test is rendering, about 2 minutes left.' }] },
    door: 'response',
    origin: { kind: 'model', model: 'test' },
    uuid: 'u1',
  } as any)
  await w.clock.advance(5 * MIN)
  expect(w.runs.length).toBe(0)
})

test('a permission prompt left unanswered for 15 minutes raises no warning', async ($, on) => {
  // The tool call takes 15 minutes to come back, standing for you not clicking Allow yet.
  let pausedStatus: string | undefined
  const w = engine(on, async () => {
    await w.clock.advance(15 * MIN)
    pausedStatus = w.status.at(-1)
    return { result: { stdout: 'ok' } }
  })
  on('tool.check', () => ({ decision: 'ask' }))
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'allow' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await w.clock.advance(3 * MIN)

  const ran = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(pausedStatus).toBe('⏱ 18 min working · waiting for your OK')
  expect(w.runs.length).toBe(0)
  expect(ran.context).toBe(undefined)

  // The clock restarts from your answer: 9 more quiet minutes, still no warning; 10, a warning.
  await w.clock.advance(9 * MIN)
  expect(w.runs.length).toBe(0)
  await w.clock.advance(1 * MIN)
  expect(w.runs.length).toBe(1)
})
