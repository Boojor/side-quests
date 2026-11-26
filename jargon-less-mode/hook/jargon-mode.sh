#!/bin/bash
# jargon-mode: a Claude Code UserPromptSubmit hook.
# Adds a short reminder to every message so Claude answers in two parts:
# the normal reply, then "## What this actually means" in simple, true words.
#
# On by default in every interactive chat. Per chat:
#   off: "stop jargon mode", "normal mode" or "jargon mode off"
#   on again: "jargon mode on" or /technical-jargon-translator
# Off wins when both appear in one message.
#
# State is per chat: ~/.claude/.jargon-mode/off-<session_id> exists = off in that chat.
# Files untouched for 7 days are swept.
# Unattended runs (claude -p, scripts, scheduled tasks) get nothing:
# Claude Code sets CLAUDE_CODE_SESSION_ATTENDED=0 there.
#
# Why a hook: rules given once fade during a long chat. Re-stating a short version
# on every message keeps them in force. The full rules live in the
# technical-jargon-translator skill.
#
# Needs: jq. Licence: MIT (see LICENSE at the top of this repository).

set -u
[ "${CLAUDE_CODE_SESSION_ATTENDED:-1}" = "0" ] && exit 0
[ -n "${HOME:-}" ] || exit 0

# Apps started from the Dock may not have Homebrew on PATH. Look there too (added at the
# end, so a jq already on PATH wins). No PATH at all: the system folders. No jq: do nothing.
PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin"
command -v jq >/dev/null 2>&1 || exit 0

IN=$(cat)
DIR="$HOME/.claude/.jargon-mode"
mkdir -p "$DIR" 2>/dev/null || exit 0

SID=$(printf '%s' "$IN" | jq -r '.session_id // empty' 2>/dev/null)
SID=${SID//[^a-zA-Z0-9_-]/}
[ -n "$SID" ] || exit 0
OFF="$DIR/off-$SID"

PROMPT=$(printf '%s' "$IN" | jq -r '.prompt // ""' 2>/dev/null)

# Sweep files untouched for over 7 days. This chat's off file is touched first, so a
# resumed off chat stays off. An off chat left unused for over a week while other chats
# run is swept, and is on again when resumed.
[ -f "$OFF" ] && touch "$OFF"
find "$DIR" -type f -mtime +7 -delete 2>/dev/null

# Whole phrases only: "normal model" or "abnormal mode" do not count.
B='(^|[^[:alnum:]_])'
E='([^[:alnum:]_]|$)'

# Off switch wins over on switch, so "stop jargon mode" is never ambiguous.
# On the switch from on to off, one short note tells Claude, so earlier two-part replies
# are not copied. A chat that is already off gets nothing.
if printf '%s' "$PROMPT" | grep -qiE "${B}(stop jargon mode|normal mode|jargon mode off)${E}"; then
  if [ ! -f "$OFF" ]; then
    : > "$OFF"
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "JARGON MODE IS NOW OFF in this chat. From this reply on, reply in your normal style with no \"What this actually means\" part, even if earlier replies had one or the technical-jargon-translator skill was loaded. Confirm the switch in one line."
      },
      suppressOutput: true
    }'
  fi
  exit 0
fi

# The slash command counts only on its own: at the start or after a space, and followed by a
# space or the end of the message (so not inside a file path).
if printf '%s' "$PROMPT" | grep -qiE "(^|[[:space:]])/technical-jargon-translator([[:space:]]|$)|${B}jargon mode on${E}"; then
  rm -f "$OFF"
fi

[ -f "$OFF" ] && exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: (
      "JARGON MODE IS ON. Every reply has two parts.\n"
      + "PART 1: your normal reply, exactly as it would be with this mode off. Real names and technical words stay. Do not simplify it or shorten it because part 2 follows.\n"
      + "PART 2: last in the reply, under a heading titled exactly \"## What this actually means\". Very simple words. Never skipped: for a small reply it is one sentence.\n"
      + "1. PART 2 KEEPS ONLY what the reader needs to decide: the decision, the risks, the tradeoffs, what is still broken or not proven. Other work gets one short sentence. Always shorter than part 1: a cut-down translation, never a second full account.\n"
      + "LAYOUT OF PART 2: never a wall of text. One or two sentences can be a short paragraph. Three or more separate points (a risk, a cost, an option, something not tested): one bullet each. Blank lines between the opening sentence, the bullets and the question. If a decision is needed, the one question goes last, alone on its own line as a bold blockquote, never at the end of a paragraph. No sub-headings, no footer.\n"
      + "2. NEVER FALSE, NEVER MORE SURE THAN THE FACTS, in both parts. Nothing invented. Part 2 says nothing that part 1 does not say, and never drops a risk, cost or doubt that part 1 has. Hedges stay hedged (\"very likely\" never becomes \"is\"). \"I checked\" only if that check happened in this session. Simple never means calmer. If simple words would make it wrong, keep the real word and explain it in a few words.\n"
      + "3. DETAIL A FUTURE CHAT WOULD NEED IS SAVED FIRST, in the existing log or plan of the project. No such file: ask where, in one question; never invent a new file. Say where in one line, with the full path, only if it was really saved. Commands the reader must run stay exact, in a code block. Code, commits and briefs to other agents stay technical.\n"
      + "Do not judge this from your own recent replies. If recent replies had no \"What this actually means\" part, those replies were wrong.\n"
      + "Off: \"stop jargon mode\"."
    )
  },
  suppressOutput: true
}'
