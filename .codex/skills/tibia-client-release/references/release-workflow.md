# Tibia client release workflow

This workflow prepares a new `dudantas/tibia-client` release from a client zip or extracted client folder. It exists to support OTClient auto-installation, so the final release must be valid when downloaded through GitHub raw/codeload.

## Inputs

Required:

- Path to the client zip or extracted client folder.

Derive when possible:

- Full release tag from `partial.package.json.version`, `package.json.version`, or another version marker in the client files. Example: `15.13.02dfc3`.
- Short branch version from the first two numeric version components. Example: `15.13`.

Ask the user only if the version cannot be derived safely.

## Git preflight

Run before modifying files:

```powershell
git status --short --branch
git branch -vv
git fetch origin --tags
```

Do not work on `main`. Default to a branch named `version-<major.minor>` for modern releases, for example `version-15.13`. If the branch already exists, inspect it before reusing it.

Create a branch from `origin/main` unless the user explicitly requested another base:

```powershell
git switch main
git pull --ff-only origin main
git switch -c version-<major.minor>
```

If the branch tracks the wrong upstream, fix that before committing or pushing.

## Extract the client

Extract the supplied zip into a temporary staging directory outside the repository. Inspect the top level before copying anything.

Expected release content usually includes directories such as:

- `assets/`
- `sounds/`
- `bin/`
- `conf/`
- `storeimages/`
- `assets.json`
- `package.json`
- `partial.package.json.version` or another version marker

When replacing repository contents, preserve repository control and process files:

- `.git/`
- `.gitattributes`
- `.gitignore`
- `AGENTS.md`
- `docs/`
- `.codex/`

Do not preserve stale runtime assets from an older client version unless the new package intentionally contains them.

## Normalize repository control files

Keep `.gitattributes` present and ensure release metadata is LF-normalized. At minimum, `.gitattributes` should keep these patterns:

```gitattributes
*.json text eol=lf
*.sha256 text eol=lf
*.md text eol=lf
*.lzma binary
*.ogg binary
*.dat binary
*.bmp binary
*.png binary
*.dll binary
*.exe binary
*.pak binary
*.rar binary
```

Keep `bin/Qt6WebEngineCore.dll` ignored in `.gitignore`.

## Package large runtime files

If the client contains `bin/Qt6WebEngineCore.dll`, do not commit the raw DLL. Create or replace `bin/Qt6WebEngineCore.rar`:

```powershell
Set-Location bin
Rar.exe a -ep -m5 Qt6WebEngineCore.rar Qt6WebEngineCore.dll
Set-Location ..
```

The `-ep` flag matters. The archive must contain `Qt6WebEngineCore.dll` at the archive root, not `bin/Qt6WebEngineCore.dll`.

After creating the RAR, remove the raw DLL from the Git candidate set and verify it is ignored:

```powershell
git check-ignore -v bin\Qt6WebEngineCore.dll
```

## Fix assets.json for repository-backed downloads

`assets.json` must be self-contained for OTClient auto-installation. Every relative `url` must exist in this repository.

The official CipSoft update flow may reference `.lzma` files that are not present here. Do not try to invent those compressed files. If the repository has only the unpacked file, update the entry:

- `url`: raw repository file path, for example `assets/catalog-content.json`
- `unpack`: `false`
- `packedhash`: SHA-256 of the raw repository file
- `packedsize`: byte length of the raw repository file
- `unpackedhash`: same SHA-256 when the field exists
- `unpackedsize`: same byte length when the field exists
- `localfile`: final installed path expected by OTClient

For entries that still point to a real `.lzma` file, `packedhash` and `packedsize` must match the `.lzma`, while `unpackedhash` and `unpackedsize` must match the decompressed output.

Do not use `package.json` as proof that OTClient auto-install works. `package.json` can follow the official package/update shape and may reference package files that are not stored in this repository. OTClient auto-install is gated by `assets.json`, `assets.json.sha256`, and the files referenced by `assets.json`.

## Recalculate assets.json.sha256

Calculate `assets.json.sha256` from the LF-normalized `assets.json` bytes that will be committed:

```powershell
$hash = (Get-FileHash -Algorithm SHA256 assets.json).Hash.ToLowerInvariant()
Set-Content -NoNewline -Encoding ascii assets.json.sha256 $hash
```

Run `git ls-files --eol assets.json assets.json.sha256` and confirm the working tree uses LF.

## Validate before commit

Run:

```powershell
node .codex\skills\tibia-client-release\scripts\validate-release.mjs
git diff --check
git status --short --branch
```

The validator must report:

- `missingCount=0`
- `badCount=0`
- matching `assets.json.sha256`
- no tracked raw `bin/Qt6WebEngineCore.dll`
- valid `bin/Qt6WebEngineCore.rar` layout when the RAR exists

## Commit

Before committing, repeat:

```powershell
git status --short --branch
git branch -vv
```

Use the existing commit style:

```powershell
git add <release files>
git commit -m "feat: client <major.minor>"
```

If the commit only changes process documentation or skills, use a `docs:` message.

## Publish branch, tag, and release

Only publish when the user explicitly asked for release publication.

Push branches with an explicit target:

```powershell
git push -u origin HEAD:version-<major.minor>
```

Prefer merging through the normal GitHub flow before tagging `main`. Existing modern releases are tagged with names such as `15.11.c9d1cf`.

After the release commit is on the intended target branch or `main`, create and push the tag:

```powershell
git tag -a <full-version-tag> -m "<full-version-tag>"
git push origin refs/tags/<full-version-tag>
```

Create the GitHub release:

```powershell
gh release create <full-version-tag> --repo dudantas/tibia-client --title "<full-version-tag>" --notes "<full-version-tag>" --latest
```

Before publishing, confirm no tag or release with that name already exists:

```powershell
git ls-remote --tags origin <full-version-tag>
gh release view <full-version-tag> --repo dudantas/tibia-client
```

If either command finds an existing tag/release, stop and ask how to proceed.

## Final report

Report:

- branch name and commit SHA
- release tag, if created
- GitHub release URL, if created
- `assets.json.sha256`
- validation summary
- whether `bin/Qt6WebEngineCore.rar` was created or reused
