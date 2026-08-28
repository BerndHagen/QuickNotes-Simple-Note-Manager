# Sync architecture

## Adapters

QuickNotes deliberately has several bounded synchronizers:

| Domain | Local authority | Remote domain |
| --- | --- | --- |
| Notes and catalog | Zustand plus Dexie canonical rows/snapshots | notes, folders, tags, saved views, templates, versions |
| Paper/Canvas | spatial documents/pages/objects/resources | spatial tables and image resources |
| Capture | resources/blobs/links/recognized content | private Storage plus capture tables |
| Annotation | annotation documents/pages/objects | annotation tables |

This separation prevents a PDF/audio upload or large spatial graph from being
embedded into `noteData` or routed through unrelated adapters.

## Delivery contract

Each outbox row is owner scoped and carries an immutable mutation ID. Updates
for one identity coalesce, but completion acknowledges only the exact mutation
that was sent. Canonical mutation and queue insertion are atomic. Stable IDs,
upserts, and safe deletes provide at-least-once replay behavior.

Capture upload order is resource bytes, metadata, link, then recognition;
deletion reverses dependencies. Large payloads use authenticated TUS. Download
hydration verifies SHA-256 before publishing a usable local attachment.

The active workspace owner gates every local adapter and intelligence job.
Web Locks serialize same-owner sync across supporting tabs; BroadcastChannel
plus a storage-event fallback reconciles committed cross-tab note changes.

## Server authority

Supabase Auth and RLS decide remote visibility/mutation rights. The client is
not an authorization boundary. Shared Document edits follow note permission;
capture reads/corrections follow the source note permission; shared spatial and
annotation writes are owner-only. Realtime is an invalidation/refresh signal,
not proof that a local write committed.
