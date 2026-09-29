import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isToolCallRowId,
  isWide,
  rowKindFromLabel,
  shouldAutoOpen,
  userClickEffect,
} from "../shared/auto-open.ts";

test("maps Edit and Write labels to their kinds", () => {
  assert.equal(rowKindFromLabel("Edit"), "edit");
  assert.equal(rowKindFromLabel("Write"), "write");
  assert.equal(rowKindFromLabel("  edit \n"), "edit");
  assert.equal(rowKindFromLabel("WRITE"), "write");
});

test("ignores every other label", () => {
  for (const label of [
    "Shell",
    "Read",
    "",
    "   ",
    "Editor",
    "Write file",
    "mcp__paseo__browser_click",
    "Lesen",
  ]) {
    assert.equal(rowKindFromLabel(label), null, label);
  }
});

test("ignores a label doubled while the row streams", () => {
  assert.equal(rowKindFromLabel("EditEdit"), null);
  assert.equal(rowKindFromLabel("WriteWrite"), null);
});

test("accepts tool call row IDs from any provider", () => {
  assert.ok(isToolCallRowId("agent_tool_turn:foreground-turn-2/toolu_011ek59ny7PU6FuhVaZKnarc"));
  assert.ok(isToolCallRowId("agent_tool_exec-4328aafd-482d-484f-ac97-32cce2f94e30"));
});

test("rejects row IDs that are not a single tool call", () => {
  assert.equal(isToolCallRowId(""), false);
  assert.equal(isToolCallRowId("agent_tool_"), false);
  assert.equal(isToolCallRowId("thought_1790690104798_ywb7ly_0"), false);
  assert.equal(isToolCallRowId("assistant_message:foreground-turn-2/abc"), false);
  assert.equal(isToolCallRowId("tool_group:foreground-turn-2"), false);
});

test("treats 720px and wider as wide", () => {
  assert.equal(isWide(719), false);
  assert.equal(isWide(720), true);
  assert.equal(isWide(1280), true);
});

const openable = {
  kind: "edit",
  isOpen: false,
  attempted: false,
  closedByZi: false,
  viewportWidth: 720,
} as const;

test("opens a closed, untried Edit or Write row in a wide window", () => {
  assert.equal(shouldAutoOpen(openable), true);
  assert.equal(shouldAutoOpen({ ...openable, kind: "write" }), true);
});

test("does not open when any one condition fails", () => {
  assert.equal(shouldAutoOpen({ ...openable, kind: null }), false);
  assert.equal(shouldAutoOpen({ ...openable, isOpen: true }), false);
  assert.equal(shouldAutoOpen({ ...openable, isOpen: null }), false);
  assert.equal(shouldAutoOpen({ ...openable, attempted: true }), false);
  assert.equal(shouldAutoOpen({ ...openable, closedByZi: true }), false);
  assert.equal(shouldAutoOpen({ ...openable, viewportWidth: 719 }), false);
});

test("reads a user click in a wide window", () => {
  const wide = { viewportWidth: 720 };
  assert.equal(userClickEffect({ ...wide, wasOpen: true, isOpenNow: false }), "closed");
  assert.equal(userClickEffect({ ...wide, wasOpen: false, isOpenNow: true }), "opened");
  assert.equal(userClickEffect({ ...wide, wasOpen: true, isOpenNow: true }), "none");
  assert.equal(userClickEffect({ ...wide, wasOpen: false, isOpenNow: false }), "none");
  assert.equal(userClickEffect({ ...wide, wasOpen: null, isOpenNow: false }), "none");
  assert.equal(userClickEffect({ ...wide, wasOpen: true, isOpenNow: null }), "none");
});

test("ignores every click in a narrow window, where Paseo opens the detail sheet", () => {
  const narrow = { viewportWidth: 719 };
  assert.equal(userClickEffect({ ...narrow, wasOpen: true, isOpenNow: false }), "none");
  assert.equal(userClickEffect({ ...narrow, wasOpen: false, isOpenNow: true }), "none");
  assert.equal(userClickEffect({ ...narrow, wasOpen: false, isOpenNow: false }), "none");
});
