<script lang="ts" setup>
import { client } from '@libs'
import { useVirtualList } from '@vueuse/core'
import { useCurrentPlanning } from '@web/composables/useCurrentPlanning'
import { computed, onMounted, ref, watch } from 'vue'

interface PlanningNode {
  id: string
  title: string
  fullId: string
  children?: PlanningNode[]
}

defineOptions({ name: 'PlanningPicker' })

const props = defineProps<{
  openOnMount?: boolean
  standaloneTrigger?: boolean
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const tree = ref<PlanningNode[]>([])

// Multi-selection composable
const { planningFullIds, isSelected, togglePlanning } = useCurrentPlanning()

// UX state
const searchQuery = ref('')
const expanded = ref<Set<string>>(new Set())

function findPathInTree(
  nodes: PlanningNode[] | undefined,
  targetFullId: string,
  trail: string[] = [],
): string[] | null {
  if (!nodes) return null
  for (const n of nodes) {
    const nextTrail = [...trail, n.title]
    if (n.fullId === targetFullId) return nextTrail
    const child = findPathInTree(n.children, targetFullId, nextTrail)
    if (child) return child
  }
  return null
}

// Selected display
const safePlanningIds = computed<string[]>(() => Array.isArray(planningFullIds.value) ? planningFullIds.value : [])

const selectedItems = computed(() => {
  const ids = safePlanningIds.value
  return ids.map((id) => {
    const path = findPathInTree(tree.value, id)
    return { id, title: path ? path.join(' > ') : id }
  })
})

const selectionCount = computed(() => safePlanningIds.value.length)

// Filtering and auto-expansion
interface FilterResult { nodes: PlanningNode[], expandedIds: Set<string> }

function filterTree(nodes: PlanningNode[], q: string): FilterResult {
  if (!q.trim()) return { nodes, expandedIds: new Set() }
  const query = q.toLowerCase()
  const expandedIds = new Set<string>()

  function walk(node: PlanningNode): PlanningNode | null {
    const selfMatch = node.title.toLowerCase().includes(query)
    const filteredChildren = (node.children ?? [])
      .map(walk)
      .filter(Boolean) as PlanningNode[]

    const hasChildMatch = filteredChildren.length > 0
    if (hasChildMatch) expandedIds.add(node.fullId)

    if (selfMatch || hasChildMatch) {
      return { ...node, children: filteredChildren.length ? filteredChildren : undefined }
    }
    return null
  }

  const filteredNodes = nodes.map(walk).filter(Boolean) as PlanningNode[]
  return { nodes: filteredNodes, expandedIds }
}

const filtered = computed<FilterResult>(() => filterTree(tree.value, searchQuery.value))
const filteredTree = computed(() => filtered.value.nodes)

watch(
  () => searchQuery.value,
  () => {
    if (searchQuery.value) {
      // Auto-expand branches that contain matches (merge with currently expanded)
      const merged = new Set(expanded.value)
      filtered.value.expandedIds.forEach(id => merged.add(id))
      expanded.value = merged
    } else {
      // Collapse when search is cleared to avoid unfolding everything
      expanded.value = new Set()
    }
  },
)

// fullId -> leafIds[] index for fast counts and bulk selection
const leafIndex = ref<Record<string, string[]>>({})
function buildLeafIndex(nodes: PlanningNode[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const visit = (n: PlanningNode): string[] => {
    if (!n.children?.length) return [n.fullId]
    const acc: string[] = []
    for (const c of n.children) acc.push(...visit(c))
    map[n.fullId] = acc
    return acc
  }
  for (const r of nodes) visit(r)
  return map
}

const branchIds = computed(() => new Set(Object.keys(leafIndex.value)))
function isTrueLeaf(fullId: string): boolean {
  return !branchIds.value.has(fullId)
}

// Controls
function clearSelection() {
  const ids = [...safePlanningIds.value]
  const branch = new Set(Object.keys(leafIndex.value))
  for (const id of ids) {
    if (branch.has(id)) continue
    if (isSelected(id)) togglePlanning(id)
  }
}

// Open/Close + data load
function sortTree(nodes: PlanningNode[]): PlanningNode[] {
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
  const clone = nodes.map(n => ({
    ...n,
    children: n.children ? sortTree(n.children) : undefined,
  }))
  clone.sort((a, b) => collator.compare(a.title, b.title))
  return clone
}
async function loadTree() {
  if (tree.value.length > 0) return
  loading.value = true
  error.value = null
  try {
    const { data } = await client.api.plannings.get()
    if (!Array.isArray(data)) {
      throw new TypeError('Unexpected API response while loading plannings')
    }
    const nodes = sortTree(data as PlanningNode[])
    leafIndex.value = buildLeafIndex(nodes)
    tree.value = nodes
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function open() {
  void loadTree()
  dialogRef.value?.showModal()
}

function close() {
  dialogRef.value?.close()
}

// Expanded state setter for <details> (used by children)
function setExpanded(id: string, open: boolean) {
  const next = new Set(expanded.value)
  if (open) next.add(id)
  else next.delete(id)
  expanded.value = next
}

function toggleRowExpand(id: string) {
  setExpanded(id, !expanded.value.has(id))
}

function onRowClick(row: { fullId: string, isLeaf: boolean }) {
  if (row.isLeaf && isTrueLeaf(row.fullId)) {
    togglePlanning(row.fullId)
  } else {
    toggleRowExpand(row.fullId)
  }
}
defineExpose({ open, close })

/**
 * Virtualized tree rows
 * - Flatten filtered+expanded tree to visible rows
 * - Build a leaf index for group counts and bulk toggle
 */
interface Row {
  fullId: string
  title: string
  depth: number
  isLeaf: boolean
  node: PlanningNode
}

function flattenVisible(nodes: PlanningNode[], expandedSet: Set<string>, depth = 0, out: Row[] = []): Row[] {
  for (const n of nodes) {
    const isLeaf = isTrueLeaf(n.fullId)
    out.push({ fullId: n.fullId, title: n.title, depth, isLeaf, node: n })
    if (!isLeaf && expandedSet.has(n.fullId) && n.children && n.children.length > 0) {
      flattenVisible(n.children!, expandedSet, depth + 1, out)
    }
  }
  return out
}
const visibleRows = computed<Row[]>(() => flattenVisible(filteredTree.value, expanded.value))

// moved: leafIndex/buildLeafIndex defined above

const selectedSet = computed(() => new Set(safePlanningIds.value))
function totalLeavesFor(fullId: string): number {
  const ids = leafIndex.value[fullId]
  return ids ? ids.length : 1
}
function selectedCountFor(fullId: string): number {
  const ids = leafIndex.value[fullId]
  if (!ids) return selectedSet.value.has(fullId) ? 1 : 0
  let count = 0
  for (const id of ids) {
    if (selectedSet.value.has(id)) count++
  }
  return count
}

const MAX_SUBTREE_LEAVES = 200
const MAX_BULK_SELECT = 10

function onGroupToggle(fullId: string) {
  const ids = leafIndex.value[fullId]
  const leaves = ids ?? [fullId]
  if (leaves.length > MAX_SUBTREE_LEAVES) return
  const selected = leaves.filter(id => isSelected(id))
  const allSelected = selected.length === leaves.length && leaves.length > 0

  if (allSelected || selected.length > 0) {
    for (const id of leaves) {
      if (isSelected(id)) togglePlanning(id)
    }
  } else {
    const unselected = leaves.filter(id => !isSelected(id))
    if (unselected.length > MAX_BULK_SELECT) return
    for (const id of unselected) togglePlanning(id)
  }
}

const ROW_HEIGHT = 36
const { list: vlist, containerProps, wrapperProps } = useVirtualList(
  visibleRows,
  { itemHeight: ROW_HEIGHT },
)

onMounted(() => {
  if (props.openOnMount || selectionCount.value === 0) open()
})
</script>

<template>
  <div class="sm:flex">
    <slot v-if="!props.standaloneTrigger" name="trigger" :open="open" />

    <dialog ref="dialogRef" class="modal">
      <div class="modal-box max-w-xl flex flex-col p-0">
        <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-300 bg-base-100">
          <div class="flex flex-col">
            <h3 id="settings-title" class="font-bold text-xl">
              Sélectionner un planning
            </h3>
            <span class="text-xs opacity-70">
              {{ selectionCount }} sélectionné(s)
            </span>
          </div>
          <form method="dialog">
            <button
              aria-label="Fermer"
              class="btn btn-circle btn-ghost"
              @click="close"
            >
              ✕
            </button>
          </form>
        </div>

        <!-- Controls -->
        <div class="flex-1 px-6 py-4 space-y-2">
          <div class="flex items-center gap-2">
            <input
              v-model="searchQuery"
              autofocus
              class="input input-bordered w-full"
              placeholder="Rechercher un planning…"
              type="text"
            >
            <button class="btn" :disabled="!searchQuery" type="button" @click="searchQuery = ''">
              Effacer
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex flex-wrap gap-2 flex-1 min-w-0">
              <div
                v-for="item in selectedItems"
                :key="item.id"
                class="tooltip max-w-full min-w-0"
                :data-tip="item.title"
              >
                <div
                  class="badge badge-md gap-1 bg-base-200 max-w-full min-w-0"
                  title="Cliquer pour retirer"
                >
                  <div class="overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] [text-align:left] flex-1 min-w-0 max-w-full">
                    {{ item.title }}
                  </div>
                  <button
                    :aria-label="`Retirer ${item.title}`"
                    class="btn btn-xs btn-circle btn-ghost shrink-0"
                    @click="togglePlanning(item.id)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            <!--
            <button
              class="btn btn-sm ml-auto shrink-0"
              :disabled="selectionCount === 0"
              type="button"
              @click="clearSelection"
            >
              Tout désélectionner
            </button>
            -->
          </div>
        </div>

        <!-- Body -->
        <div class="h-[60vh] bg-base-200" v-bind="containerProps">
          <div v-bind="wrapperProps">
            <div
              v-for="row in vlist"
              :key="row.data.fullId"
              class="flex items-center justify-between px-2 hover:bg-primary/20 transition-all cursor-pointer"
              :class="{
                'bg-primary/10': (!row.data.isLeaf && selectedCountFor(row.data.fullId) > 0),
                'bg-primary/20 font-bold': (row.data.isLeaf && isSelected(row.data.fullId)),
              }"
              :style="{
                height: `${ROW_HEIGHT}px`,
                paddingLeft: `${(row.data.depth * 16) + 8}px`,
              }"
              @click="onRowClick(row.data)"
            >
              <template v-if="!row.data.isLeaf">
                <div class="flex items-center gap-2 min-w-0 w-full">
                  <span class="inline-flex items-center justify-center w-3 select-none">
                    {{ expanded.has(row.data.fullId) ? '▾' : '▸' }}
                  </span>
                  <span class="truncate text-left">
                    {{ row.data.title }}
                    <span class="opacity-50 text-xs ml-2">
                      ({{ selectedCountFor(row.data.fullId) }}/{{ totalLeavesFor(row.data.fullId) }})
                    </span>
                  </span>
                  <input
                    :checked="totalLeavesFor(row.data.fullId) > 0 && selectedCountFor(row.data.fullId) === totalLeavesFor(row.data.fullId)"
                    class="checkbox checkbox-sm checkbox-primary ml-auto"
                    :disabled="
                      totalLeavesFor(row.data.fullId) > 200
                        || (totalLeavesFor(row.data.fullId) - selectedCountFor(row.data.fullId)) > 10
                    "
                    :indeterminate="selectedCountFor(row.data.fullId) > 0 && selectedCountFor(row.data.fullId) < totalLeavesFor(row.data.fullId)"
                    title="Tout sélectionner/désélectionner dans ce groupe"
                    type="checkbox"
                    @click.stop="onGroupToggle(row.data.fullId)"
                  >
                </div>
              </template>

              <template v-else>
                <div class="flex items-center gap-2 min-w-0 w-full">
                  <span class="inline-flex items-center justify-center w-3 select-none" />
                  <span class="truncate text-left">{{ row.data.title }}</span>
                  <input
                    :checked="isSelected(row.data.fullId)"
                    class="checkbox checkbox-sm checkbox-primary ml-auto"
                    type="checkbox"
                    @change="togglePlanning(row.data.fullId)"
                    @click.stop
                  >
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <form class="modal-backdrop" method="dialog">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
