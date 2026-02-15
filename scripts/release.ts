import { $ } from 'bun'

const level = process.argv[2] as 'patch' | 'minor' | 'major' | undefined

if (!level || !['patch', 'minor', 'major'].includes(level)) {
  console.error('Usage: bun run release <patch|minor|major>')
  process.exit(1)
}

const branch = (await $`git branch --show-current`.text()).trim()
if (branch !== 'main') {
  console.error(`ERROR: must be on "main" branch (currently on "${branch}")`)
  process.exit(1)
}

const status = (await $`git status --porcelain`.text()).trim()
if (status) {
  console.error('ERROR: working tree is not clean, commit or stash changes first')
  process.exit(1)
}

await $`git pull --ff-only`

const version = (await $`bun pm version ${level}`.text()).trim()
console.log(`Bumped to ${version}`)
console.log(`Run "git push --follow-tags" to publish the release.`)
