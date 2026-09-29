# Paseo Open Edits

A Paseo plugin that opens Edit and Write tool rows in the agent chat on their own, so every diff
shows inline without a click, the way Claude Code shows it in the terminal.

Paseo draws every tool row collapsed, and no setting changes that for edits. This plugin clicks
Paseo's own row headers for you instead of redrawing anything, so file links, Cmd+F, copy, code
highlighting and the tool detail sheet keep working as before.

## What it does

- Edit rows open at full height, so the whole diff shows.
- Write rows open and stop at 600px, then scroll inside.
- It works for rows already in the chat and for new rows while an agent streams, for Claude and
  Codex agents alike.
- A row you close stays closed until the page or the plugin reloads. Closing one row doesn't
  affect other edits to the same file.
- Below 720px wide it opens nothing, because Paseo shows the tool detail sheet there instead.
- It only acts in Full detail mode (Settings → Chat → Tool call display). In Summary mode it leaves
  grouped rows alone.

The height rules also apply to rows you open by hand.

## Install

You need Paseo 0.10.1 or later, with plugins enabled (Settings → Plugins).

```bash
git clone https://github.com/zimakki/paseo-open-edits.git
cd paseo-open-edits
npm install
paseo plugin install "$PWD"
paseo plugin ls   # paseo-open-edits should show "running"
```

It works in the desktop app and the web UI. On iOS and Android it does nothing. It works with or
without [paseo-inkwell-chat](https://github.com/zimakki/paseo-inkwell-chat), which colors the same
rows.

## How it works

`client/web.ts` does three things when the plugin starts:

1. It adds one `<style id="paseo-open-edits">` element. It overrides Paseo's inline `max-height`
   on the scroll box inside rows tagged `data-open-edits="edit"` (no limit) or `"write"` (600px).
2. It starts a `MutationObserver`, batched into one animation frame, that reads each tool row's
   label and tags Edit and Write rows. For each new closed row it clicks the header button once and
   marks the row with its tool call ID in `data-open-edits-auto`, so it never clicks that row
   again.
3. It listens for real (trusted) clicks on row headers in the capture phase. When you close a row,
   it remembers that row's tool call ID and won't reopen it, even if Paseo remounts the row. The
   plugin's own clicks are untrusted, so they never count.

A `matchMedia("(min-width: 720px)")` listener reruns the pass when the window widens, so rows
that arrived while it was narrow open then.

Disabling or removing the plugin removes the stylesheet, stops the observer and the listeners, and
strips every attribute it added. Rows that are open stay open.

## Paseo internals it depends on

None of these are part of the plugin API. They were checked against Paseo 0.10.1. If a Paseo update
changes them, rows stop opening or the height rules stop applying, but nothing breaks.

| Hook                                                | Used for                                 |
| --------------------------------------------------- | ---------------------------------------- |
| `[data-testid="tool-call-badge"]`                   | a tool row                               |
| the row's first element child, a `button`           | the header the plugin clicks             |
| first element with its own text inside the header   | the tool label (`Edit`, `Write`)         |
| the row having two element children                 | the row is open                          |
| `data-message-id="agent_tool_…"` on an ancestor     | the tool call ID, for remembering closes |
| `[data-testid="tool-call-group"]`                   | a Summary group, which the plugin skips  |
| inline `style="max-height: …"` inside the open body | the scroll box the height rules override |

A non-English Paseo UI shows different tool labels, so nothing opens.

In a long chat, every Edit in the loaded history opens at once, so the page gets much taller.
That's intended.

## Changing the Write limit

The stylesheet is `shared/open-edits-css.ts`. Edit the `600px`, then check and reload:

```bash
npm run check
paseo plugin reload paseo-open-edits
```

## Development

The tooling follows Paseo's own: oxfmt, oxlint, knip, tsc, and a lefthook pre-commit hook.

```bash
npm install          # also installs the pre-commit hook
npm run check        # format check, lint, knip, typecheck, tests
npm run format       # fix formatting
npm run lint:fix     # fix lint issues oxlint can fix
paseo plugin logs paseo-open-edits
```

The decisions (which rows to open, whether a click closed a row) live in `shared/auto-open.ts`
with no DOM, so tests use `node:test` with Node's built-in type stripping. They need Node 22.18 or
later.
