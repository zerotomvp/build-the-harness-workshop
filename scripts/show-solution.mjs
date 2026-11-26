// Opens the suggested solution for one phase, its incremental patch, side by
// side in your browser: only what the phase asks you to write, without the
// next phase's starting point.
// Run it with `npm run show-solution -- PHASE`, for example `npm run show-solution -- 2`.
// Extra arguments go to diff2html, for example `-s line` for one column.
// The viewer is a lab dependency (diff2html-cli), so nothing is downloaded at run time;
// the page it opens is written to your system's temp directory.
// show-solution.html is diff2html's page with long lines that wrap.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkForUpdate,
  fail,
  findPhase,
  loadManifest,
  run,
  verifiedPatch,
} from './patches.mjs'

const [name, ...options] = process.argv.slice(2)
const manifest = loadManifest()
await checkForUpdate(manifest)
const phase = findPhase(manifest, name)
if (!phase.incremental) {
  // Not an error: phase 0 asks for no code. Point at the next phase that has a solution.
  const next = manifest.phases
    .slice(manifest.phases.indexOf(phase) + 1)
    .find(later => later.incremental)
  console.log(
    `${phase.id} has no code to write, so it has no solution to show.` +
      (next
        ? `\nTry \`npm run show-solution -- ${next.id.replace('phase-', '')}\`.`
        : '')
  )
  process.exit(0)
}

const patch = verifiedPatch(phase.incremental)
// BTH_SOLUTION_VIEWER lets the tests record the call instead of opening a browser.
let cli = process.env.BTH_SOLUTION_VIEWER
if (!cli) {
  try {
    const require = createRequire(import.meta.url)
    const pkg = require.resolve('diff2html-cli/package.json')
    cli = join(dirname(pkg), require(pkg).bin.diff2html)
  } catch {
    fail('The solution viewer is missing. Run npm install in the lab folder.')
  }
}
console.log(
  `Opening the ${phase.id} solution (since ${phase.incrementalFrom ?? 'the workshop base'}) in your browser...`
)
run(
  process.execPath,
  [
    cli,
    '-s',
    'side',
    '-t',
    `${phase.id}: ${phase.title}`,
    '--hwt',
    fileURLToPath(new URL('show-solution.html', import.meta.url)),
    ...options,
    '-i',
    'file',
    '--',
    patch,
  ],
  { stdio: 'inherit' }
)
