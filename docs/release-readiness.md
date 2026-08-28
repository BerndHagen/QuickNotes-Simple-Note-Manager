# Release readiness

This document records the supported QuickNotes 3.x release boundary. It is a
public engineering summary, not a guarantee that the software is bug-free,
perfectly secure, or incapable of data loss.

## Release status

No reproduced data-loss, account-isolation, or authorization blocker remained
open at the 3.0 release gate. The production artifact, local-first workflows,
backup graph, synchronization queues, and connected Supabase policies were
tested within the environments listed below. Unverified physical platforms and
long-duration conditions remain explicit limitations rather than implied
certifications.

## Data-safety controls

- Canonical writes and their durable outbox mutations share IndexedDB
  transactions. A failed local write is not reported as saved.
- Immutable operation identities prevent an older network acknowledgement from
  deleting newer queued work.
- Concurrent catalog, note, spatial, capture, and annotation changes preserve
  reviewable conflict state when they cannot be merged safely.
- Permanent deletion is distinct from recoverable Trash and performs
  owner-scoped, reference-aware cleanup across canonical stores.
- `.qnotes` archives validate versions, bounds, checksums, and references before
  one atomic import. Internal identities are remapped without breaking links.
- Search and knowledge projections are rebuildable and cannot overwrite
  canonical content when corrupt.
- Cross-tab ownership messages, Web Locks, database-version gates, and owner
  checks protect account switching and schema upgrades.

## Cloud authorization boundary

Repository migrations include owner-scoped RLS, private Storage policies,
Realtime publication, graph validation, lifecycle triggers, and restricted
function/RPC grants. Two-user rollback-only probes verified unrelated-user
isolation, view/edit share transitions, read-only shared spatial content,
capture correction permissions, resource visibility, and immediate revocation.

Client builds use only public Supabase configuration. `service_role` and
provider credentials belong exclusively in server-held deployment secrets.

## Automated evidence

The release gate includes:

- lint, unit/integration tests, production build, deployment validation, and a
  production-dependency audit;
- Chromium and mobile WebKit-emulation workflows for responsive and accessible
  UI, Document/Paper/Canvas, capture, backup, recovery, conflicts, and PWA
  behavior;
- representative legacy IndexedDB migrations through the current schema;
- generated large-library, long-stroke, queue-retry, malformed-import, quota,
  account-switch, multi-tab, and offline/reconnect scenarios;
- a 50,000-document lexical-search benchmark and bounded spatial rendering
  checks.

Exact current limitations and performance evidence are maintained in
[Known limitations](known-limitations.md) and
[Performance baseline](performance-baseline.md).

## Deferred provider capabilities

Paid-provider generative AI, embeddings, semantic search, grounded Q&A, and a
successful external imported-audio transcription request are deferred. Their
boundaries remain capability-gated, and no mock response counts as operational
verification. Local lexical search, local OCR/PDF extraction, and the rest of
the application remain independent of those providers.

## Operator checklist

Before publishing a deployment:

1. Build from a clean reviewed commit and run the complete release commands in
   the root README.
2. Apply every migration in filename order and deploy only the required Edge
   Functions.
3. Configure public browser keys in the client and private credentials only in
   server-side secrets.
4. Run authenticated RLS, Storage, sharing, revocation, backup, and account
   lifecycle smoke checks against the target project.
5. Verify service-worker install, update, deep-link, and offline reload on the
   target host.
6. Publish the limitations that apply to that host and Supabase plan.
