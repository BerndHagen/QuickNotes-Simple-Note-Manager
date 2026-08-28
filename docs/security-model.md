# Security model

## Trust boundaries

The browser client, imported files, note HTML, URLs, recognition/provider
responses, and sync payloads are untrusted. Supabase RLS, Storage policies,
RPC validation, triggers, and authenticated server functions enforce remote
authorization; hiding a control is not enforcement.

Owner IDs are derived from the authenticated session/server policy. Local
stores and queues are owner scoped to prevent account switching from exposing
another workspace. Sharing grants note/resource reads and only the documented
correction/document permissions. Shared spatial and annotation writes are
owner-only. Revocation removes remote visibility immediately.

## Content and imports

Rendered rich HTML is sanitized. External URLs use validated protocols and
new-window links prevent opener access. Backup/import parsing is bounded,
rejects unsafe object keys and invalid references, and validates binary SHA-256
before a single import write. PDF scripting/evaluation is disabled.

The production CSP limits scripts, workers, connections, frames, and objects.
The current GitHub Pages-style static deployment cannot set every HTTP-only
header (notably `frame-ancestors`); deployments behind a configurable server
should add CSP and anti-framing headers at the HTTP layer.

## Secrets and providers

Only the Supabase public project URL/anon key belong in client configuration.
Paid provider credentials are server-held Edge Function secrets and are never
accepted from application UI or stored in notes/backups. Local-only privacy
mode cannot fall back to browser-managed/external processing. External work
requires explicit mode, fresh operation consent, authentication, bounded input,
and a successful live capability probe.

The release audit found no production dependency vulnerability with
`npm audit --omit=dev`. Supabase Auth leaked-password protection is unavailable
on the connected Free project and is therefore not claimed by the hosted 3.0
release. It remains optional operational hardening for a deployment using an
applicable plan, followed by renewed authentication smoke checks.
