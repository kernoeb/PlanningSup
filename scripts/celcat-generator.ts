/**
 * Celcat generator
 *
 * Builds a `resources/plannings/*.json` file from a Celcat "webpub" site, the kind
 * Nantes université runs (https://edt.univ-nantes.fr/<site>/).
 *
 * The site publishes one page listing every group, `gindex.html`, and one ICS file
 * per group, `g<id>.ics`. The group ids change every academic year, which is what
 * breaks the stored URLs, so the whole file is rebuilt from the index.
 *
 * Groups are nested one level deep, under the first word of their name: "BUT2 GEMA1"
 * goes under "BUT". Groups whose calendar holds no upcoming event are dropped, since
 * they are last year's leftovers; pass --keep-empty to see them all.
 *
 * Usage:
 *   bun scripts/celcat-generator.ts --url https://edt.univ-nantes.fr/iut_nantes \
 *     --title "IUT de Nantes" --group Nantes --out resources/plannings/iut-de-nantes.json
 *
 * Options:
 *   --url <base>       site root, without gindex.html
 *   --out <file>       output file
 *   --title <string>   planning title
 *   --group <string>   planning group, e.g. "Nantes"
 *   --keep-empty       keep the groups with no upcoming event
 *   --concurrency <n>  parallel requests (default: 10)
 *   --delay <ms>       pause after each request (default: 150)
 */

import fs from 'node:fs'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    'url': { type: 'string' },
    'out': { type: 'string' },
    'title': { type: 'string' },
    'group': { type: 'string' },
    'keep-empty': { type: 'boolean', default: false },
    'concurrency': { type: 'string', default: '10' },
    'delay': { type: 'string', default: '150' },
  },
})

if (!args.url || !args.out || !args.title) throw new Error('Needs --url, --out and --title')

const base = args.url.replace(/\/$/, '')
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

interface Leaf { id: string, title: string, url: string }

function slug(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[/&,()\s.]/g, '').toLowerCase()
}

/**
 * First word of the name, digits kept, so a level lands in its own folder:
 * "GACO1-FI-G1" -> "GACO1", "L1 EG Gpe 4" -> "L1". A leading number is an
 * internal code, not a name: "918-MASTER 2 Management" -> "MASTER".
 */
function groupName(title: string): string {
  const words = title.match(/[\p{L}\p{N}]+/gu) ?? []
  return words.find(word => !/^\d+$/.test(word)) ?? 'Autres'
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  // The pages carry a stale <meta charset="ISO-8859-1"> but are served as UTF-8.
  // Trust the header, which res.text() reads, or accents come out as mojibake.
  return res.text()
}

/** Keep only the groups with an event still to come; the others are last year's. */
async function hasUpcomingEvent(url: string): Promise<boolean> {
  try {
    const ics = await fetchText(url)
    return [...ics.matchAll(/^DTSTART(?:;[^:\n]*)?:(\d{8})/gm)].some(match => match[1]! >= today)
  } catch {
    return false
  }
}

async function runTasks<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  let done = 0

  const worker = async () => {
    while (index < items.length) {
      await run(items[index++]!)
      process.stdout.write(`\r  ${++done}/${items.length}`)
      await new Promise(resolve => setTimeout(resolve, Number(args.delay)))
    }
  }

  await Promise.all(Array.from({ length: Math.min(Number(args.concurrency), items.length) }, worker))
  process.stdout.write('\r')
}

const index = await fetchText(`${base}/gindex.html`)
const leaves: Leaf[] = [...index.matchAll(/<option\s+value="(g\d+)\.html"\s*>\s*([^<\n]*)/gi)]
  .map(match => ({ id: match[1]!, title: match[2]!.trim(), url: `${base}/${match[1]}.ics` }))
  .filter(leaf => leaf.title)

if (!leaves.length) throw new Error(`No group found in ${base}/gindex.html`)
console.log(`${leaves.length} groups listed`)

let kept = leaves
if (!args['keep-empty']) {
  const upcoming = new Set<string>()
  await runTasks(leaves, async (leaf) => {
    if (await hasUpcomingEvent(leaf.url)) upcoming.add(leaf.id)
  })
  kept = leaves.filter(leaf => upcoming.has(leaf.id))
  console.log(`${kept.length} groups have an upcoming event, ${leaves.length - kept.length} dropped`)
}

// Sort first so both the folder labels and their order come out the same every run.
const groups = new Map<string, { label: string, members: Leaf[] }>()
for (const leaf of kept.toSorted((a, b) => collator.compare(a.title, b.title))) {
  const label = groupName(leaf.title)
  // "MASTER" and "Master" are the same folder.
  const group = groups.get(label.toUpperCase()) ?? { label, members: [] }
  group.members.push(leaf)
  groups.set(label.toUpperCase(), group)
}

const planning = {
  title: args.title,
  ...(args.group ? { group: args.group } : {}),
  children: [...groups.values()]
    .sort((a, b) => collator.compare(a.label, b.label))
    .map(group => ({ id: slug(group.label), title: group.label, children: group.members })),
}

fs.writeFileSync(args.out, `${JSON.stringify(planning, null, 2)}\n`)
console.log(`Written: ${args.out} (${planning.children.length} folders)`)
