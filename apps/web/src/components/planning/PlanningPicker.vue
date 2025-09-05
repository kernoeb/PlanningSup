<script lang="ts" setup>
import { client } from '@libs'
import PlanningTreeNode from '@web/components/planning/PlanningTreeNode.vue'
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

function findTitleInTree(nodes: PlanningNode[] | undefined, targetFullId: string): string | null {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.fullId === targetFullId) return n.title
    const child = findTitleInTree(n.children, targetFullId)
    if (child) return child
  }
  return null
}

// Selected display
const safePlanningIds = computed<string[]>(() => Array.isArray(planningFullIds.value) ? planningFullIds.value : [])

const selectedItems = computed(() => {
  const ids = safePlanningIds.value
  return ids.map(id => ({ id, title: findTitleInTree(tree.value, id) ?? id }))
})

const selectedTitlesLabel = computed(() => {
  const items = selectedItems.value
  if (items.length === 0) return 'Aucun planning sélectionné'
  if (items.length === 1) return items[0]?.title ?? ''
  return `${items.length} plannings: ${items.map(x => x.title).join(', ')}`
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

// Visible leaf ids (used for select/deselect visible)
function collectVisibleLeafIds(nodes: PlanningNode[], expandedSet: Set<string>): string[] {
  const out: string[] = []
  const visit = (n: PlanningNode) => {
    if (n.children?.length) {
      if (expandedSet.has(n.fullId)) {
        n.children.forEach(visit)
      }
    } else {
      out.push(n.fullId)
    }
  }
  nodes.forEach(visit)
  return out
}
const visibleLeafIds = computed(() => collectVisibleLeafIds(filteredTree.value, expanded.value))
const MAX_VISIBLE_LEAVES = 200
const tooManyVisible = computed(() => visibleLeafIds.value.length > MAX_VISIBLE_LEAVES)

// Controls
function clearSelection() {
  const ids = [...safePlanningIds.value]
  for (const id of ids) {
    if (isSelected(id)) togglePlanning(id)
  }
}

function deselectVisible() {
  if (tooManyVisible.value) {
    // Prevent expensive operation when too many items are visible
    return
  }
  const ids = visibleLeafIds.value
  for (const id of ids) {
    if (isSelected(id)) togglePlanning(id)
  }
}

// Open/Close + data load
async function loadTree() {
  if (tree.value.length > 0) return
  loading.value = true
  error.value = null
  try {
    const { data } = await client.api.plannings.get()
    if (!Array.isArray(data)) {
      throw new TypeError('Unexpected API response while loading plannings')
    }
    tree.value = data as PlanningNode[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function open() {
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

defineExpose({ open, close })

onMounted(() => {
  if (props.openOnMount || selectionCount.value === 0) open()
})
</script>

<template>
  <div class="sm:flex">
    <slot v-if="!props.standaloneTrigger" name="trigger" :open="open" />

    <dialog ref="dialogRef" class="modal">
      <div class="modal-box max-w-5xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>

        <!-- Header -->
        <div class="mb-4 space-y-2 sticky top-0 bg-base-100 z-10 pt-1">
          <h3 class="text-lg font-bold">
            Sélectionner des plannings
          </h3>

          <!-- Controls -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <input
                v-model="searchQuery"
                autofocus
                class="input input-sm input-bordered w-full"
                placeholder="Rechercher un planning…"
                type="text"
              >
              <button class="btn btn-sm" :disabled="!searchQuery" type="button" @click="searchQuery = ''">
                Effacer
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                class="btn btn-sm btn-outline"
                :disabled="tooManyVisible"
                :title="tooManyVisible ? 'Affinez votre recherche pour limiter le nombre d’éléments visibles' : undefined"
                type="button"
                @click="deselectVisible"
              >
                Désélectionner visibles
              </button>
              <div class="divider divider-horizontal" />
              <button class="btn btn-sm btn-error" type="button" @click="clearSelection">
                Tout désélectionner
              </button>
            </div>

            <!-- Current selection as chips -->
            <div class="text-sm opacity-70">
              Sélection actuelle :
              <span class="font-mono">{{ selectedTitlesLabel }}</span>
            </div>
            <div v-if="selectedItems.length" class="flex flex-wrap gap-2">
              <div
                v-for="item in selectedItems"
                :key="item.id"
                class="badge badge-lg gap-1"
                title="Cliquer pour retirer"
              >
                <span class="truncate max-w-[240px]">{{ item.title }}</span>
                <button
                  :aria-label="`Retirer ${item.title}`"
                  class="btn btn-xs btn-circle btn-ghost"
                  @click="togglePlanning(item.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div v-if="loading" class="flex items-center gap-3">
          <span class="loading loading-spinner loading-md" />
          <span>Chargement des plannings…</span>
        </div>

        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
          <button class="btn btn-sm ml-auto" type="button" @click="loadTree">
            Réessayer
          </button>
        </div>

        <div v-else class="h-[60vh] overflow-auto">
          <div v-if="tooManyVisible" class="alert alert-warning">
            Trop de résultats visibles. Affinez votre recherche pour améliorer les performances.
          </div>
          <ul class="menu bg-base-200 rounded-box w-full">
            <PlanningTreeNode
              v-for="root in filteredTree"
              :key="root.fullId"
              :expanded="expanded"
              :is-selected="isSelected"
              :node="root"
              :set-expanded="setExpanded"
              :toggle="togglePlanning"
            />
          </ul>
        </div>

        <!-- Footer -->
        <div class="mt-4 sticky bottom-0 bg-base-100 pt-2">
          <div class="flex items-center justify-end gap-2">
            <span class="text-sm opacity-70">
              {{ selectionCount }} sélectionné(s)
            </span>
            <form method="dialog">
              <button class="btn">
                Fermer
              </button>
            </form>
          </div>
        </div>
      </div>

      <form class="modal-backdrop" method="dialog">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
