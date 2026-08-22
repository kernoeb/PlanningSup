/**
 * Planning URL checker
 *
 * Fetches every URL of `resources/plannings/*.json` and says which ones no longer
 * serve a calendar. The JSON shape itself is checked by `test/plannings.schema.test.ts`.
 *
 * ADE numbers its years with a `projectId`. When a school rolls over to the next
 * year, the old id stops returning events and every group of that school looks
 * empty. With `--fix` the checker tries the other ids and rewrites the URLs.
 *
 * Usage:
 *   bun scripts/check-plannings-urls.ts
 *   bun scripts/check-plannings-urls.ts --only insa-rennes,iut-quimper
 *   bun scripts/check-plannings-urls.ts --only insa-rennes --fix
 *   bun scripts/check-plannings-urls.ts --sample 10
 *
 * Options:
 *   --only <a,b>       file names to check, without ".json" (default: all)
 *   --fix              rewrite the projectId when another one serves events
 *   --sample <n>       check one URL out of n, for a quick look (default: all)
 *   --concurrency <n>  parallel requests (default: 20)
 *   --delay <ms>       pause after each request, to stay gentle with the ADE servers (default: 200)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    fix: { type: 'boolean', default: false },
    sample: { type: 'string', default: '1' },
    concurrency: { type: 'string', default: '20' },
    delay: { type: 'string', default: '200' },
  },
})

const PLANNINGS_DIR = path.join(import.meta.dirname, '..', 'resources', 'plannings')
const MAX_PROJECT_ID = 10
const TIMEOUT_MS = 20_000

type Status = 'ok' | 'empty' | 'dead'

interface Check {
  readonly template: string
  readonly url: string
  status: Status
  fixedTo?: string
}

const today = new Date()
const inSixMonths = new Date(today)
inSixMonths.setMonth(today.getMonth() + 6)
const [firstDate, lastDate] = [today, inSixMonths].map(date => date.toISOString().split('T')[0]!)

function expand(template: string): string {
  return template.replace('{date-start}', firstDate).replace('{date-end}', lastDate)
}

/** An ADE server answers an empty body, HTML or a plain text error when it dislikes the request. */
async function classify(url: string): Promise<Status> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en-US,en' }, // Otherwise ADE localises "The project is invalid"
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return 'dead'

    const body = await res.text()
    if (!body.includes('BEGIN:VCALENDAR') || body.includes('<html')) return 'dead'
    return body.includes('BEGIN:VEVENT') ? 'ok' : 'empty'
  } catch {
    return 'dead'
  }
}

/** Try the other ADE years and keep the first one that actually has events. */
async function findWorkingProjectId(url: string): Promise<string | null> {
  const current = url.match(/projectId=(\d+)/)?.[1]
  if (current === undefined) return null

  for (let projectId = 0; projectId <= MAX_PROJECT_ID; projectId++) {
    if (String(projectId) === current) continue
    const candidate = url.replace(/projectId=\d+/, `projectId=${projectId}`)
    if (await classify(candidate) === 'ok') return String(projectId)
  }

  return null
}

async function runTasks<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  let done = 0

  const worker = async () => {
    while (index < items.length) {
      await run(items[index++]!)
      process.stdout.write(`\r  ${++done}/${items.length}`)
      // A university ADE box is small; a checker should not look like a flood.
      await new Promise(resolve => setTimeout(resolve, Number(args.delay)))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  process.stdout.write('\r')
}

const only = args.only?.split(',').map(name => name.trim()).filter(Boolean)
const files = fs.readdirSync(PLANNINGS_DIR)
  .filter(file => file.endsWith('.json'))
  .filter(file => !only || only.includes(file.replace('.json', '')))

if (!files.length) throw new Error(`No planning file matches --only ${args.only}`)

const sample = Number(args.sample)
const concurrency = Number(args.concurrency)
let broken = 0

for (const file of files) {
  const filePath = path.join(PLANNINGS_DIR, file)
  let content = fs.readFileSync(filePath, 'utf8')

  const templates: string[] = []
  JSON.parse(content, (key, value) => {
    if (key === 'url') templates.push(value as string)
    return value
  })

  const checks: Check[] = templates
    .filter((_, index) => index % sample === 0)
    .map(template => ({ template, url: expand(template), status: 'dead' as Status }))

  console.log(`\n${file} (${checks.length}${sample > 1 ? ` of ${templates.length}` : ''} urls)`)

  await runTasks(checks, concurrency, async (check) => {
    check.status = await classify(check.url)
  })

  const suspect = checks.filter(check => check.status !== 'ok')
  if (suspect.length && args.fix) {
    console.log(`  looking for a working projectId on ${suspect.length} urls`)
    await runTasks(suspect, concurrency, async (check) => {
      const projectId = await findWorkingProjectId(check.url)
      if (projectId) check.fixedTo = projectId
    })
  }

  const fixed = checks.filter(check => check.fixedTo)
  for (const check of fixed) {
    content = content.replaceAll(check.template, check.template.replace(/projectId=\d+/, `projectId=${check.fixedTo}`))
  }
  if (fixed.length) {
    fs.writeFileSync(filePath, content)
    const ids = [...new Set(fixed.map(check => check.fixedTo))]
    console.log(`  fixed ${fixed.length} urls (projectId -> ${ids.join(', ')})`)
  }

  const count = (status: Status) => checks.filter(check => check.status === status && !check.fixedTo).length
  const stillBroken = count('empty') + count('dead')
  broken += stillBroken
  console.log(`  ${count('ok')} ok, ${count('empty')} empty, ${count('dead')} dead${fixed.length ? `, ${fixed.length} fixed` : ''}`)

  for (const check of checks.filter(c => c.status === 'dead' && !c.fixedTo).slice(0, 5)) {
    console.log(`    dead: ${check.url}`)
  }
}

console.log(`\n${broken} urls still need a look`)
