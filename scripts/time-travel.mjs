// Moves this clone to the end of a phase: it resets the clone to the workshop
// base and applies that phase's cumulative patch.
// Run it with `npm run time-travel -- PHASE`, for example `npm run time-travel -- 3`,
// or `npm run time-travel -- baseline` for the finished pack-task run.
// It never touches .lab/ (your trial runs and the imported patches): Git ignores it.
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import spawn from 'cross-spawn'
import { checkForUpdate, fail, findPhase, loadManifest, run, verifiedPatch } from './patches.mjs'

const [name] = process.argv.slice(2).filter((arg) => arg !== '--yes')
const manifest = loadManifest()
await checkForUpdate(manifest)
const phase = findPhase(manifest, name)
const patch = phase.cumulative && verifiedPatch(phase.cumulative)

// Stashes and time-travel commits need an author, even on a fresh machine,
// and must not wait for a signing key.
const identity = ['-c', 'user.name=Workshop time travel', '-c', 'user.email=time-travel@zerotomvp.dev', '-c', 'commit.gpgsign=false']
const git = (...args) => run('git', [...identity, ...args])
// npm runs scripts from the lab folder; work from the top of its repository.
process.chdir(git('rev-parse', '--show-toplevel'))

const base = manifest.publicBase.commit
const hasBase = () => spawn.sync('git', ['cat-file', '-e', `${base}^{commit}`]).status === 0
if (!hasBase()) {
  console.log('Fetching the workshop base...')
  git('fetch', '--quiet', manifest.publicBase.remote)
  if (!hasBase()) fail(`This clone cannot reach the workshop base ${base}.`)
}

// Anything that is not exactly the base or a phase end state is your own work.
const uncommitted = git('status', '--porcelain')
const phaseTrees = [manifest.publicBase.tree, ...manifest.phases.map((p) => p.tree)]
const committed = !phaseTrees.includes(git('rev-parse', 'HEAD^{tree}'))
let saved
if (uncommitted || committed) {
  console.log(`Time travel to ${phase.id} replaces your work in this clone:`)
  if (committed) console.log('  commits that are not the end of a workshop phase')
  if (uncommitted) console.log(uncommitted.replace(/^/gm, '  '))
  console.log('It saves them first: commits on a branch, other changes in the Git stash.')
  console.log('To keep a copy somewhere else as well, answer N, save it, and run this again.')
  if (!process.argv.includes('--yes') && !(await confirm('Replace your work? [y/N] '))) {
    fail('Nothing changed.')
  }
  if (uncommitted) git('stash', 'push', '--include-untracked', '--message', `Before time travel to ${phase.id}`)
  if (committed) {
    saved = `saved/${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
    git('branch', saved)
  }
}

const lockfile = () => (existsSync('package-lock.json') ? readFileSync('package-lock.json', 'utf8') : '')
const lockfileBefore = lockfile()
git('reset', '--hard', '--quiet', base)
if (patch) {
  git('apply', '--index', patch)
  git('commit', '--quiet', '--no-verify', '--message', `Time travel to ${phase.id}: ${phase.title}`)
}
if (lockfile() !== lockfileBefore || !existsSync('node_modules')) {
  run('npm', ['install', '--no-audit', '--no-fund'], { stdio: 'inherit' })
}

console.log(`\nThis clone is now at the end of ${phase.id}: ${phase.title}.`)
console.log('If `npm run dev` is running, stop it and start it again.')
if (uncommitted) console.log('Your uncommitted changes are in the stash: git stash pop brings them back.')
if (saved) console.log(`Your commits are on branch ${saved}: git diff ${saved} compares them.`)

async function confirm(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const closed = new Promise((resolve) => prompt.once('close', () => resolve('')))
  const answer = await Promise.race([prompt.question(question), closed])
  prompt.close()
  return /^y(es)?$/i.test(answer.trim())
}
