/**
 * ADE portal generator
 *
 * Builds a whole `resources/plannings/*.json` file from the ADE "portal" REST API
 * (ADE 7 web app, e.g. https://planning.univ-rennes.fr/portal/).
 *
 * The old flow needed a browser: expand the whole tree in the DOM, scrape it with
 * `browser.js`, then call the GWT RPC endpoint with `shu-generator.js`. The portal
 * exposes both steps as JSON, and the anonymous ("sans sesame") login needs no
 * credentials, so everything runs headless:
 *
 *   POST RestApi/portal/shuplogin                     -> bearer token + JSESSIONID
 *   GET  RestApi/portal/projects                      -> list of years
 *   GET  RestApi/portal/projects/:id/resourcestree     -> the full tree
 *   GET  RestApi/portal/projects/:id/icalurl?...       -> permanent .shu URL of a leaf
 *
 * Usage:
 *   bun scripts/ade-portal-generator.ts --list
 *   bun scripts/ade-portal-generator.ts --branch ISTIC --title ISTIC --group Rennes
 *   bun scripts/ade-portal-generator.ts --branch ISTIC --out resources/plannings/istic.json
 *   bun scripts/ade-portal-generator.ts --all --out-dir /tmp/plannings
 *
 * Options:
 *   --list                  show the projects and the top-level branches, then exit
 *   --branch <a,b>          top-level branches to export (id or name, case-insensitive)
 *   --all                   export every top-level branch
 *   --out <file>            output file (single branch only)
 *   --out-dir <dir>         output directory (default: resources/plannings)
 *   --title <string>        planning title (default: the branch name)
 *   --group <string>        planning group, e.g. "Rennes"
 *   --project <id|name>     project to read (default: the first one, i.e. the current year)
 *   --domain <host>         ADE host (default: planning.univ-rennes.fr)
 *   --shup <path>           anonymous entry point (default: /portal/consultation_sans_sesame.shup)
 *   --concurrency <n>       parallel icalurl requests (default: 8)
 *   --dry-run               build the tree without resolving any URL
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    'list': { type: 'boolean', default: false },
    'branch': { type: 'string' },
    'all': { type: 'boolean', default: false },
    'out': { type: 'string' },
    'out-dir': { type: 'string', default: path.join(import.meta.dirname, '..', 'resources', 'plannings') },
    'title': { type: 'string' },
    'group': { type: 'string' },
    'project': { type: 'string' },
    'domain': { type: 'string', default: 'planning.univ-rennes.fr' },
    'shup': { type: 'string', default: '/portal/consultation_sans_sesame.shup' },
    'concurrency': { type: 'string', default: '8' },
    'dry-run': { type: 'boolean', default: false },
  },
})

// The portal asks for a display config; 8 is the one its "export agenda" button uses.
// Any other value makes the server answer an empty file name.
const DISPLAY_CONFIG_ID = 8
const MAX_RETRIES = 10
const RETRY_DELAY_MS = 500

interface Leaf { id: number, name: string }
interface Branch { id: number, name: string, branch?: Branch[], leaf?: Leaf[] }
interface Project { id: number, name: string, uid: string }

type Node =
  | { id: string, title: string, children: Node[] }
  | { id: string, title: string, url: string }

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Same id shape as the historical browser script: no accents, no separators, lower case. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[/&,()\s.]/g, '')
    .toLowerCase()
}

class Portal {
  #token = ''
  #cookie = ''
  #expiresAt = 0

  constructor(private readonly domain: string, private readonly shupUrl: string) {}

  async #login(): Promise<void> {
    const res = await fetch(`https://${this.domain}/portal/RestApi/portal/shuplogin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ shupUrl: this.shupUrl }),
    })
    if (!res.ok) throw new Error(`shuplogin failed: ${res.status} ${res.statusText}`)

    const body = await res.json() as { data?: { token?: string } }
    const token = body.data?.token
    if (!token) throw new Error('shuplogin returned no token')

    const cookie = res.headers.getSetCookie().find(c => c.startsWith('JSESSIONID='))
    if (!cookie) throw new Error('shuplogin returned no JSESSIONID')

    const { exp } = JSON.parse(atob(token.split('.')[1]!)) as { exp: number }

    this.#token = token
    this.#cookie = cookie.split(';')[0]!
    this.#expiresAt = exp * 1000
  }

  /** The token lives 30 minutes; a full run is longer, so log in again before it dies. */
  async #session(): Promise<void> {
    if (Date.now() > this.#expiresAt - 120_000) await this.#login()
  }

  async get<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    await this.#session()

    const url = new URL(`https://${this.domain}/portal/RestApi/portal/${endpoint}`)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

    const res = await fetch(url, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${this.#token}`,
        'clienttimezone': 'Europe/Paris',
        'cookie': this.#cookie,
        'shupurl': this.shupUrl,
        'ADE-Interceptor-Force': 'true',
      },
    })
    if (!res.ok) throw new Error(`${endpoint} failed: ${res.status} ${res.statusText}`)

    const body = await res.json() as { data?: T, error?: { message?: string } }
    if (body.error) throw new Error(`${endpoint} failed: ${body.error.message}`)
    if (body.data === undefined) throw new Error(`${endpoint} returned no data`)

    return body.data
  }
}

/** Resolve the permanent .shu URL of one resource. */
async function resolveUrl(portal: Portal, projectId: number, resourceId: number): Promise<string | null> {
  // Dates do not change the generated URL, but the endpoint rejects the call without them.
  const year = new Date().getFullYear()
  const params = {
    resourcesIds: resourceId,
    calType: 'ical',
    firstDate: `${year}-01-01`,
    lastDate: `${year + 1}-12-31`,
    displayConfigId: DISPLAY_CONFIG_ID,
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = await portal.get<string>(`projects/${projectId}/icalurl`, params)
      // The server sometimes answers ".../plannings/.shu", without the file name.
      if (!url.endsWith('/.shu')) return url
    } catch (error) {
      if (attempt === MAX_RETRIES) console.error(`  ${resourceId}: ${(error as Error).message}`)
    }
    await delay(RETRY_DELAY_MS)
  }

  return null
}

// The API returns the tree in no particular order. Sorting keeps the files diffable
// from one run to the next; the picker sorts the same way before showing the tree.
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/** Walk one branch and collect every leaf that needs a URL. */
function buildTree(branch: Branch, tasks: { resourceId: number, node: { url: string } }[]): Node {
  const children: Node[] = []

  for (const child of branch.branch ?? []) {
    if (!child.name.trim()) {
      console.error(`  skipped unnamed branch ${child.id}`)
      continue
    }
    const subTree = buildTree(child, tasks)
    if ('children' in subTree && subTree.children.length === 0) continue
    children.push(subTree)
  }

  for (const leaf of branch.leaf ?? []) {
    // A few ADE resources have no name at all; a student could not tell them apart.
    if (!leaf.name.trim()) {
      console.error(`  skipped unnamed resource ${leaf.id}`)
      continue
    }
    const node = { id: slug(leaf.name) || `r${leaf.id}`, title: leaf.name.trim(), url: '' }
    tasks.push({ resourceId: leaf.id, node })
    children.push(node)
  }

  children.sort((a, b) => collator.compare(a.title, b.title))

  // Same names happen; number the duplicates once the order is settled, so the ids
  // stay the same whatever order the API used. Mutate in place: `tasks` shares the leaves.
  const usedIds = new Set<string>()
  for (const child of children) {
    let id = child.id
    for (let i = 2; usedIds.has(id); i++) id = `${child.id}-${i}`
    usedIds.add(id)
    ;(child as { id: string }).id = id
  }

  return { id: slug(branch.name) || `r${branch.id}`, title: branch.name.trim(), children }
}

/** Drop the leaves we could not resolve, and the branches left empty. */
function prune(node: Node): Node | null {
  if ('url' in node) return node.url ? node : null

  const children = node.children.map(prune).filter((child): child is Node => child !== null)
  return children.length ? { ...node, children } : null
}

async function runTasks<T>(items: T[], concurrency: number, run: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  let done = 0

  const worker = async () => {
    while (index < items.length) {
      await run(items[index++]!)
      process.stdout.write(`\r${++done}/${items.length}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  process.stdout.write('\n')
}

function countLeaves(branch: Branch): number {
  return (branch.leaf ?? []).length + (branch.branch ?? []).reduce((total, child) => total + countLeaves(child), 0)
}

const portal = new Portal(args.domain, args.shup)

/** "Emplois du temps 2026-2027" -> 2027, so we can pick the latest year by default. */
function lastYear(project: Project): number {
  return Math.max(0, ...(project.name.match(/\d{4}/g) ?? []).map(Number))
}

const projects = await portal.get<Project[]>('projects')
const project = args.project
  ? projects.find(p => String(p.id) === args.project || p.name.toLowerCase().includes(args.project!.toLowerCase()))
  // The API does not order the list, so never trust its first entry.
  : projects.toSorted((a, b) => lastYear(b) - lastYear(a))[0]
if (!project) throw new Error(`Project not found: ${args.project}`)

const categories = await portal.get<{ category: (Branch & { category: string })[] }>(`projects/${project.id}/resourcestree`)
// Only the "trainee" category holds the student groups we publish.
const branches = categories.category.flatMap(c => c.branch ?? [])

if (args.list) {
  console.log('Projects:')
  for (const p of projects) console.log(`  ${p.id}  ${p.name}${p.id === project.id ? '  (selected)' : ''}`)
  console.log(`\nTop-level branches of "${project.name}":`)
  for (const branch of branches) console.log(`  ${String(countLeaves(branch)).padStart(5)} leaves  ${String(branch.id).padStart(6)}  ${branch.name}`)
  process.exit(0)
}

/** Branches can be picked at any depth, by id or by name, not only at the top level. */
function findBranch(needle: string): Branch {
  const found: Branch[] = []
  const walk = (branch: Branch) => {
    if (String(branch.id) === needle || branch.name.toLowerCase() === needle.toLowerCase()) found.push(branch)
    for (const child of branch.branch ?? []) walk(child)
  }
  branches.forEach(walk)

  if (!found.length) throw new Error(`Branch not found: ${needle} (use --list)`)
  if (found.length > 1) throw new Error(`Branch name "${needle}" appears ${found.length} times, use its id`)
  return found[0]!
}

const wanted = args.all ? branches : (args.branch ?? '').split(',').map(name => name.trim()).filter(Boolean).map(findBranch)

if (!wanted.length) throw new Error('Nothing to do: pass --branch <name>, --all or --list')

console.log(`Project: ${project.name} (id ${project.id})`)

// With an explicit output file, every selected branch lands in the same planning.
const groups = args.out ? [wanted] : wanted.map(branch => [branch])

for (const group of groups) {
  const branch = group[0]!
  console.log(`\n${group.map(b => b.name).join(' + ')} (${group.reduce((total, b) => total + countLeaves(b), 0)} leaves)`)

  const tasks: { resourceId: number, node: { url: string } }[] = []
  // A single branch is the planning itself; several branches become its top-level entries.
  const tree = buildTree(group.length === 1 ? branch : { id: branch.id, name: branch.name, branch: group }, tasks)

  if (args['dry-run']) {
    for (const task of tasks) task.node.url = `dry-run://${task.resourceId}`
  } else {
    await runTasks(tasks, Number(args.concurrency), async ({ resourceId, node }) => {
      node.url = await resolveUrl(portal, project.id, resourceId) ?? ''
    })
  }

  const failed = tasks.filter(task => !task.node.url).length
  if (failed) console.error(`${failed} leaves dropped (no URL)`)

  const pruned = prune(tree)
  if (!pruned || !('children' in pruned)) {
    console.error(`Nothing to write for ${branch.name}`)
    continue
  }

  const planning = {
    title: args.title ?? branch.name,
    ...(args.group ? { group: args.group } : {}),
    children: pruned.children,
  }

  const out = args.out ?? path.join(args['out-dir'], `${slug(branch.name)}.json`)
  fs.writeFileSync(out, `${JSON.stringify(planning, null, 2)}\n`)
  console.log(`Written: ${out}`)
}
