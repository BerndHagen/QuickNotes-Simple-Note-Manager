# Internal links

## Reference contract

An internal target is represented as:

```js
{ noteId, anchorId: null, objectId: null }
```

The durable URL form is `#note/<NoteId>?anchor=<AnchorId>&object=<ObjectId>`. Query fields are omitted when absent. Values are encoded and bounded before use. Legacy `note://` references can still be read, but new links use the hash form so copied browser URLs and in-app references share one resolver.

Document links persist `data-note-id`, optional `data-note-anchor-id`, and optional `data-note-object-id` through HTML sanitization. Paper and Canvas use a `noteLink` object containing the same target identities. Display labels and note titles are resolved independently and may change without changing the target.

## Anchors and objects

Meaningful Document headings receive a UUID `data-anchor-id` through a Tiptap extension. The extension preserves existing IDs and assigns missing IDs in one transaction, so re-rendering does not regenerate anchors. Outline navigation and copied heading links use that identity.

Paper and Canvas objects use stable spatial IDs. A spatial link or search result can target an object. Paper switches to the object's page and selects it; Canvas selects and centers it. Deleting an anchor or object leaves the note link safe at the note boundary and produces a missing precise target rather than guessing by display text.

## Extraction and backlinks

After canonical persistence, the indexer replaces the changed note's outgoing relationship rows. Document extraction records the containing heading and block text. Spatial extraction records the source object. Each row stores:

- source note, content kind, heading/object location;
- target note, optional heading/object location;
- relationship (`reference` in schema version 1);
- human label and bounded context;
- owner scope and deterministic row identity.

Forward links query `[ownerId+sourceNoteId]`; backlinks query `[ownerId+targetNoteId]`. The Inspector exposes both with useful context. This is also an accessible, nonvisual graph representation.

## Navigation and lifecycle semantics

Opening a search result or link uses one navigation action for Document, Paper, Canvas, and structured notes. A session stack stores the current, previous, and next stable target. Selecting a new note clears the forward branch. Workspace changes reset the stack to prevent cross-owner history.

Renaming, moving, archiving, or restoring a note preserves its ID and relationships. Trash preserves canonical content and derived link diagnostics, but UI navigation to a trashed source or target is disabled unless the user is already working in the Trash context. Permanent deletion removes canonical content; the next reconciliation represents incoming targets as missing and removes outgoing rows. A later note with an unrelated new ID cannot silently capture the old reference.

External URLs remain ordinary sanitized links and are never interpreted as internal note identities. Malformed encodings, control characters, and missing IDs are rejected without throwing during rendering.
