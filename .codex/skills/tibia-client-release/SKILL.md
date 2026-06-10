---
name: tibia-client-release
description: Prepare, validate, commit, and optionally publish dudantas/tibia-client releases from a supplied Tibia client zip path. Use when the user provides a client zip or extracted client folder and asks Codex to create/update a tibia-client release branch, fix assets.json/assets.json.sha256, package large runtime files such as bin/Qt6WebEngineCore.rar, create tags, or publish a GitHub release for OTClient auto-installation.
---

# Tibia Client Release

## Workflow

Use this skill only in the `tibia-clients` repository. If the current working directory is another repo, switch to the local `tibia-clients` checkout first.

Read `references/release-workflow.md` before modifying files. It contains the required branch, manifest, archive, validation, and publication flow.

Use `scripts/validate-release.mjs` after changing release files and before committing, tagging, or publishing:

```powershell
node .codex\skills\tibia-client-release\scripts\validate-release.mjs
```

## Release Rules

- Treat `assets.json`, `assets.json.sha256`, and files referenced by `assets.json` as the OTClient auto-install contract.
- Do not leave `assets.json` pointing at missing `.lzma` files. If the official `.lzma` package is unavailable, point to the raw repository file and set `unpack` to `false`.
- Keep `bin/Qt6WebEngineCore.dll` out of Git. Package it as `bin/Qt6WebEngineCore.rar`, with `Qt6WebEngineCore.dll` at the archive root.
- Preserve `.gitattributes`, `.gitignore`, `AGENTS.md`, `docs/`, and `.codex/` when replacing client files from a zip.
- Do not push, tag, or publish a GitHub release unless the user explicitly asked for publication.
