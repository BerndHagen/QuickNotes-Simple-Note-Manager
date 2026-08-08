# QuickNotes release notes

Stable release notes are curated product communication, not generated commit
logs. Each versioned tag must have a matching Markdown document in this
directory. For example, tag `v2.3.0` requires `docs/releases/v2.3.0.md`.

## Editorial standard

1. Open with one concise paragraph that explains the release theme and who
   benefits from it.
2. Organize the body by product area with level-three headings. Do not use a
   generic feature/fix bucket when a clearer area such as "Mobile Editing" or
   "Sharing and Identity" exists.
3. Start every bullet with a bold outcome, followed by the user impact and any
   context needed to understand the change.
4. Describe behavior, reliability, and workflow improvements. Avoid commit
   titles, implementation inventories, file names, arbitrary change counts,
   repeated bullets, and internal back-and-forth that does not matter in the
   final product.
5. Keep known limitations explicit, but do not turn the notes into a test log.
6. End with the standard issue and discussion links from `TEMPLATE.md`.

## Publishing a stable release

1. Update the package and in-app version labels.
2. Copy `TEMPLATE.md` to `vX.Y.Z.md` and write the final notes.
3. Commit and push the release candidate, then verify the deployed build.
4. Create and push the `vX.Y.Z` tag.

The release workflow refuses to publish a stable tag without its curated note
file. The rolling `latest` prerelease uses a separate build-ledger format and
is updated automatically from `main`.
