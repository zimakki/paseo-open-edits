// Paseo caps an open row's scroll box with an inline max-height (400px in Full detail).
// Both rules key on the plugin's own attribute, so they work without inkwell.
export const OPEN_EDITS_CSS = `[data-open-edits="edit"] [style*="max-height"] { max-height: none !important; }
[data-open-edits="write"] [style*="max-height"] { max-height: 600px !important; }
`;
