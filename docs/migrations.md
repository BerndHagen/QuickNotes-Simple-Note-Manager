# Migrations

## IndexedDB

Dexie migrations are additive from v1 through v10. Existing store definitions
are retained while new domains are introduced; opening v3+ does not rewrite
all note content. Legacy records acquire owner/content descriptors through
deterministic normalization on hydration or ordinary writes.

Migration rules:

- never infer Paper/Canvas from payload shape;
- never rewrite original image/PDF/audio/ink with recognition output;
- reject unknown future canonical schema versions;
- derived indexes may be cleared/rebuilt;
- close an old tab on `versionchange` and display a reload gate;
- let an interrupted upgrade transaction roll back as one IndexedDB upgrade.

Automated migration tests open realistic legacy v1 data, upgrade through v10,
verify canonical byte preservation, exercise restart/idempotence, and inject an
upgrade failure to verify rollback.

## Supabase

SQL files in `supabase/migrations` are chronological and append-only. They
create the original catalog/collaboration schema, then saved views/templates,
spatial storage, capture/recognition, transcription quotas, annotations,
comments/mentions, optional intelligence quotas, and release hardening.

Release hardening includes obsolete policy removal, bounded JSON/text payloads,
restored tag clocks, shared-spatial read-only enforcement, and revocation of
unsafe catalog grants. Apply migrations through the deployment pipeline; do
not edit an already-deployed migration. After applying, inspect the live
schema, policies, grants, triggers, publication membership, Storage policies,
functions, and advisors.

Before any future destructive migration, create and verify a backup path and a
restart-safe rollback/recovery plan. No current browser migration is intended
to be destructive.
