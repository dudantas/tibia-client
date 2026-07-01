# AGENTS.md

## Client Release Gate

Before changing release assets, read `docs/client-release-checklist.md`.

For full release preparation from a client zip, use the repository skill at `.codex/skills/tibia-client-release/SKILL.md`.

Mandatory checks:

1. Keep `.gitattributes` present so JSON and `.sha256` files are committed with LF line endings.
2. Recalculate `assets.json.sha256` from the committed LF `assets.json`.
3. Validate that every `url` in `assets.json` exists in the repository.
4. If this repository does not include an official `.lzma` package file, do not leave `assets.json` pointing at it. Use the repository file directly with `unpack: false` and matching `packedhash`/`packedsize`.
5. Keep `bin/Qt6WebEngineCore.dll` out of Git and publish it through `bin/Qt6WebEngineCore.rar`.
6. Ensure `bin/Qt6WebEngineCore.rar` contains `Qt6WebEngineCore.dll` at the archive root, not inside a nested `bin/` directory.
7. Do not use `package.json` as proof that OTClient auto-install works. The OTClient flow is gated by `assets.json`, `assets.json.sha256`, and the files referenced by `assets.json`.
