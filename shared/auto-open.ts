// Pure decisions for opening Edit and Write rows. No DOM here, so node --test can run it.

export type RowKind = "edit" | "write";

// Paseo's md breakpoint. Below it, a header click opens the tool detail sheet instead.
const WIDE_MIN_WIDTH = 720;
const TOOL_CALL_ROW_PREFIX = "agent_tool_";

export function rowKindFromLabel(label: string): RowKind | null {
  const key = label.trim().toLowerCase();
  return key === "edit" || key === "write" ? key : null;
}

// Paseo builds tool row IDs as `agent_tool_${callId}`: agent_tool_turn:... for Claude,
// agent_tool_exec-... for Codex. Thinking rows use thought_... and never match.
export function isToolCallRowId(id: string): boolean {
  return id.startsWith(TOOL_CALL_ROW_PREFIX) && id.length > TOOL_CALL_ROW_PREFIX.length;
}

export function isWide(viewportWidth: number): boolean {
  return viewportWidth >= WIDE_MIN_WIDTH;
}

interface AutoOpenInput {
  kind: RowKind | null;
  isOpen: boolean | null;
  attempted: boolean;
  closedByZi: boolean;
  viewportWidth: number;
}

export function shouldAutoOpen(input: AutoOpenInput): boolean {
  return (
    input.kind !== null &&
    input.isOpen === false &&
    !input.attempted &&
    !input.closedByZi &&
    isWide(input.viewportWidth)
  );
}

interface UserClickInput {
  wasOpen: boolean | null;
  isOpenNow: boolean | null;
  viewportWidth: number;
}

export function userClickEffect(input: UserClickInput): "closed" | "opened" | "none" {
  if (!isWide(input.viewportWidth)) return "none";
  if (input.wasOpen === true && input.isOpenNow === false) return "closed";
  if (input.wasOpen === false && input.isOpenNow === true) return "opened";
  return "none";
}
