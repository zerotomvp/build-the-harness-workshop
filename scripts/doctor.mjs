// npm run doctor: checks this machine is ready for the workshop.
// Each line says ok, or what to fix. Exit code 1 if anything must be fixed.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
let failed = false
const line = (status, what, fix) => {
  console.log(`${status.padEnd(4)} ${what}${fix ? `\n     ${fix}` : ''}`)
  if (status === 'FIX') failed = true
}
const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: win, timeout: 15_000, ...opts })

// Node and Git
const major = Number(process.versions.node.split('.')[0])
if (major >= 22) line('ok', `Node.js ${process.versions.node}`)
else line('FIX', `Node.js ${process.versions.node} is too old`, 'Install Node.js 22 or later (see the README).')

const git = run('git', ['--version'])
if (git.status === 0) line('ok', git.stdout.trim())
else line('FIX', 'Git not found', 'Install Git (see the README).')

// Dependencies
const sqlite = spawnSync(process.execPath, ['-e', "require('better-sqlite3')(':memory:').close()"], {
  cwd: path.join(root, 'api'),
  encoding: 'utf8',
})
if (existsSync(path.join(root, 'node_modules')) && sqlite.status === 0) line('ok', "the lab's dependencies are installed")
else line('FIX', "the lab's dependencies are missing or didn't build", 'Run npm install in the lab folder.')

// Updates
if (git.status === 0 && run('git', ['fetch', '--quiet'], { cwd: root }).status === 0) {
  const behind = run('git', ['rev-list', '--count', 'HEAD..@{u}'], { cwd: root })
  if (behind.status === 0 && Number(behind.stdout.trim()) > 0)
    line('FIX', 'the lab has updates you have not pulled', 'Run git pull, then npm install.')
  else if (behind.status === 0) line('ok', 'the lab is up to date')
}

// Agents: found, signed in, and running project hooks.
// Each check sends one short prompt from a scratch folder whose project settings
// hold a hook that writes a marker file. That prompt uses your own plan or API key.
const scratch = path.join(root, '.lab', 'doctor')
const marker = (agent) => path.join(scratch, agent, 'hook-ran')
const hookCommand = (agent) =>
  `node "${path.join(scratch, agent, 'hook.mjs').replaceAll('\\', '/')}"`

function prepare(agent, settingsFile, settings) {
  const dir = path.join(scratch, agent)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(path.dirname(path.join(dir, settingsFile)), { recursive: true })
  writeFileSync(
    path.join(dir, 'hook.mjs'),
    `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(marker(agent))}, 'ok')\n`,
  )
  writeFileSync(path.join(dir, settingsFile), JSON.stringify(settings, null, 2))
  return dir
}

const PROMPT = 'Reply with the single word: ok'
const read = (file) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

// Why hooks didn't run, where a file we can read says so. Organisations can also manage
// both agents in ways no local file shows (MDM, the vendor's admin console).
function claudeBlocked() {
  const managed = {
    darwin: '/Library/Application Support/ClaudeCode/managed-settings.json',
    win32: 'C:\\Program Files\\ClaudeCode\\managed-settings.json',
  }[process.platform] ?? '/etc/claude-code/managed-settings.json'
  if (/"(allowManagedHooksOnly|disableAllHooks)"\s*:\s*true/.test(read(managed)))
    return `Your organisation's managed settings (${managed}) allow only its own hooks.`
}
function codexBlocked() {
  const home = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
  const config = path.join(home, 'config.toml')
  if (/^\s*(hooks|codex_hooks)\s*=\s*false/m.test(read(config)))
    return `Your own Codex config switches hooks off: remove "hooks = false" under [features] in ${config}.`
  const req = process.platform === 'win32' ? '' : '/etc/codex/requirements.toml'
  if (req && /allow_managed_hooks_only\s*=\s*true|^\s*hooks\s*=\s*false/m.test(read(req)))
    return `Your organisation's Codex requirements (${req}) allow only its own hooks.`
}
const agents = [
  {
    name: 'Claude Code',
    bin: 'claude',
    settingsFile: '.claude/settings.json',
    // Like the lab's own settings, this sets disableAllHooks to false, which overrides a true in your user settings.
    settings: (cmd) => ({ disableAllHooks: false, hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd }] }] } }),
    args: () => ['-p', PROMPT],
    blocked: claudeBlocked,
    signIn: 'Run claude once and finish signing in.',
  },
  {
    name: 'Codex',
    bin: 'codex',
    settingsFile: '.codex/hooks.json',
    settings: (cmd) => ({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd }] }] } }),
    // Codex runs project hooks only in trusted folders, so the scratch folder is trusted for this run.
    args: (dir) => ['exec', '--skip-git-repo-check', '--trust', '--dangerously-bypass-hook-trust', '-C', dir, PROMPT],
    signIn: 'Run codex once and finish signing in.',
    blocked: codexBlocked,
  },
]

let found = 0
let ready = 0
for (const a of agents) {
  const version = run(a.bin, ['--version'])
  if (version.status !== 0) {
    line('--', `${a.name} not found`)
    continue
  }
  found++
  line('ok', `${a.name} found (${version.stdout.trim().split('\n').pop()})`)
  const dir = prepare(a.bin, a.settingsFile, a.settings(hookCommand(a.bin)))
  const r = run(a.bin, a.args(dir), { cwd: dir, timeout: 180_000, input: '' })
  const reply = `${r.stdout ?? ''}`.toLowerCase()
  if (r.status !== 0 || !reply.includes('ok')) {
    const detail = `${r.stderr ?? ''}${r.stdout ?? ''}`.trim().split('\n').slice(-2).join(' ')
    line('FIX', `${a.name} didn't answer a test prompt${detail ? `: ${detail.slice(0, 200)}` : ''}`, a.signIn)
    continue
  }
  line('ok', `${a.name} is signed in`)
  if (existsSync(marker(a.bin)) && readFileSync(marker(a.bin), 'utf8') === 'ok') {
    line('ok', `${a.name} runs project hooks`)
    ready++
  } else {
    line(
      'WARN',
      `${a.name} didn't run a project hook`,
      `${a.blocked() ?? 'Your settings or your organisation\'s may block project hooks.'} Try the steps under "If hooks don't run" in the README. Everything until phase 2 works without hooks.`,
    )
  }
}
if (found === 0) line('FIX', 'no coding agent found', 'Install Claude Code or Codex and sign in (see the README). Open a new terminal afterwards.')
rmSync(scratch, { recursive: true, force: true })

console.log(failed ? '\nFix the lines marked FIX, then run npm run doctor again.' : ready ? '\nReady for the workshop.' : '\nReady, with the warnings above.')
process.exit(failed ? 1 : 0)
