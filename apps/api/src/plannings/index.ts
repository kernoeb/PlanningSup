import { Glob } from 'bun'
import fs from 'fs'
import path from 'path'
import { planningsLocation } from '@plannings'
import { z } from 'zod'

if (!fs.existsSync(planningsLocation)) {
  throw new Error(`Plannings directory does not exist: ${planningsLocation}`)
}

type PlanningElement
  = | {
    readonly id: string
    readonly title: string
    readonly children: readonly PlanningElement[]
  }
  | {
    readonly id: string
    readonly title: string
    readonly url: string
  }

const ElementSchema: z.ZodType<PlanningElement> = z.lazy(() =>
  z.union([
    z.object({ id: z.string().min(1), title: z.string().min(1), children: z.array(ElementSchema).min(1) }),
    z.object({ id: z.string().min(1), title: z.string().min(1), url: z.url() }),
  ]),
)

const PlanningSchema = z.object({
  title: z.string().min(1),
  group: z.string().optional(),
  children: z.array(ElementSchema).min(1),
})

interface FlatPlanning {
  readonly id: string
  readonly title: string
  readonly url: string
  readonly fullId: string
  readonly planningId: string
}

// Enriched element with fullId on every node
type EnrichedPlanningElement
  = | {
    readonly id: string
    readonly title: string
    readonly fullId: string
    readonly children: readonly EnrichedPlanningElement[]
  }
  | {
    readonly id: string
    readonly title: string
    readonly fullId: string
    readonly url: string
  }

export interface ReadonlyPlanning {
  readonly id: string
  readonly fullId: string
  readonly title: string
  readonly group: string | undefined
  readonly children: readonly EnrichedPlanningElement[]
  readonly flatten: readonly FlatPlanning[]
}

const glob = new Glob('*.json')

const plannings: ReadonlyPlanning[] = []

for await (const file of glob.scan({
  cwd: planningsLocation,
  onlyFiles: true,
  absolute: true,
})) {
  const parsed = PlanningSchema.parse(await Bun.file(file).json())
  const id = path.basename(file, '.json')
  const fullId = id

  const flatten: FlatPlanning[] = []

  // Single-pass enrichment and flattening
  function enrich(elements: readonly PlanningElement[], parentFullId: string): EnrichedPlanningElement[] {
    const enriched: EnrichedPlanningElement[] = []
    for (const element of elements) {
      const currentFullId = `${parentFullId}.${element.id}`
      if ('children' in element) {
        const children = enrich(element.children, currentFullId)
        enriched.push({
          id: element.id,
          title: element.title,
          fullId: currentFullId,
          children,
        })
      } else {
        const leaf = {
          id: element.id,
          title: element.title,
          fullId: currentFullId,
          url: element.url,
        } as const
        enriched.push(leaf)
        flatten.push({ ...leaf, planningId: id })
      }
    }
    return enriched
  }

  const enrichedChildren = enrich(parsed.children, fullId)

  plannings.push({
    id,
    fullId,
    group: parsed.group,
    title: parsed.title,
    children: enrichedChildren,
    flatten,
  })
}

const readonlyPlannings: readonly ReadonlyPlanning[] = Object.freeze(plannings.map(p =>
  Object.freeze({
    ...p,
    // Freeze arrays to uphold runtime immutability guarantees expected by "readonly"
    children: p.children,
    flatten: Object.freeze(p.flatten),
  }),
))

// Helper type to recursively remove 'url' property from objects
type RemoveUrl<T> = T extends { readonly url: string }
  ? Omit<T, 'url'>
  : T extends { readonly children: readonly (infer U)[] }
    ? Omit<T, 'children'> & { readonly children: readonly RemoveUrl<U>[] }
    : T

// Type for a single planning without URLs
type PlanningWithoutUrl = RemoveUrl<typeof plannings[number]>

// Recursively remove "url" key from planning elements
function removeUrlFromElement<T>(element: T): RemoveUrl<T> {
  if (element && typeof element === 'object') {
    if ('children' in element && Array.isArray(element.children)) {
      // Handle container elements with children
      const { ...rest } = element
      return {
        ...rest,
        children: element.children.map(removeUrlFromElement),
      } as RemoveUrl<T>
    } else if ('url' in element) {
      // Handle leaf elements with URL - remove the URL property
      const { url, ...elementWithoutUrl } = element
      return elementWithoutUrl as RemoveUrl<T>
    }
  }

  // Return as-is for elements that don't have url or children
  return element as RemoveUrl<T>
}

function removeUrlFromPlanning(planning: typeof plannings[number]): Omit<PlanningWithoutUrl, 'flatten'> {
  const { flatten, ...rest } = planning
  return {
    ...rest,
    children: planning.children.map(removeUrlFromElement),
  }
}

// Recursively remove "url" key and "flatten" from all planning elements
const cleanedPlannings: readonly Omit<PlanningWithoutUrl, 'flatten'>[] = plannings.map(removeUrlFromPlanning)

const flattenedPlannings = plannings.flatMap(p => p.flatten)

export {
  cleanedPlannings,
  flattenedPlannings,
  readonlyPlannings as plannings,
}
