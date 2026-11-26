// npm run harness -- on | off | hide | show
//   on    wire the post-edit hook (harness/check-edit.mjs) for Claude Code and Codex
//   off   remove that wiring
//   hide  (facilitator demo, Claude Code only) move harness/ out of the repository and stop the
//         agent reading the harness, so a demo tests the hook and not the agent's reading
//   show  undo hide
// Everything stays inside the lab folder, except the hidden harness, which goes in the system's
// temp directory until show.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const at = (...p) => path.join(root, ...p)
const claudeSettings = at('.claude', 'settings.json')
const claudeLocal = at('.claude', 'settings.local.json')
const codexHooks = at('.codex', 'hooks.json')
const record = at('.lab', 'hidden-harness.json')
const fail = message => {
  console.error(message)
  process.exit(1)
}
const readJson = file =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}
const readText = file =>
  existsSync(file) ? readFileSync(file, 'utf8') : undefined
const restoreText = (file, text) => {
  if (text === undefined) rmSync(file, { force: true })
  else {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

// Claude Code: after every edit or shell command, run the hook. onFailure: "block" makes a hook
// that crashes or times out block the edit instead of being skipped. disableAllHooks: false
// overrides a "true" in your own user settings.
const claudeHook = (command, onFailure = true) => ({
  disableAllHooks: false,
  hooks: {
    PostToolUse: [
      {
        matcher: 'Edit|MultiEdit|Write|Bash',
        hooks: [
          {
            type: 'command',
            command,
            ...(onFailure ? { onFailure: 'block' } : {}),
          },
        ],
      },
    ],
  },
})
// Codex: the same hook after apply_patch and shell commands. Codex has no setting that makes a
// failing hook block.
const codexHook = {
  hooks: {
    PostToolUse: [
      {
        matcher: '^(apply_patch|Edit|Write|Bash|shell|exec_command)$',
        hooks: [
          {
            type: 'command',
            command:
              'node "$(git rev-parse --show-toplevel)/harness/check-edit.mjs"',
            timeout: 60,
          },
        ],
      },
    ],
  },
}

const command = process.argv[2]
const hidden = readJson(record)

if (command === 'on') {
  if (hidden) fail('The harness is hidden. Run npm run harness -- show first.')
  if (!existsSync(at('harness', 'check-edit.mjs')))
    fail('harness/check-edit.mjs is missing. It arrives with phase 2.')
  writeJson(claudeSettings, {
    ...readJson(claudeSettings),
    ...claudeHook('node "$CLAUDE_PROJECT_DIR/harness/check-edit.mjs"'),
  })
  writeJson(codexHooks, codexHook)
  // Work that is already uncommitted (your phase 0 run, say) isn't checked after every shell
  // command until it changes again; the hook keeps that list in .lab/hook-state.json.
  const state = {}
  const status = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: root, encoding: 'utf8' }
  )
  for (const entry of status.split('\n')) {
    const f = entry.slice(3).trim()
    const rel = f.includes(' -> ') ? f.split(' -> ')[1] : f
    if (rel && existsSync(at(rel)))
      state[rel] = createHash('sha1')
        .update(readFileSync(at(rel)))
        .digest('hex')
  }
  writeJson(at('.lab', 'hook-state.json'), state)
  console.log(
    'The post-edit hook is on for Claude Code (.claude/settings.json) and Codex (.codex/hooks.json).'
  )
  console.log(
    'Both run harness/check-edit.mjs. Codex asks you to trust the folder and the hook (/hooks) the first time.'
  )
} else if (command === 'off') {
  if (hidden) fail('The harness is hidden. Run npm run harness -- show first.')
  const settings = readJson(claudeSettings)
  if (settings) {
    delete settings.hooks
    delete settings.disableAllHooks
    if (Object.keys(settings).length) writeJson(claudeSettings, settings)
    else rmSync(claudeSettings)
  }
  rmSync(codexHooks, { force: true })
  console.log('The post-edit hook is off.')
} else if (command === 'hide') {
  if (hidden) fail(`The harness is already hidden, in ${hidden.path}.`)
  if (!existsSync(at('harness', 'check-edit.mjs')))
    fail('harness/check-edit.mjs is missing. It arrives with phase 2.')
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bth-hidden-harness-'))
  cpSync(at('harness'), dir, { recursive: true })
  const saved = {
    path: dir,
    claudeSettings: readText(claudeSettings),
    claudeLocal: readText(claudeLocal),
    codexHooks: readText(codexHooks),
  }
  writeJson(record, saved)
  rmSync(at('harness'), { recursive: true, force: true })
  // Claude Code only: the hook runs from the hidden folder. No onFailure here: a hook that crashes
  // is skipped, which is Claude Code's default and Codex's only behaviour.
  const settings = readJson(claudeSettings) ?? {}
  delete settings.hooks
  writeJson(claudeSettings, { ...settings, disableAllHooks: false })
  const hook = `node "${path.join(dir, 'check-edit.mjs').replaceAll('\\', '/')}"`
  const abs = p => `//${p.replaceAll('\\', '/').replace(/^\/+/, '')}`
  writeJson(claudeLocal, {
    ...readJson(claudeLocal),
    ...claudeHook(hook, false),
    permissions: {
      deny: [
        `Read(${abs(dir)}/**)`,
        'Read(./lint-rules/**)',
        'Read(./eslint.config.js)',
        'Read(./.claude/**)',
      ],
    },
  })
  rmSync(codexHooks, { force: true })
  console.log(`The harness is hidden in ${dir}`)
  console.log(
    `The hook now runs from ${path.join(dir, 'check-edit.mjs')} (Claude Code only), and Claude Code can't read it,`
  )
  console.log(
    'the rule source, the ESLint config or .claude/. npm run harness -- show puts everything back.'
  )
} else if (command === 'show') {
  if (!hidden) fail('The harness is not hidden.')
  if (existsSync(path.join(hidden.path, 'check-edit.mjs'))) {
    rmSync(at('harness'), { recursive: true, force: true })
    cpSync(hidden.path, at('harness'), { recursive: true })
    rmSync(hidden.path, { recursive: true, force: true })
  } else {
    execFileSync('git', ['checkout', 'HEAD', '--', 'harness'], {
      cwd: root,
      stdio: 'inherit',
    })
    console.log(`${hidden.path} was gone, so harness/ was restored from Git.`)
  }
  restoreText(claudeSettings, hidden.claudeSettings)
  restoreText(claudeLocal, hidden.claudeLocal)
  restoreText(codexHooks, hidden.codexHooks)
  rmSync(record)
  console.log(
    'The harness is back in harness/, with the hook wiring it had before hide.'
  )
  let changed = ''
  try {
    changed = execFileSync('git', ['status', '--porcelain', '--', 'harness'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    // not a Git repository
  }
  if (changed)
    console.log(
      `harness/ differs from the last commit (the hook you broke?):\n${changed}\ngit checkout -- harness restores it.`
    )
} else {
  fail('Usage: npm run harness -- on | off | hide | show')
}
