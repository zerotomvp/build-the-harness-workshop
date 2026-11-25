// npm run trial -- transfer [--no-rules] [--agent claude|codex]
// Runs your coding agent on a second task in a copy of the lab, so your own work is never touched.
// The run happens in a folder in the system's temp directory, away from the lab's own AGENTS.md,
// and the finished copy is moved to .lab/trials/<name>/ for you to look at.
// The agent runs on your own plan or API key.
import crossSpawn from 'cross-spawn'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const TASKS = {
  transfer:
    "Members can transfer credit to another member of their group. Make reasonable assumptions, don't ask me questions, and finish with tests.",
}
const task = args.find((a) => !a.startsWith('--'))
if (!task || !TASKS[task]) fail(`Usage: npm run trial -- <task> [--no-rules] [--agent claude|codex]\nTasks: ${Object.keys(TASKS).join(', ')}`)
const noRules = args.includes('--no-rules')
const agentArg = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : undefined

const has = (bin) => crossSpawn.sync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000 }).status === 0
const agent = agentArg ?? (has('claude') ? 'claude' : has('codex') ? 'codex' : undefined)
if (!agent) fail('No coding agent found. Run npm run doctor.')
if (!['claude', 'codex'].includes(agent)) fail('--agent must be claude or codex.')
if (!agentArg && agent === 'claude' && has('codex')) console.log('Using Claude Code (pass --agent codex to use Codex).')
if (!noRules && !existsSync(path.join(root, 'AGENTS.md'))) fail('There is no AGENTS.md in the lab yet. Write it first (phase 1, step 2), or pass --no-rules.')

const name = `${task}-${noRules ? 'no-rules' : 'rules'}-${agent}-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}`
const work = mkdtempSync(path.join(os.tmpdir(), 'bth-trial-'))
const copy = path.join(work, 'lab')

// Copy your working tree as it is now, including uncommitted changes, without dependencies,
// Git history, earlier trials or your agent's local settings.
const skip = new Set(['node_modules', '.git', '.lab'])
cpSync(root, copy, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(root, src)
    if (!rel) return true
    const parts = rel.split(path.sep)
    if (parts.some((p) => skip.has(p))) return false
    return rel !== path.join('.claude', 'settings.local.json')
  },
})
if (noRules) rmSync(path.join(copy, 'AGENTS.md'), { force: true })
// Dependencies are linked, not copied: the trial can run npm test without a new install.
for (const dir of ['', 'api', 'web']) {
  const modules = path.join(root, dir, 'node_modules')
  if (existsSync(modules)) symlinkSync(modules, path.join(copy, dir, 'node_modules'), 'junction')
}
const git = (...a) => crossSpawn.sync('git', a, { cwd: copy, encoding: 'utf8' })
git('init', '-q')
// The linked dependencies are symlinks, which the lab's node_modules/ pattern doesn't ignore.
writeFileSync(path.join(copy, '.git', 'info', 'exclude'), 'node_modules\n')
git('add', '-A')
git('-c', 'user.name=trial', '-c', 'user.email=trial@lab.invalid', 'commit', '-q', '-m', 'Trial start')

console.log(`Running ${agent === 'claude' ? 'Claude Code' : 'Codex'} on "${task}" ${noRules ? 'without' : 'with'} your rules. This takes 5 to 8 minutes; carry on meanwhile.`)
const prompt = TASKS[task]
const lastMessage = path.join(work, 'summary.txt')
const run =
  agent === 'claude'
    ? crossSpawn.sync(
        'claude',
        ['-p', prompt, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(git:*)'],
        { cwd: copy, encoding: 'utf8', input: '', maxBuffer: 64 * 1024 * 1024 },
      )
    : crossSpawn.sync('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', copy, '-o', lastMessage, prompt], {
        cwd: copy,
        encoding: 'utf8',
        input: '',
        maxBuffer: 64 * 1024 * 1024,
      })
const summary = agent === 'claude' ? run.stdout : existsSync(lastMessage) ? readFileSync(lastMessage, 'utf8') : run.stdout

// Keep the result in the lab: the copy, with what the agent changed as one commit, without its
// linked dependencies.
git('add', '-A')
git('-c', 'user.name=trial', '-c', 'user.email=trial@lab.invalid', 'commit', '-q', '--allow-empty', '-m', `Trial result (${agent})`)
for (const dir of ['', 'api', 'web']) {
  const link = path.join(copy, dir, 'node_modules')
  try {
    unlinkSync(link)
  } catch {
    try {
      rmdirSync(link)
    } catch {
      // not there
    }
  }
}
const dest = path.join(root, '.lab', 'trials', name)
mkdirSync(path.dirname(dest), { recursive: true })
cpSync(copy, dest, { recursive: true })
rmSync(work, { recursive: true, force: true })

if (run.status !== 0 && !summary?.trim()) fail(`The agent stopped with an error:\n${`${run.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n')}\nThe copy is in ${dest}`)
console.log(`\n--- The agent's summary ---\n${summary?.trim()}\n---------------------------`)
console.log(`\nThe copy is in ${path.relative(root, dest)}. To see what the agent changed: git -C ${path.relative(root, dest)} show --stat HEAD`)
