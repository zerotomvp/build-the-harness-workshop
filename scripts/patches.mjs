// Shared by the scripts that import, apply and show the phase patches. The
// patch zip comes from the attendee page and is imported once into
// .lab/patches/ inside this clone. Git ignores .lab/, so resets and time
// travel leave it alone, and it works offline. Nothing is written outside the
// lab folder.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import spawn from 'cross-spawn'

export const slug = 'build-the-harness'
export const attendeePage = `https://zerotomvp.dev/workshops/attend?workshop=${slug}`
export const labRoot = fileURLToPath(new URL('..', import.meta.url))
// Tests point these at temporary folders and local servers.
export const patchesDir = process.env.BTH_PATCHES_DIR ?? join(labRoot, '.lab', 'patches')
const versionUrl =
  process.env.BTH_VERSION_URL ?? `https://zmvp-workshops.s3.fr-par.scw.cloud/public/${slug}/version.json`

export const download = `Download the patch zip from the attendee page (${attendeePage}), then run: npm run import-patches -- PATH_TO_ZIP`

export function fail(message) {
  console.error(message)
  process.exit(1)
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function run(command, args, options = {}) {
  const result = spawn.sync(command, args, { encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed:\n${result.error?.message ?? result.stderr ?? ''}`)
  }
  return result.stdout?.trimEnd()
}

export function loadManifest() {
  const path = join(patchesDir, 'manifest.json')
  if (!existsSync(path)) fail(`No workshop patches found in ${patchesDir}.\n${download}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Accepts "3", "phase-3", or "baseline", the finished pack-task run that
// phase 0 ends with.
export function findPhase(manifest, name) {
  const id = /^\d+$/.test(name ?? '') ? `phase-${name}` : name === 'baseline' ? 'phase-0' : name
  const phase = manifest.phases.find((p) => p.id === id)
  if (phase) return phase
  const phases = manifest.phases.map((p) => `  ${p.id.padEnd(8)} ${p.title}`)
  fail(`${name ? `Unknown phase ${name}. ` : ''}Choose one of:\n${phases.join('\n')}`)
}

// Returns the path of a patch after checking it against the manifest.
export function verifiedPatch(patch) {
  const path = join(patchesDir, patch.path)
  if (!existsSync(path) || sha256(readFileSync(path)) !== patch.sha256) {
    fail(`${path} is missing or damaged.\n${download}`)
  }
  return path
}

// Online, warns when the attendee page has newer patches; offline, says nothing.
export async function checkForUpdate(manifest) {
  const latest = await fetch(versionUrl, { signal: AbortSignal.timeout(3000) })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
  if (latest && isNewer(latest.version, manifest.version)) {
    console.warn(`Newer workshop patches are available: ${latest.version} (you have ${manifest.version}).\n${download}\n`)
  }
}

function isNewer(version, than) {
  const [a, b] = [version, than].map((v) => String(v).split('.').map(Number))
  const diff = a.map((part, i) => part - b[i]).find((d) => d !== 0)
  return diff > 0
}

// Reads every file in a zip archive through its central directory.
export function unzip(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('not a zip file')
  const files = new Map()
  let entry = zip.readUInt32LE(end + 16)
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const method = zip.readUInt16LE(entry + 10)
    const size = zip.readUInt32LE(entry + 20)
    const nameLength = zip.readUInt16LE(entry + 28)
    const skip = nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32)
    const name = zip.toString('utf8', entry + 46, entry + 46 + nameLength).replace(/^\.\//, '')
    const header = zip.readUInt32LE(entry + 42)
    const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28)
    const data = zip.subarray(start, start + size)
    if (method !== 0 && method !== 8) throw new Error(`cannot unpack ${name}`)
    if (!name.endsWith('/')) files.set(name, method === 0 ? data : inflateRawSync(data))
    entry += 46 + skip
  }
  return files
}
