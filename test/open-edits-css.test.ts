import assert from "node:assert/strict";
import { test } from "node:test";
import { OPEN_EDITS_CSS } from "../shared/open-edits-css.ts";

test("lets Edit rows open at full height", () => {
  assert.match(
    OPEN_EDITS_CSS,
    /\[data-open-edits="edit"\] \[style\*="max-height"\] \{ max-height: none !important; \}/,
  );
});

test("stops Write rows at 600px", () => {
  assert.match(
    OPEN_EDITS_CSS,
    /\[data-open-edits="write"\] \[style\*="max-height"\] \{ max-height: 600px !important; \}/,
  );
});

test("has only the two height rules", () => {
  assert.equal(OPEN_EDITS_CSS.match(/\{/g)?.length, 2);
  for (const selector of OPEN_EDITS_CSS.matchAll(/^([^{]+)\{/gm)) {
    assert.match(selector[1], /^\[data-open-edits="(edit|write)"\] /);
  }
});
