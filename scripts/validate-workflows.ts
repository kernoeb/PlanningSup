import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type WorkflowGraph = Map<string, string[]>

function stripYamlComment(line: string) {
  const idx = line.indexOf('#')
  return idx === -1 ? line : line.slice(0, idx)
}

function parseNeedsInline(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed)
    return []

  // needs: job-a
  if (!trimmed.startsWith('['))
    return [trimmed.replaceAll('"', '').replaceAll("'", '').trim()].filter(Boolean)

  // needs: [a, b, c]
  if (!trimmed.endsWith(']'))
    return []

  const inner = trimmed.slice(1, -1).trim()
  if (!inner)
    return []

  return inner
    .split(',')
    .map(s => s.trim().replaceAll('"', '').replaceAll("'", ''))
    .filter(Boolean)
}

function parseWorkflowGraph(yamlText: string) {
  const lines = yamlText.split('\n')
  const jobs = new Set<string>()
  const graph: WorkflowGraph = new Map()

  let inJobs = false
  let currentJob: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = stripYamlComment(rawLine)
    if (!inJobs) {
      if (/^jobs:\s*$/.test(line)) {
        inJobs = true
      }
      continue
    }

    // End of jobs block: next top-level key.
    if (/^[^\s].+?:\s*$/.test(line) && !/^jobs:\s*$/.test(line)) {
      break
    }

    const jobMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/)
    if (jobMatch) {
      currentJob = jobMatch[1]
      jobs.add(currentJob)
      if (!graph.has(currentJob))
        graph.set(currentJob, [])
      continue
    }

    // Only consider job-level `needs` (4-space indent).
    const needsMatch = line.match(/^    needs:\s*(.*)$/)
    if (needsMatch && currentJob) {
      const value = needsMatch[1] ?? ''
      const inline = parseNeedsInline(value)
      if (inline.length > 0) {
        graph.set(currentJob, inline)
        continue
      }

      // needs:
      //   - a
      //   - b
      const deps: string[] = []
      for (let j = i + 1; j < lines.length; j++) {
        const nextRaw = lines[j]
        const next = stripYamlComment(nextRaw)
        if (!next.startsWith('      - '))
          break
        deps.push(next.slice('      - '.length).trim().replaceAll('"', '').replaceAll("'", ''))
        i = j
      }
      graph.set(currentJob, deps.filter(Boolean))
    }
  }

  return { jobs, graph }
}

function findCycles(graph: WorkflowGraph) {
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>()
  const stack: string[] = []
  const cycles: string[][] = []

  const visit = (node: string) => {
    state.set(node, 'visiting')
    stack.push(node)
    const deps = graph.get(node) ?? []
    for (const dep of deps) {
      const depState = state.get(dep) ?? 'unvisited'
      if (depState === 'unvisited') {
        visit(dep)
      } else if (depState === 'visiting') {
        const idx = stack.indexOf(dep)
        if (idx >= 0)
          cycles.push([...stack.slice(idx), dep])
      }
    }
    stack.pop()
    state.set(node, 'visited')
  }

  for (const node of graph.keys()) {
    if ((state.get(node) ?? 'unvisited') === 'unvisited')
      visit(node)
  }

  return cycles
}

function validateWorkflow(filePath: string) {
  const yamlText = readFileSync(filePath, 'utf8')
  const { jobs, graph } = parseWorkflowGraph(yamlText)

  const errors: string[] = []

  for (const [job, deps] of graph.entries()) {
    for (const dep of deps) {
      if (!jobs.has(dep))
        errors.push(`- ${job} needs unknown job ${dep}`)
    }
  }

  // Only check cycles among known jobs.
  const knownOnly: WorkflowGraph = new Map()
  for (const [job, deps] of graph.entries())
    knownOnly.set(job, deps.filter(d => jobs.has(d)))

  const cycles = findCycles(knownOnly)
  for (const cycle of cycles) {
    const chain = cycle.join(' -> ')
    errors.push(`- dependency cycle: ${chain}`)
  }

  return errors
}

const workflowsDir = join(process.cwd(), '.github', 'workflows')
const workflowFiles = readdirSync(workflowsDir)
  .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map(f => join(workflowsDir, f))

const allErrors: string[] = []
for (const filePath of workflowFiles) {
  const errs = validateWorkflow(filePath)
  if (errs.length > 0) {
    allErrors.push(`${filePath}:`)
    allErrors.push(...errs)
  }
}

if (allErrors.length > 0) {
  console.error(allErrors.join('\n'))
  process.exit(1)
}

console.log(`OK: validated ${workflowFiles.length} workflow(s)`)
