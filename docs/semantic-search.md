# Semantic search

Semantic search is not currently shipped. Lexical search remains the canonical, offline knowledge system, including Unicode normalization, field weighting, exact/prefix/fuzzy matching, filters, and precise cross-surface locations. Recognition contributes an attributed `recognizedText` field to that index at a lower weight than title and headings.

The provider and job models reserve `embedding` and `semanticIndex` capabilities so a later implementation can be added without replacing lexical search. Any implementation must:

- remain opt-in and respect local/external policy;
- store owner-scoped, versioned, rebuildable derived vectors;
- fingerprint canonical source revisions and detect stale embeddings;
- exclude Trash and inaccessible/revoked shared content;
- merge bounded semantic candidates with lexical evidence;
- retain strong exact/title ordering; and
- navigate every result to a stable note/heading/object/recognition source.

Embeddings must not become canonical content or provider-lock notes. A cloud implementation may use Supabase `pgvector`; a local implementation may use a managed browser model, but neither is enabled or presented in the UI today. Advanced semantic Smart Views and grounded knowledge Q&A remain intentionally deferred.
