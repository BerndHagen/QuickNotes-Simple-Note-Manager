# Document pagination architecture

QuickNotes desktop documents use a measured editing flow and a separate page-chrome layer. The editor owns text and cursor behavior; independent sheet elements own each page background, four-sided focus border, shadow, and the empty gutter between pages. Content is never used to paint or bridge the gap.

## Required behavior

- Automatic breaks are derived from the browser's rendered block and line geometry, not estimated character counts.
- A normal block moves to the next writable area when it does not fit. A paragraph or checklist item taller than one sheet is split only at a measured rendered line boundary.
- Break fill values retain sub-pixel precision. Rounding each page independently accumulates drift and can eventually place text inside the next sheet's top margin.
- Decorations are mapped through ProseMirror transactions and never mutate the editor's managed document DOM.
- Every sheet has its own complete edge and shadow. The 24 px space between sheets contains only the workbench background.
- Phone editing intentionally uses one continuous surface; desktop and export pagination remain reproducible from the document.

These rules match the important pagination behavior exposed by Microsoft Word: automatic page breaks, keeping a unit together where possible, and flowing an overlong paragraph at line boundaries. Word also exposes widow/orphan and keep-with-next controls as paragraph-level policy. QuickNotes does not claim binary layout compatibility with Word; it implements the same user-facing safety invariant that text cannot occupy a page margin or gutter.

## Implementation

`PaginationExtension.js` performs measurement in the plugin view after layout. For text that must split, DOM `Range` rectangles identify visual lines and `view.posAtDOM` maps each line start back to a stable ProseMirror position. Widget decorations add only the exact remaining writable height, bottom margin, physical gutter, and next top margin. The persisted note remains ordinary semantic content.

`DocumentChrome.jsx` derives all sheet, edge, and gutter positions from `pageGeometry.js`. It does not inspect content or infer its own page count from height. This separation prevents shadows, borders, or paper colour from joining adjacent pages.

## Regression contract

Rendered tests cover manual breaks, mixed headings/paragraphs/checklists, long multi-page paragraphs, long multi-page checklist items, zoom, Focus mode, and reopening legacy persisted checklists. The critical assertion measures every rendered content rectangle against writable sheet bounds and every text line against every physical gutter.

## Primary references

- [Microsoft: Remove a page break in Word](https://support.microsoft.com/en-US/Word/remove-a-page-break-in-word)
- [Microsoft: Use Line and Page Breaks settings in Word](https://support.microsoft.com/en-us/word/line-and-page-breaks)
- [W3C CSS Fragmentation Level 3](https://www.w3.org/TR/css-break-3/)
- [ProseMirror reference: decorations and DOM/position mapping](https://prosemirror.net/docs/ref/)
