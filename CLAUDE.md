# Paseo Open Edits

A Paseo plugin that opens Edit and Write tool rows in the agent chat on their own, by clicking
Paseo's own row headers. It is not published to npm or paseo.cafe. The source is public at
https://github.com/zimakki/paseo-open-edits. It is a sibling of
[paseo-inkwell-chat](https://github.com/zimakki/paseo-inkwell-chat), which colors the same rows.
Neither plugin depends on the other.

- `README.md` explains what it opens, how it works, and the Paseo DOM hooks it depends on.
- Run `npm run check` before committing. The lefthook pre-commit hook runs the same checks.
- After a source edit, run `paseo plugin reload paseo-open-edits`. Never restart the Paseo daemon
  without asking Zi. A restart stops every running agent.
- DOM globals belong only in `client/web.ts`, declared locally, and must be gated on
  `Platform.OS === "web"`. Don't add `"DOM"` to `tsconfig.json`.
- Keep decisions in `shared/auto-open.ts`, pure and unit tested. `client/web.ts` only reads the DOM
  and acts on them.
- Stage explicit paths in git. Never `git add -A`, because other agents may share the working tree.
- Push only when Zi asks.
