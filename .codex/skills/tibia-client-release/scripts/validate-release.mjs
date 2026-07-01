#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootArgIndex = process.argv.indexOf('--root');
const root = resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd());
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readRelative(path) {
  return readFileSync(join(root, path));
}

function hasCrLf(buffer) {
  return buffer.includes(Buffer.from('\r\n'));
}

function normalizeRepoPath(path) {
  return String(path || '').replaceAll('\\\\', '/');
}

function isRemoteUrl(path) {
  return /^https?:\/\//i.test(String(path || ''));
}

const assetsJsonPath = join(root, 'assets.json');
const assetsJsonShaPath = join(root, 'assets.json.sha256');

if (!existsSync(assetsJsonPath)) {
  fail('assets.json not found');
}

if (!existsSync(assetsJsonShaPath)) {
  fail('assets.json.sha256 not found');
}

let entries = [];
let actualManifestHash = '';

if (existsSync(assetsJsonPath)) {
  const manifestBytes = readRelative('assets.json');
  actualManifestHash = sha256(manifestBytes);

  if (hasCrLf(manifestBytes)) {
    fail('assets.json uses CRLF line endings; commit LF bytes before hashing');
  }

  try {
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    entries = Array.isArray(manifest) ? manifest : manifest.files;
    if (!Array.isArray(entries)) {
      fail('assets.json must be an array or an object with a files array');
      entries = [];
    }
  } catch (error) {
    fail(`assets.json is not valid JSON: ${error.message}`);
  }
}

if (existsSync(assetsJsonShaPath)) {
  const expectedManifestHash = readRelative('assets.json.sha256').toString('utf8').trim().toLowerCase();
  if (hasCrLf(readRelative('assets.json.sha256'))) {
    fail('assets.json.sha256 uses CRLF line endings');
  }
  if (actualManifestHash && expectedManifestHash !== actualManifestHash) {
    fail(`assets.json.sha256 mismatch: expected ${expectedManifestHash}, got ${actualManifestHash}`);
  }
}

let missingCount = 0;
let badCount = 0;
let remoteCount = 0;

for (const entry of entries) {
  const url = normalizeRepoPath(entry.url);
  if (!url) {
    fail('assets.json entry without url');
    badCount++;
    continue;
  }

  if (isRemoteUrl(url)) {
    remoteCount++;
    continue;
  }

  const filePath = join(root, url);
  if (!existsSync(filePath)) {
    missingCount++;
    fail(`missing file referenced by assets.json: ${url}`);
    continue;
  }

  const bytes = readFileSync(filePath);
  const hash = sha256(bytes);
  const size = statSync(filePath).size;

  if (entry.packedhash && String(entry.packedhash).toLowerCase() !== hash) {
    badCount++;
    fail(`packedhash mismatch for ${url}: expected ${entry.packedhash}, got ${hash}`);
  }

  if (entry.packedsize != null && Number(entry.packedsize) !== size) {
    badCount++;
    fail(`packedsize mismatch for ${url}: expected ${entry.packedsize}, got ${size}`);
  }

  if (entry.unpack === false && entry.unpackedhash && String(entry.unpackedhash).toLowerCase() !== hash) {
    badCount++;
    fail(`unpackedhash mismatch for raw entry ${url}: expected ${entry.unpackedhash}, got ${hash}`);
  }

  if (entry.unpack === false && entry.unpackedsize != null && Number(entry.unpackedsize) !== size) {
    badCount++;
    fail(`unpackedsize mismatch for raw entry ${url}: expected ${entry.unpackedsize}, got ${size}`);
  }
}

const rawWebEngineDll = join(root, 'bin', 'Qt6WebEngineCore.dll');
if (existsSync(rawWebEngineDll)) {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'bin/Qt6WebEngineCore.dll'], {
    cwd: root,
    encoding: 'utf8',
  });
  const ignored = spawnSync('git', ['check-ignore', '-q', 'bin/Qt6WebEngineCore.dll'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (tracked.status === 0) {
    fail('bin/Qt6WebEngineCore.dll is tracked; remove the raw DLL from Git and publish bin/Qt6WebEngineCore.rar');
  } else if (ignored.status !== 0) {
    fail('bin/Qt6WebEngineCore.dll exists but is not ignored by .gitignore');
  } else {
    warn('bin/Qt6WebEngineCore.dll exists locally but is ignored; ensure only bin/Qt6WebEngineCore.rar is staged');
  }
}

const webEngineRar = join(root, 'bin', 'Qt6WebEngineCore.rar');
if (existsSync(webEngineRar)) {
  const sevenZip = spawnSync('7z', ['l', webEngineRar], { encoding: 'utf8' });
  if (sevenZip.error) {
    fail(`unable to verify bin/Qt6WebEngineCore.rar with 7z: ${sevenZip.error.message}`);
  } else if (sevenZip.status !== 0) {
    fail(`7z failed to list bin/Qt6WebEngineCore.rar: ${sevenZip.stderr || sevenZip.stdout}`);
  } else {
    const listing = sevenZip.stdout.replaceAll('\\\\', '/');
    if (!listing.includes('Qt6WebEngineCore.dll')) {
      fail('bin/Qt6WebEngineCore.rar does not contain Qt6WebEngineCore.dll');
    }
    if (listing.includes('bin/Qt6WebEngineCore.dll')) {
      fail('bin/Qt6WebEngineCore.rar contains a nested bin/ path; recreate it with Rar.exe a -ep');
    }
  }
} else {
  warn('bin/Qt6WebEngineCore.rar not found; this is only valid if the client does not ship Qt6WebEngineCore.dll');
}

console.log(`root=${root}`);
console.log(`assetsJsonSha256Ok=${actualManifestHash}`);
console.log(`entries=${entries.length}`);
console.log(`remoteUrlCount=${remoteCount}`);
console.log(`missingCount=${missingCount}`);
console.log(`badCount=${badCount}`);

for (const message of warnings) {
  console.warn(`WARNING: ${message}`);
}

if (errors.length > 0) {
  for (const message of errors) {
    console.error(`ERROR: ${message}`);
  }
  process.exit(1);
}

console.log('releaseValidationOk=true');
