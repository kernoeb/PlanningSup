/**
 * ENSEA generator
 *
 * Builds `resources/plannings/ensea.json` from ENSEA's ADE install
 * (https://ade.ensea.fr/), which is an ADE 6 "campus" whose public tree sits behind
 * CAS. There is no working anonymous iCal export here: `anonymous_cal.jsp` answers
 * "Le projet est invalide" for every id. The only channel that serves real events
 * without a login is the legacy RSS module, reached through a guest session:
 *
 *   GET anonymous_cal.jsp        -> mints a guest JSESSIONID (the error body is ignored)
 *   GET /jsp/rss?projectId=1&resources=<ids>&nbDays=<n>   -> the events, as RSS
 *
 * The same guest cookie serves every group, so the API fetches this RSS at refresh
 * time (see apps/api/src/utils/ade-rss.ts). This script only discovers the groups:
 * it walks the "Stagiaires" tree once and writes one RSS URL per class group.
 *
 * A group's RSS resource set is every resource leaf under it in the tree, so the whole
 * file is built from a single crawl, with no extra request per group. Class levels
 * that hold sub-groups also get a "Tout <name>" entry that merges the lot.
 *
 * Usage:
 *   bun scripts/ensea-generator.ts
 *   bun scripts/ensea-generator.ts --out resources/plannings/ensea.json --nb-days 400
 *
 * Options:
 *   --out <file>     output file (default: resources/plannings/ensea.json)
 *   --domain <host>  ADE host (default: ade.ensea.fr)
 *   --project <id>   ADE projectId, the current year (default: 1)
 *   --nb-days <n>    RSS window in days; ADE caps it at the loaded horizon (default: 400)
 *   --delay <ms>     pause after each tree request (default: 120)
 *   --dry-run        crawl and print the tree, write nothing
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    'out': { type: 'string', default: path.join(import.meta.dirname, '..', 'resources', 'plannings', 'ensea.json') },
    'domain': { type: 'string', default: 'ade.ensea.fr' },
    'project': { type: 'string', default: '1' },
    'nb-days': { type: 'string', default: '400' },
    'delay': { type: 'string', default: '120' },
    'dry-run': { type: 'boolean', default: false },
  },
})

const HOST = `https://${args.domain}`
const GUI = `${HOST}/jsp/standard/gui`
const PROJECT_ID = Number(args.project)
const NB_DAYS = Number(args['nb-days'])
const DELAY_MS = Number(args.delay)

const latin1 = new TextDecoder('iso-8859-1')
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let cookie = ''

/** GET a GUI page, keeping the guest cookie. JSP pages are ISO-8859-1, so decode as such. */
async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', ...(cookie ? { cookie } : {}) },
    tls: { rejectUnauthorized: false },
  } as RequestInit)
  const setCookie = res.headers.getSetCookie().find(c => c.startsWith('JSESSIONID='))
  if (setCookie) cookie = setCookie.split(';')[0]!
  return latin1.decode(await res.arrayBuffer())
}

/** Mint a guest session. openCategory/openBranch are toggles, so this never opens the tree. */
async function bootstrap(): Promise<void> {
  await get(`${HOST}/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=1&projectId=${PROJECT_ID}&calType=ical&nbWeeks=4`)
  await get(`${GUI}/menu.jsp?projectId=${PROJECT_ID}`)
}

interface RawNode { depth: number, id: number, name: string, isFolder: boolean, open: boolean }

/** One row is a <DIV class="treeline">; depth is three &nbsp; per level. */
function parseTree(html: string): RawNode[] {
  const nodes: RawNode[] = []
  for (const raw of html.split('<DIV class="treeline">').slice(1)) {
    const seg = raw.split('</DIV>')[0]!
    const nbsp = (seg.match(/^((?:&nbsp;)*)/)?.[1]?.match(/&nbsp;/g) || []).length
    const depth = Math.floor(nbsp / 3)
    const folder = /openBranch\((\d+)\)/.exec(seg)
    const leaf = /javascript:check\((\d+)/.exec(seg)
    const open = seg.includes('moins.gif')
    const name = decode(seg.match(/class="tree(?:branch|leaf)"><a [^>]*>([^<]*)<\/a>/)?.[1]?.trim() ?? '')
    if (folder) nodes.push({ depth, id: Number(folder[1]), name, isFolder: true, open })
    else if (leaf) nodes.push({ depth, id: Number(leaf[1]), name, isFolder: false, open: false })
  }
  return nodes
}

function decode(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').trim()
}

/** Same id shape as the other generators: no accents, no separators, lower case. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[/&,()\s.'-]/g, '')
    .toLowerCase()
}

/** Expand every "trainee" folder, then return the fully-open tree as flat rows. */
async function crawl(): Promise<RawNode[]> {
  let html = await get(`${GUI}/tree.jsp?category=trainee&expand=false&forceLoad=false&reload=false&scroll=0`)
  const expanded = new Set<number>()
  for (let i = 0; i < 500; i++) {
    const next = parseTree(html).find(n => n.isFolder && !n.open && !expanded.has(n.id))
    if (!next) break
    expanded.add(next.id)
    html = await get(`${GUI}/tree.jsp?branchId=${next.id}&expand=false&forceLoad=false&reload=false&scroll=0`)
    await delay(DELAY_MS)
  }
  return parseTree(html)
}

interface TreeNode { id: number, name: string, isFolder: boolean, children: TreeNode[] }

/** Rebuild the parent/child tree from the flat, depth-tagged rows. */
function buildTree(rows: RawNode[]): TreeNode[] {
  const roots: TreeNode[] = []
  const stack: TreeNode[] = []
  for (const row of rows) {
    if (row.name === 'Stagiaires' || row.name === 'Formateurs' || row.name === 'Salles' || row.name === 'Equipements') continue
    if (row.depth < 1) continue // only the four category names sit at depth 0, already skipped
    const node: TreeNode = { id: row.id, name: row.name, isFolder: row.isFolder, children: [] }
    stack.length = row.depth - 1 // depth 1 = a formation root; drop deeper frames
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
    if (row.isFolder) stack[row.depth - 1] = node
  }
  return roots
}

/** Every resource-leaf id under a node, i.e. the RSS resource set for that group. */
function subtreeResources(node: TreeNode): number[] {
  const ids: number[] = []
  const walk = (n: TreeNode) => {
    for (const c of n.children) {
      if (c.isFolder) walk(c)
      else ids.push(c.id)
    }
  }
  walk(node)
  return [...new Set(ids)].sort((a, b) => a - b)
}

function rssUrl(resources: number[]): string {
  return `${HOST}/jsp/rss?projectId=${PROJECT_ID}&resources=${resources.join(',')}&nbDays=${NB_DAYS}`
}

type Element
  = { id: string, title: string, children: Element[] }
  | { id: string, title: string, url: string }

/** Unique ids within one children[] array. */
function unique(ids: string[]): (base: string) => string {
  const seen = new Set(ids)
  return (base) => {
    if (!seen.has(base)) { seen.add(base); return base }
    for (let i = 2; ; i++) {
      const candidate = `${base}${i}`
      if (!seen.has(candidate)) { seen.add(candidate); return candidate }
    }
  }
}

function toElements(nodes: TreeNode[], isRoot: boolean): Element[] {
  const out: Element[] = []
  const nextId = unique([])
  for (const node of nodes) {
    const childFolders = node.children.filter(c => c.isFolder)
    const hasLeafResources = node.children.some(c => !c.isFolder)

    if (childFolders.length > 0) {
      // A folder. Class levels (not the formation roots) also get a merged "Tout" entry.
      const childElements = toElements(node.children, false)
      const children: Element[] = []
      const merged = subtreeResources(node)
      // Skip the merged "Tout" entry when it would just duplicate a lone child group.
      if (!isRoot && merged.length > 0 && node.children.length >= 2) {
        // Keep the "Tout" id unique against its siblings' ids.
        const toutId = unique(childElements.map(c => c.id))(`tout${slug(node.name)}`)
        children.push({ id: toutId, title: `Tout ${node.name}`, url: rssUrl(merged) })
      }
      children.push(...childElements)
      // Drop branches that hold no group at all, e.g. an empty "VALEO".
      if (children.length > 0) out.push({ id: nextId(slug(node.name)), title: node.name, children })
    } else if (hasLeafResources) {
      // A terminal group, e.g. "1G1 TD1" or "Drones".
      const resources = subtreeResources(node)
      if (resources.length > 0) out.push({ id: nextId(slug(node.name)), title: node.name, url: rssUrl(resources) })
    }
  }
  return out
}

function printTree(nodes: TreeNode[], depth = 0): void {
  for (const n of nodes) {
    const res = n.isFolder ? subtreeResources(n).length : 0
    console.log(`${'  '.repeat(depth)}${n.isFolder ? '[+]' : ' -'} (${n.id}) ${n.name}${n.isFolder ? ` [${res} res]` : ''}`)
    printTree(n.children, depth + 1)
  }
}

async function main(): Promise<void> {
  await bootstrap()
  const rows = await crawl()
  const tree = buildTree(rows)
  const leaves = rows.filter(r => !r.isFolder).length
  const folders = rows.filter(r => r.isFolder && !['Stagiaires', 'Formateurs', 'Salles', 'Equipements'].includes(r.name)).length
  console.error(`crawled ${folders} groups, ${leaves} resources`)

  if (args['dry-run']) {
    printTree(tree)
    return
  }

  const doc = {
    title: 'ENSEA',
    group: 'Cergy',
    children: toElements(tree, true),
  }

  fs.writeFileSync(args.out!, `${JSON.stringify(doc, null, 2)}\n`)
  console.error(`wrote ${args.out}`)
}

main()
