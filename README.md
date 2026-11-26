# Build the Harness

The lab for **Build the Harness: Guardrails That Make Agent-Written Code Safe to Merge**, a
three-hour remote workshop at AI Coding Summit Berlin on Thursday 26 November 2026, 16:00–19:00
Berlin time.

## Before the workshop

You need:

- **Node.js 22 or later.** Check with `node --version`.
  - macOS: `brew install node`, or the installer from nodejs.org.
  - Windows: the installer from nodejs.org, or `winget install OpenJS.NodeJS.LTS`. Use PowerShell
    or Windows Terminal for every command in the workshop.
  - Linux: your distribution's package, the binaries from nodejs.org, or `nvm`.
- **Git.** Check with `git --version`.
  - macOS: `xcode-select --install`, or `brew install git`.
  - Windows: Git for Windows from git-scm.com. It also installs Git Bash, which Claude Code uses
    to run some hooks.
  - Linux: your distribution's package.
- **One coding agent, installed and signed in.** You need one of these, not both:
  - **Claude Code:** `npm install -g @anthropic-ai/claude-code`, then run `claude` once and sign
    in. A Claude subscription or an Anthropic API key works.
  - **Codex:** `npm install -g @openai/codex`, then run `codex` once and sign in. A ChatGPT
    subscription or an OpenAI API key works.

Everything you run with your agent in the workshop, including the doctor's checks, uses your own
plan or API key.

Then get the lab and check your setup:

```sh
git clone https://github.com/zerotomvp/build-the-harness-workshop.git
cd build-the-harness-workshop
npm install
npm run doctor
```

Each line says `ok`, or what to fix:

- **"no coding agent found":** the agent isn't on your path. Open a new terminal after installing
  it.
- **"didn't answer a test prompt":** run `claude` or `codex` once and finish signing in.
- **"didn't run a project hook":** see [If hooks don't run](#if-hooks-dont-run).
- **"the lab has updates":** run `git pull`, then `npm install`.

Run `npm run doctor` again on the day: the lab gets updates until the workshop starts.

### If hooks don't run

From phase 2 on, the lab uses hooks: scripts your agent runs after each edit. Company laptops often
restrict them, but not always completely. Try these in order:

#### Claude Code

1. **Trust the lab folder.** The first time you start `claude` in the lab, accept the prompt to
   trust the folder. In an interactive session, Claude Code holds back hooks from every settings
   file until you do.
2. **Check your own settings.** `"disableAllHooks": true` in `~/.claude/settings.json` switches
   hooks off. The lab's project settings set it back to `false`, so this only matters if it's set
   somewhere the lab can't override.
3. **Look at what's loaded.** In a session, `/hooks` lists the hooks Claude Code loaded. Once the
   lab's hook is on (phase 2), it should appear there.

#### Codex

1. **Trust the lab folder.** Codex loads a project's hooks only from folders you trust. Start
   `codex` in the lab and accept the trust prompt.
2. **Trust the hook itself.** Codex skips a new or changed hook until you review it, and warns at
   startup. Open `/hooks` and trust the lab's hook.
3. **Check your own config.** `hooks = false` under `[features]` in `~/.codex/config.toml`
   switches hooks off. Remove it.

**If none of that works**, your organisation allows only the hooks it deploys itself (Claude Code:
`allowManagedHooksOnly`; Codex: `allow_managed_hooks_only` or `[features] hooks = false` in its
requirements). Only your IT department can change that. Use the other agent if it isn't
restricted, or a personal machine. Otherwise you can follow the hook exercises on screen: everything
until phase 2 works without hooks.

## What we'll do

1. **The baseline.** Give your agent a real feature task with no harness, and check what it hands
   back.
2. **Repository instructions.** An `AGENTS.md` every agent session reads.
3. **A check that fails the build.** A lint rule written for the model, wired to a hook.
4. **Guard the guard.** What happens when the hook breaks, and how you'd know.
5. **Validation the model doesn't grade.** Tests written from cases you decide, by a session that
   can't see the code.
6. **Your own repository.** One rule from your team, enforced in your own codebase.

Walkthroughs are shared during the workshop.

## The app: Hive

Hive is a small community app: people join groups, sign up for sessions, keep
track of what they owe, and chat with the rest of the group.

- **Groups** are open (anyone can join) or invite-only (request to join, or use an invite link).
- **Members** have a role: `member`, `admin` or `treasurer`.
- **Sessions** are group events that members RSVP to. Groups can charge a drop-in price per session.
- **Fees**: the treasurer sets the group's prices, records payments and runs monthly dues. Each
  member has a balance of what they owe.
- **Chat**: every group has one chat room.

### Layout

```text
api/   Hono + better-sqlite3 API (TypeScript)
web/   React + Vite client
```

### Running locally

Requires Node 22 or later.

```sh
npm install
npm run dev
```

The API listens on <http://localhost:3000> and the web app on <http://localhost:5173>
(Vite proxies `/api` to the API). The SQLite database is created at
`api/hive.db` and seeded on first start.

Sign in with any seeded account: `alice@hive.test` (admin of Riverside Runners),
`bob@hive.test` (treasurer of Riverside Runners), `carla@hive.test`,
`dev@hive.test` (treasurer of Thursday Night Chess) or `erin@hive.test` (admin of
Thursday Night Chess). Seeded accounts also have fixed API tokens of the form
`dev-<name>`, e.g. `Authorization: Bearer dev-alice`.

To reset the data, run `npm run seed`, or start the API with `HIVE_DEV_SEED=1`
and call `POST /dev/seed`.

### Tests and lint

```sh
npm test          # API tests (vitest, in-memory SQLite)
npm run lint      # ESLint
npm run typecheck # tsc for api and web
```

### Configuration

| Variable        | Default   | Purpose                               |
| --------------- | --------- | ------------------------------------- |
| `PORT`          | `3000`    | API port                              |
| `DATABASE_PATH` | `hive.db` | SQLite file (relative to `api/`)      |
| `HIVE_DEV_SEED` | unset     | Set to `1` to enable `POST /dev/seed` |
