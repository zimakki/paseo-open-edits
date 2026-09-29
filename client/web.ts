import { Platform } from "react-native";
import {
  type RowKind,
  isToolCallRowId,
  rowKindFromLabel,
  shouldAutoOpen,
  userClickEffect,
} from "../shared/auto-open";
import { OPEN_EDITS_CSS } from "../shared/open-edits-css";

// The plugin tsconfig has no DOM lib, so this module declares only what it uses.
interface DomNode {
  nodeType: number;
  textContent: string | null;
  parentElement: DomElement | null;
}
interface DomElement extends DomNode {
  id: string;
  tagName: string;
  isConnected: boolean;
  children: ArrayLike<DomElement>;
  childNodes: ArrayLike<DomNode>;
  firstElementChild: DomElement | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  matches(selectors: string): boolean;
  closest(selectors: string): DomElement | null;
  contains(other: DomNode | null): boolean;
  querySelectorAll(selectors: string): ArrayLike<DomElement>;
  click(): void;
  remove(): void;
}
interface DomMutationRecord {
  target: DomNode;
  addedNodes: ArrayLike<DomNode>;
}
interface DomClickEvent {
  isTrusted: boolean;
  target: DomNode | null;
}
interface DomMediaQueryList {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}
declare const document: {
  head: { appendChild(node: DomElement): void };
  body: DomElement;
  createElement(tagName: "style"): DomElement;
  getElementById(id: string): DomElement | null;
  querySelectorAll(selectors: string): ArrayLike<DomElement>;
  addEventListener(type: "click", listener: (event: DomClickEvent) => void, capture: boolean): void;
  removeEventListener(
    type: "click",
    listener: (event: DomClickEvent) => void,
    capture: boolean,
  ): void;
};
declare const window: {
  innerWidth: number;
  matchMedia(query: string): DomMediaQueryList;
};
declare const MutationObserver: new (callback: (records: ArrayLike<DomMutationRecord>) => void) => {
  observe(
    target: DomElement,
    options: { childList: boolean; subtree: boolean; characterData: boolean },
  ): void;
  disconnect(): void;
};
declare function requestAnimationFrame(callback: () => void): number;
declare function cancelAnimationFrame(handle: number): void;

const STYLE_ID = "paseo-open-edits";
const BADGE_SELECTOR = '[data-testid="tool-call-badge"]';
const GROUP_SELECTOR = '[data-testid="tool-call-group"]';
const ROW_ID_SELECTOR = "[data-message-id]";
const ROW_ID_ATTRIBUTE = "data-message-id";
const KIND_ATTRIBUTE = "data-open-edits";
const AUTO_ATTRIBUTE = "data-open-edits-auto";
const WIDE_QUERY = "(min-width: 720px)";
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

interface CallRow {
  header: DomElement;
  id: string;
}
interface RowInfo extends CallRow {
  kind: RowKind;
}

let stopActive: (() => void) | null = null;

function ownText(element: DomElement): string {
  let text = "";
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    if (node.nodeType === TEXT_NODE) text += node.textContent ?? "";
  }
  return text;
}

function headerOf(row: DomElement): DomElement | null {
  const header = row.firstElementChild;
  return header !== null && header.tagName === "BUTTON" ? header : null;
}

// The label is the first element in the header with its own text. The path comes after it.
function labelOf(header: DomElement): string {
  const elements = header.querySelectorAll("*");
  for (let i = 0; i < elements.length; i++) {
    const text = ownText(elements[i]);
    if (text.trim() !== "") return text;
  }
  return "";
}

// Summary groups share one holder ID across their rows, even for a one-call group, so rows
// inside a group are skipped outright.
function rowIdOf(row: DomElement): string | null {
  if (row.closest(GROUP_SELECTOR) !== null) return null;
  const holder = row.closest(ROW_ID_SELECTOR);
  const id = holder?.getAttribute(ROW_ID_ATTRIBUTE) ?? null;
  if (holder === null || id === null || !isToolCallRowId(id)) return null;
  return holder.querySelectorAll(BADGE_SELECTOR).length === 1 ? id : null;
}

// A closed row is just its header. An open row adds its body. Anything else is unknown.
function openStateOf(row: DomElement): boolean | null {
  if (row.children.length === 1) return false;
  if (row.children.length === 2) return true;
  return null;
}

// Clicks use this without the label check, so a close still counts while the label reads doubled.
function callRowOf(row: DomElement): CallRow | null {
  const header = headerOf(row);
  if (header === null) return null;
  const id = rowIdOf(row);
  return id === null ? null : { header, id };
}

function readRow(row: DomElement): RowInfo | null {
  const call = callRowOf(row);
  if (call === null) return null;
  const kind = rowKindFromLabel(labelOf(call.header));
  return kind === null ? null : { header: call.header, id: call.id, kind };
}

function tagRow(row: DomElement): RowInfo | null {
  const info = readRow(row);
  if (info === null) row.removeAttribute(KIND_ATTRIBUTE);
  else if (row.getAttribute(KIND_ATTRIBUTE) !== info.kind)
    row.setAttribute(KIND_ATTRIBUTE, info.kind);
  return info;
}

function elementOf(node: DomNode | null): DomElement | null {
  if (node === null) return null;
  return node.nodeType === ELEMENT_NODE ? (node as DomElement) : node.parentElement;
}

function untagAll(): void {
  for (const attribute of [KIND_ATTRIBUTE, AUTO_ATTRIBUTE]) {
    const tagged = document.querySelectorAll(`[${attribute}]`);
    for (let i = 0; i < tagged.length; i++) tagged[i].removeAttribute(attribute);
  }
}

export function startOpenEdits(): () => void {
  if (Platform.OS !== "web") return () => {};
  stopActive?.();

  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = OPEN_EDITS_CSS;
  document.head.appendChild(style);

  let stopped = false;
  // Tool call IDs of rows Zi closed, and of rows Zi is clicking right now.
  const closed = new Set<string>();
  const clicking = new Map<string, number>();
  const pending = new Set<DomElement>();
  const clickFrames = new Set<number>();
  let frame: number | null = null;

  const openRow = (row: DomElement) => {
    const info = tagRow(row);
    if (info === null) return;
    const open = shouldAutoOpen({
      kind: info.kind,
      isOpen: openStateOf(row),
      attempted: row.getAttribute(AUTO_ATTRIBUTE) === info.id,
      closedByZi: closed.has(info.id) || clicking.has(info.id),
      viewportWidth: window.innerWidth,
    });
    if (!open) return;
    // One try per tool call. A click that fails to open the row is never repeated.
    row.setAttribute(AUTO_ATTRIBUTE, info.id);
    info.header.click();
  };
  const flush = () => {
    frame = null;
    if (stopped) return;
    for (const row of pending) if (row.isConnected) openRow(row);
    pending.clear();
  };
  const schedule = () => {
    if (pending.size > 0 && frame === null) frame = requestAnimationFrame(flush);
  };
  const queueAll = () => {
    const rows = document.querySelectorAll(BADGE_SELECTOR);
    for (let i = 0; i < rows.length; i++) pending.add(rows[i]);
    schedule();
  };
  const addOwner = (node: DomNode) => {
    const row = elementOf(node)?.closest(BADGE_SELECTOR);
    if (row) pending.add(row);
  };

  const observer = new MutationObserver((records) => {
    for (let i = 0; i < records.length; i++) {
      addOwner(records[i].target);
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        if (added[j].nodeType !== ELEMENT_NODE) continue;
        const element = added[j] as DomElement;
        if (element.matches(BADGE_SELECTOR)) pending.add(element);
        const inner = element.querySelectorAll(BADGE_SELECTOR);
        for (let k = 0; k < inner.length; k++) pending.add(inner[k]);
      }
    }
    schedule();
  });

  // Capture phase, so the row's state is read before Paseo toggles it.
  // Enter and Space on the focused header fire this same trusted click.
  const onClick = (event: DomClickEvent) => {
    if (stopped || !event.isTrusted) return;
    const target = elementOf(event.target);
    const row = target?.closest(BADGE_SELECTOR) ?? null;
    if (row === null) return;
    const info = callRowOf(row);
    if (info === null || !info.header.contains(target)) return;
    const wasOpen = openStateOf(row);
    const viewportWidth = window.innerWidth;
    clicking.set(info.id, (clicking.get(info.id) ?? 0) + 1);
    const handle = requestAnimationFrame(() => {
      clickFrames.delete(handle);
      if (stopped) return;
      const left = (clicking.get(info.id) ?? 1) - 1;
      if (left > 0) clicking.set(info.id, left);
      else clicking.delete(info.id);
      const effect = userClickEffect({ wasOpen, isOpenNow: openStateOf(row), viewportWidth });
      if (effect === "closed") closed.add(info.id);
      else if (effect === "opened") closed.delete(info.id);
    });
    clickFrames.add(handle);
  };

  const wideQuery = window.matchMedia(WIDE_QUERY);
  const onWideChange = () => {
    if (!stopped && wideQuery.matches) queueAll();
  };

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("click", onClick, true);
  wideQuery.addEventListener("change", onWideChange);
  queueAll();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    document.removeEventListener("click", onClick, true);
    wideQuery.removeEventListener("change", onWideChange);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const handle of clickFrames) cancelAnimationFrame(handle);
    clickFrames.clear();
    pending.clear();
    clicking.clear();
    closed.clear();
    style.remove();
    // A newer instance calls this first, before it tags anything, so this never strips its work.
    if (stopActive === stop) {
      stopActive = null;
      untagAll();
    }
  };
  stopActive = stop;
  return stop;
}
