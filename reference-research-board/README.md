# reference-research-board

I need to design something. A homepage, a poster, a set of posts. No idea yet what it should look like.

So I go looking. Forty tabs, saved pins, screenshots on the desktop. Half of it is the same five things
everyone saves. The rest is close, but not for this brief.

I don't have time for this. It breaks my flow.

What I want: it should just fit the brief. Do the visual research for me.

So now Claude asks me why first. What I'll decide with the board, a few examples I like, what a good find
looks like. It shows me a search plan, I say "go", and it searches, looks at every picture against my brief,
and builds a board. I mark what I'd steal and why. Claude reads my marks back.

The board is the part I answer. The research is the part it does for me.

**[Watch the 52-second demo](video/reference-research-board-demo.mp4)**

## What it does

1. **Asks first**, one simple question at a time: what you will decide with the board, the medium, 3 to 5
   examples you like, what the examples are really saying, and a few yes/no tests a good find must pass.
2. **Shows a search plan** (sources, searches, the parts of the board) and waits for your "go".
3. **Searches** the places that really work for the medium: live websites, free image archives, video
   platforms, galleries, your own screenshots.
4. **Looks at every picture** against your tests, sends you a contact sheet early, and keeps only what fits.
   Fewer than 5 good cards means no board, and it tells you why.
5. **Builds a board** as a private claude.ai artifact: Steal / Partial / Skip on every card, a note per card,
   screenshots pasted into notes, a "what's missing" note per part, and an "I'm done" button.
6. **Reads your marks back** into `picks.md`, part by part, with the pattern it sees in what you took and
   what you skipped.

Then you design with what you picked. In Figma or anywhere.

## What I use it for

- A website homepage, section by section, including how things move.
- Social posts for a school campaign.
- An illustration style for a series.
- The voice of a set of posts (text mode: every card is a real line of writing in English or Hebrew, checked word
  for word).
- A poster from free archive pictures, when everything on the board must be free to reuse (the demo).

## What you need

| Need | Why | Required? |
|---|---|---|
| Claude Code with claude.ai artifacts that can keep data (`db`, `user`, `assets`) | The board saves your marks, knows who can edit, and stores pasted screenshots | **Yes** |
| Python 3 | `scripts/build-board.py` fills the board template | **Yes** |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp), started with `--headless` | Real screenshots of live websites, in its own hidden browser | For websites, product UI and motion |
| [ImageMagick](https://imagemagick.org) | The early contact sheet (`montage`) | Recommended |
| `curl` (comes with macOS) | Downloads pictures and, in text mode, saves each source page | **Yes** |

Without Playwright the board still works: cards without a capture link to the source.

## Install

Written for and tested on a Mac. Linux should work; Windows is not supported (the skill uses a Unix shell).

Copy the skill folder into your skills folder, from the `reference-research-board` folder of this repository:

```bash
mkdir -p ~/.claude/skills && cp -R skill/reference-research-board ~/.claude/skills/
```

Already have a copy? This replaces its files. Keep your own edits somewhere else first.

Start a new chat and type `/reference-research-board`, or just ask for references ("find references for...").

## What it touches

- **Network:** web searches and page fetches for the sources in the plan you approved; image downloads from
  those pages; screenshots of live sites in a hidden Playwright browser; the desktop app's built-in browser, if you have it,
  for archives (and for capture only with your yes); publishing the board to claude.ai and reading your marks back from it. The board page
  loads its fonts from Google Fonts.
- **Files:** reads your project's brief, `CLAUDE.md` or design system if there is one. Writes inside one folder in
  your project, `references/<date> <topic>/` (or inside your design folder, if the project has one): pictures,
  notes, the board data, `picks.md`. Playwright may also
  leave its own copies of the screenshots in its output folder (often `.playwright-mcp/`).
- **Programs:** `python3` (the build script), ImageMagick's `montage`, `curl` (to download pictures and, in text mode,
  pages), `mkdir` and `cp` (to make the topic folders and copy screenshots into them).
- **Pages it reads are data:** the skill tells Claude and its helper agents never to follow instructions found on
  a web page, in an agent's report or in the board's notes.
- **Cost:** a board run uses background agents and reads many pages, so it uses a lot of tokens. Not measured for
  this version.
- **Your marks:** stored in the board artifact's own database. The board is private to you until you share it.
  Boards hold screenshots of other people's work: think twice before you share one publicly.
- **It never** signs in anywhere, accepts terms, fills forms, or gets past a "verify you're human" check. A
  blocked source is reported to you, not worked around.

## Where it has been tested

| Part | Status |
|---|---|
| Intake, search plan, contact sheet, board, marks, read-back | Used on my own boards since October 2026 |
| Publishing and reading the board from the Claude desktop app's Code tab | Tested |
| Free archive search in the desktop app's built-in browser (Public Domain Image Archive, rights fields) | Tested 2026-11-27 (the demo) |
| Live website capture with headless Playwright | Tested on several boards |
| Lead finding by a background agent with web search | Tested 2026-11-27: 4 leads from Awwwards and live sites, every link fetched, no blocks. It cannot see pictures or motion, so the pictures come from capture |
| Text mode's word-for-word check, in this public form | Changed for the public copy, not run in this exact form yet |
| Other artifact tools (for example a claude.ai artifacts connector) | Not tested |
| Claude in Chrome | Not tested |

## Uninstall

Delete `~/.claude/skills/reference-research-board/`.
Boards you published stay in your claude.ai artifacts until you delete them there.

## Credits

**Built on**
- Nothing copied: the skill, the board template and the build script are my own work.

**Uses**
- [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills and claude.ai artifacts, by Anthropic.
- [Playwright MCP](https://github.com/microsoft/playwright-mcp), by Microsoft, for capture.
- [ImageMagick](https://imagemagick.org), for contact sheets.
- [Python](https://www.python.org) and [curl](https://curl.se).
- Fonts on the board, from [Google Fonts](https://fonts.google.com) (SIL Open Font License): Bricolage
  Grotesque, IBM Plex Sans, IBM Plex Mono, Assistant.

**The demo video**
- Laptop: ["macbook pro M3 16 inch 2024"](https://sketchfab.com/3d-models/8e34fc2b303144f78490007d91ff57c4)
  by jackbaeten, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changed: the screen shows the demo's
  own screens.
- Pictures on the demo board: [Public Domain Image Archive](https://pdimagearchive.org) (public domain worldwide,
  no added rights).
- Rendered with [three.js](https://threejs.org) (MIT).
- Music and sound effects: generated with Magnific (music by Google's Lyria 3).
- Captions: Neue Haas Grotesk, from Adobe Fonts.

## Licence

MIT. See `LICENSE` at the top of this repository.

## What changed

- **1.0 (2026-11-27):** first version.
