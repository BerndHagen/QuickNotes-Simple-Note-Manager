# Search index

## Engine selection

Task 3 uses MiniSearch 7.2 behind QuickNotes' own `SearchDocument` and service interfaces. MiniSearch supports in-memory full-text indexing, field boosts, prefix/fuzzy matching, filters, and incremental replacement without defining QuickNotes' canonical storage contract ([MiniSearch project](https://github.com/lucaong/minisearch), [search options](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html#search)). FlexSearch was evaluated as an alternative, but its document/persistence APIs would not remove the need for owner-scoped canonical projections ([FlexSearch project](https://github.com/nextapps-de/flexsearch)).

The MiniSearch token index lives in a long-lived module worker. `SearchDocument` projections persist in IndexedDB so startup and worker recovery do not need to reinterpret every canonical note if its fingerprint is unchanged. Persisted projections remain derived and rebuildable.

## Normalization and tokenization

Input is bounded, NFKC-normalized, locale-lowercased, and diacritic-folded for matching. Word boundaries use `Intl.Segmenter` when available and a Unicode-aware regex fallback otherwise. `Intl.Segmenter` provides locale-sensitive word segmentation and is preferable to splitting only on ASCII whitespace ([MDN `Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)).

Stemming is intentionally absent: a single language stemmer would damage names and multilingual notes. Prefix matching begins at two characters. Edit-distance fuzzy matching begins at five characters and is capped at a restrained ratio, preventing short-query noise. Exact title and quoted phrase matches receive additional boosts.

## Fields and ranking

| Field | Boost | Sources |
| --- | ---: | --- |
| title | 8.0 | Catalog title |
| headings | 5.0 | Document headings |
| tags | 3.5 | Assigned tags |
| objects | 2.6 | Spatial text, stickies, index cards, note-link labels |
| body | 1.6 | Document text and structured user content |
| resources | 1.1 | Filename, MIME type, alt text |
| metadata | 0.8 | Folder, note type, content kind, states |

Pinned and starred notes receive small tie boosts; score, update time, and stable ID provide deterministic ordering. Results include a bounded contextual snippet and match origin. Empty input returns up to 12 pinned/recent active notes.

## Query grammar

Plain text remains the default. Quoted phrases and the following optional filters are supported:

```text
"release checklist" tag:launch folder:"Work notes"
kind:paper type:meeting is:starred
is:archive before:2026-09-01 after:2026-01-01
is:trash
```

`type:` targets the user-visible note subtype. `kind:` targets `document`, `structured`, `paper`, or `canvas`. Repeated tags are ANDed. `is:` accepts `starred`, `pinned`, `archived`, `trash`, and `shared`. Archive and Trash are excluded unless requested. Date comparisons use `updatedAt`; invalid dates simply do not create a match.

UI type filters and query filters use the same predicate. Smart Views have a richer saved-rule model but consume the same projected text for text rules.

## Incremental lifecycle and recovery

- A source fingerprint covers note revision/state/tags, folder metadata, and spatial document revision.
- Only changed or removed note projections and source-link rows are rewritten.
- Projection runs in batches of 100 and yields between batches in a browser.
- Search tokenization, index replacement, and queries run in the worker.
- Result rendering is bounded to at most 80 rows in Global Search (the engine hard-caps any caller at 200), so the dialog never mounts an unbounded library.
- A missing/mismatched schema, interrupted state, or document/link count mismatch triggers a deterministic rebuild.
- The rebuild action deletes only derived rows.

The final 50,000-document synthetic benchmark (`npm run benchmark:search -- 50000`) built the token index in 2.908 seconds and returned the target query in 3.79 ms on the verification machine, using about 178 MB for the Node benchmark process. Browser performance varies; this figure is a regression baseline, not a product guarantee.

## Versioning and isolation

Dexie version 4 adds `searchDocuments`, `knowledgeLinks`, and `knowledgeIndexState`. Every key or query is scoped by owner. A tested v3→v4 open preserves canonical notes byte-for-byte and starts the new stores empty. Workspace activation terminates the prior worker and clears its in-memory projections before loading the next owner.

Derived search rows are not synced or backed up. Canonical notes, resources, and spatial records remain authoritative. This matches Dexie's explicit versioned-schema model ([Dexie version documentation](https://dexie.org/docs/Version/Version)).
