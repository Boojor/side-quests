# work-timer

I give Claude a job and go do something else. Then I come back and Claude is still going, with nothing to show me.

Once, 35 minutes went by like that. No draft, no render, not one line saying what was left.

I had a written rule for this: show me something within about 10 minutes. Claude read it at the start of the chat and
forgot it halfway through.

I don't have time for this. It breaks my flow.

So now a timer checks for me. After 10 minutes with nothing shown, I get a notification, and Claude gets a nudge to
show me something or tell me what is left and how long.

## What you see

- **A status line** once Claude has worked for 2 minutes, updated every minute:
  `⏱ 12 min working · last shown 3 min ago`. It clears when Claude finishes. Short jobs show nothing.
- **A notification** after 10 minutes with nothing shown: "Work timer: Claude has worked 10 min with nothing to show
  you." Then again every 10 more minutes.
- **A small message in the chat** for 15 seconds, saying the same thing.

## What Claude sees

One hidden reminder, on the next step after a warning:

> work-timer: 10 minutes since the user last saw anything from you in this turn. Show them something to look at (a
> render, a draft, a page), or give a one-line status saying what is left and how long it will take. Do it before the
> next long step.

About 50 words, and only when a warning fires.

## What counts as "shown"

The count goes back to 0 when Claude:

- writes any line of text in the chat (a one-line status counts), or
- sends you a file, opens a page or preview, asks you a question, or publishes an artifact.

Each new message you send starts the count from 0. Work done by Claude's helper agents (subagents) is not counted:
only the main chat.

## Waiting on you doesn't count

When Claude is waiting for your click on a permission prompt, your answer to a question, or your OK on a plan, the
"nothing shown" clock pauses and the status line says `waiting for your OK`. It starts again from 0 when you answer.
The "min working" count in the status line keeps going.

**The tradeoff:** a long script that starts right after you click Allow also runs inside the pause, so the count starts
once that script ends.

## Install

You need Claude Code with plugin support. Installing adds this repository as a plugin marketplace, then installs the
timer from it.

**In a terminal**, inside Claude Code:

```
/plugin install work-timer --marketplace Boojor/side-quests
```

Answer `y` to add the marketplace, then pick a scope (Enter keeps "user", which means every chat).

**From a shell:**

```bash
claude plugin install work-timer --marketplace Boojor/side-quests
```

**In the Claude desktop app:** click **+** next to the prompt box, then **Plugins**, **Add marketplace** with
`Boojor/side-quests`, then **Add plugin**. (Taken from Claude Code's docs, not tried yet.)

New chats get the timer.

### Where it works

| | Status line | Notification | Chat message |
|---|---|---|---|
| Claude desktop app on a Mac | Yes | Yes, through macOS (`osascript`) | Yes |
| Claude Code in a terminal (Mac, Linux, Windows) | Yes | Through Claude Code's own notification | Yes |
| Claude desktop app on Windows | Yes | No | Yes |

I use it in the desktop app on a Mac: I have seen the status line there, and test notifications. The other rows are
what the code does, not something I have tried.

## Switching it off

| You type | What happens |
|---|---|
| `work timer off` or `stop the work timer` | Off for this chat, until the app restarts (in a terminal: until that session ends) |
| `work timer on` | On again |

Off everywhere:

```bash
claude plugin disable work-timer@side-quests
```

## Uninstall

```bash
claude plugin uninstall work-timer@side-quests
```

To also remove the marketplace: `claude plugin marketplace remove side-quests`.

## What's in the box

| File | What it does |
|---|---|
| `.claude-plugin/plugin.json` | Name, version, description |
| `hooks/hooks.json` | Points Claude Code at the code |
| `hooks/register.ts` | Listens to the chat: when a job starts and ends, when something is shown, when Claude waits on you |
| `hooks/timer.ts` | The rules: 10 minutes, 2 minutes, what counts as shown, the wording |
| `hooks/work-timer.test.ts` | 11 tests (`claude plugin test <this folder>`) |

**What it can do on your computer:** no network, reads no files, keys or settings. The one program it runs is Apple's
notifier (`/usr/bin/osascript`), with fixed text, when Claude Code's own notification did not go out. On Windows and
Linux that program does not exist, so the attempt fails quietly and nothing else happens. If the timer itself breaks, it steps aside and your work
goes on.

**Change the numbers:** `WARN_AFTER` (10 minutes) and `STATUS_AFTER` (2 minutes) at the top of `hooks/timer.ts`.

## Credits

**Built on**
- Nothing copied: the timer is my own work.

**Uses**
- [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) plugins and their hooks, by Anthropic.
- macOS `osascript`, for the notification in the desktop app.

## Licence

MIT. See `LICENSE` at the top of this repository.
