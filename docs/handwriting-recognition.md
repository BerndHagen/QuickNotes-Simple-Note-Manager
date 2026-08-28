# Handwriting recognition

QuickNotes uses the browser Handwriting Recognition API where it is genuinely available. It passes bounded canonical stroke vectors—including point coordinates and relative timing—to the browser/operating-system recognizer. It does not send a screenshot to the printed-text OCR engine and does not fabricate a result on unsupported devices.

## Processing classification

The implementation is classified as **browser-managed**, not local. The browser or operating system may use an on-device model or a service. The UI therefore requires:

1. Recognition privacy mode set to **External allowed**.
2. An operation-level disclosure naming the selected strokes.
3. An explicit click for that operation.

Consent is not persisted as blanket access. Unsupported browsers omit the handwriting action rather than showing a dead control.

## Source and correction behavior

Recognition references the source note, Paper page when applicable, all selected stroke IDs, their bounds, and a fingerprint of the immutable stroke snapshot. Results enter canonical search with a location that selects and centers source ink. Moving, changing, or deleting referenced strokes marks the row stale atomically with the spatial save.

The original strokes remain unchanged. The user may:

- correct the searchable text;
- rerun recognition without losing a correction;
- explicitly add the result as an editable spatial text object; or
- explicitly create a canonical QuickNotes task with a source link.

The implementation accepts at most 5,000 strokes and 250,000 points per operation. Recognition accuracy, language coverage, and offline availability depend on the browser/operating-system implementation.

Ink-to-shape and ink-to-math are not implemented. Ordinary handwriting is never silently converted to shapes or equations.
