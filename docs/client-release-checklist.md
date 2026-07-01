# Client release checklist

This repository is consumed by OTClient auto-installation and by release/update tooling. Before publishing a new client version, validate the release with the checks below.

## Files used by OTClient auto-install

OTClient auto-install uses:

- `assets.json`
- `assets.json.sha256`
- files referenced by `assets.json`
- the GitHub source archive for the selected tag
- optional packaged archives such as `bin/Qt6WebEngineCore.rar`

`assets.json` must be self-contained. Every `url` in `assets.json` must exist in this repository at release time.

If a file from the official CipSoft update flow exists only in unpacked form in this repository, do not leave `assets.json` pointing at a missing `.lzma` file. Point `url` at the unpacked repository file, set `unpack` to `false`, and make `packedhash` and `packedsize` match the actual repository file bytes.

Example shape:

```json
{
  "url": "assets/catalog-content.json",
  "unpack": false,
  "packedhash": "<sha256 of assets/catalog-content.json>",
  "packedsize": 123,
  "localfile": "assets/catalog-content.json"
}
```

For entries that still use `.lzma`, `packedhash` and `packedsize` must match the `.lzma` file, while `unpackedhash` and `unpackedsize` must match the final installed file.

## Text normalization

Keep `.gitattributes` in the repository. JSON and `.sha256` files must be committed with LF line endings. This matters because OTClient validates bytes downloaded from GitHub raw/codeload, not the bytes in a local Windows working tree.

Do not calculate `assets.json.sha256` from a CRLF working copy. It must be the SHA-256 of the committed LF `assets.json`.

## Large Qt WebEngine DLL

Do not commit `bin/Qt6WebEngineCore.dll` directly. Keep it ignored and publish it as:

- `bin/Qt6WebEngineCore.rar`

The archive must contain `Qt6WebEngineCore.dll` at the archive root. It must not contain a nested `bin/` directory.

From the repository root:

```powershell
Set-Location bin
Rar.exe a -ep -m5 Qt6WebEngineCore.rar Qt6WebEngineCore.dll
Set-Location ..
7z l bin\Qt6WebEngineCore.rar
```

The `7z l` output should show `Qt6WebEngineCore.dll` without a leading `bin\` path.

## Package manifest note

`package.json` follows the official client package/update shape and may reference `.lzma` files that are not stored in this repository. Do not treat `package.json` as the OTClient auto-install source unless those referenced package files are actually present.

For OTClient assets, validate `assets.json`.

## Release validation

Run these checks from the repository root before tagging or publishing a release.

Verify `assets.json.sha256`:

```powershell
$expected = (Get-Content -Raw assets.json.sha256).Trim().ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 assets.json).Hash.ToLowerInvariant()
if ($expected -ne $actual) {
  throw "assets.json.sha256 mismatch: expected $expected, got $actual"
}
```

Verify every `assets.json` URL exists:

```powershell
$manifest = Get-Content -Raw assets.json | ConvertFrom-Json
$missing = @($manifest.files | Where-Object { -not (Test-Path -LiteralPath $_.url -PathType Leaf) })
if ($missing.Count -gt 0) {
  $missing | Select-Object url, localfile
  throw "assets.json references missing files"
}
```

Verify `packedhash` and `packedsize`:

```powershell
$manifest = Get-Content -Raw assets.json | ConvertFrom-Json
$bad = New-Object System.Collections.Generic.List[string]
foreach ($file in $manifest.files) {
  if (-not (Test-Path -LiteralPath $file.url -PathType Leaf)) {
    $bad.Add("missing: $($file.url)")
    continue
  }

  $item = Get-Item -LiteralPath $file.url
  if ($null -ne $file.packedsize -and [int64]$file.packedsize -ne $item.Length) {
    $bad.Add("size: $($file.url)")
  }

  if ($file.packedhash) {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.url).Hash.ToLowerInvariant()
    if ($hash -ne ([string]$file.packedhash).ToLowerInvariant()) {
      $bad.Add("hash: $($file.url)")
    }
  }
}

if ($bad.Count -gt 0) {
  $bad
  throw "assets.json validation failed"
}
```

Verify the WebEngine archive layout:

```powershell
7z l bin\Qt6WebEngineCore.rar
```

The listed path should be `Qt6WebEngineCore.dll`.

## Do not stage runtime noise

Review `git status --short` before committing. Do not stage local runtime files such as logs, caches, crash dumps, or the raw `bin/Qt6WebEngineCore.dll` unless a release contract explicitly requires them.
