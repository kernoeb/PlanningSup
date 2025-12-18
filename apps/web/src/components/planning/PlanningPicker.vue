<script lang="ts" setup>
import { client } from '@libs'
import { onClickOutside, refDebounced, useVirtualList } from '@vueuse/core'
import { useSharedSettings } from '@web/composables/useSettings'
import { useSharedSyncedCurrentPlanning } from '@web/composables/useSyncedCurrentPlanning'
import { CheckIcon, FolderIcon, FolderPenIcon, RotateCcwIcon as IconRotateCcw, XIcon as IconX, PinIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

// Object.groupBy is Baseline 2024
import 'groupby-polyfill/lib/polyfill.js'

defineOptions({ name: 'PlanningPicker' })

const props = defineProps<{
  standaloneTrigger?: boolean
}>()

interface PlanningNode {
  id: string
  title: string
  fullId: string
  group: string | undefined
  children?: PlanningNode[]
}

export interface PlanningRow {
  fullId: string
  title: string
  group: string | undefined
  depth: number
  isLeaf: boolean
}

// A virtual list row can be either a group header or a planning row
type VirtualRow
  = | { type: 'group', group: string }
    | { type: 'row', data: PlanningRow }

const dialogRef = ref<HTMLDialogElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const tree = ref<PlanningNode[]>([])
const didAutoScrollForOpen = ref(false)

// Multi-selection composable (synced with server)
const { planningFullIds, isSelected, togglePlanning } = useSharedSyncedCurrentPlanning()

// UX state
const searchQuery = ref('')
const debouncedSearchQuery = refDebounced(searchQuery, 100)
const expanded = ref<Set<string>>(new Set())

// Collapse state
const showCustomGroups = ref(true)
const showSelectedItems = ref(true)

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

  return ids
    .map((id) => {
      const path = findPathInTree(tree.value, id)
      if (!path) return null // Hide while tree is loading

      let shortTitle: string
      if (path.length > 3) {
        shortTitle = `${path.at(0)} > ... > ${path.at(-1)}`
      } else {
        shortTitle = path.join(' > ')
      }

      return { id, shortTitle, title: path.join(' > ') }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
})

function clearSelection() {
  planningFullIds.value = []
}

const customGroupName = ref<string | undefined>(undefined)
const groupToDelete = ref<{ id: string, name: string } | null>(null)
const customGroupDetailsRef = ref<HTMLDetailsElement | null>(null)

const { customGroups, addCustomGroup } = useSharedSettings()

const suggestedGroupName = computed<string | null>(() => {
  if (safePlanningIds.value.length !== 1) return null
  const fullId = safePlanningIds.value[0]
  if (!fullId) return null
  const path = findPathInTree(tree.value, fullId)
  if (!path?.length) return null
  // Use the leaf title (not the full "A > B > C" path) for nicer group naming.
  return path.at(-1) ?? null
})

watch(
  suggestedGroupName,
  (name) => {
    // Only auto-fill when empty, so we never overwrite what the user typed.
    if (!name) return
    if (customGroupName.value && customGroupName.value.trim().length > 0) return
    customGroupName.value = name
  },
)

function resetCustomGroupForm() {
  customGroupName.value = undefined
}

function applySuggestedGroupNameIfEmpty() {
  const name = suggestedGroupName.value
  if (!name) return
  if (customGroupName.value && customGroupName.value.trim().length > 0) return
  customGroupName.value = name
}

function closeCustomGroupDropdown() {
  if (customGroupDetailsRef.value) {
    customGroupDetailsRef.value.open = false
  }
  resetCustomGroupForm()
}

onClickOutside(customGroupDetailsRef, closeCustomGroupDropdown)

function onCustomGroupDetailsToggle(e: Event) {
  const details = e.currentTarget as HTMLDetailsElement | null
  if (details?.open) {
    applySuggestedGroupNameIfEmpty()
  } else {
    resetCustomGroupForm()
  }
}

function saveSelection() {
  // Close the form
  (document?.activeElement as HTMLElement)?.blur()

  // Save the custom group
  if (customGroupName.value) {
    addCustomGroup({
      name: customGroupName.value,
      plannings: safePlanningIds.value,
    })
    resetCustomGroupForm()
    // Close the dropdown
    if (customGroupDetailsRef.value) {
      customGroupDetailsRef.value.open = false
    }
  }
}

function applyCustomGroup(id: string) {
  planningFullIds.value = customGroups.value.find(group => group.id === id)?.plannings || []
}

function removeCustomGroup(id: string) {
  customGroups.value = customGroups.value.filter(group => group.id !== id)
}

const selectionCount = computed(() => safePlanningIds.value.length)

// Filtering and auto-expansion
interface FilterResult { nodes: PlanningNode[], expandedIds: Set<string> }

// Normalize text: remove accents, collapse spaces, lowercase
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// Cache normalized titles to avoid recomputing on each search
const normalizedTitleCache = new WeakMap<PlanningNode, string>()
function getNormalizedTitle(node: PlanningNode): string {
  let cached = normalizedTitleCache.get(node)
  if (cached === undefined) {
    cached = normalize(node.title)
    normalizedTitleCache.set(node, cached)
  }
  return cached
}

function filterTree(nodes: PlanningNode[], q: string): FilterResult {
  if (!q.trim()) return { nodes, expandedIds: new Set() }
  const query = normalize(q)
  const expandedIds = new Set<string>()

  function walk(node: PlanningNode): PlanningNode | null {
    const selfMatch = getNormalizedTitle(node).includes(query)
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

const filtered = computed<FilterResult>(() => filterTree(tree.value, debouncedSearchQuery.value))
const filteredTree = computed(() => filtered.value.nodes)

watch(
  debouncedSearchQuery,
  (query) => {
    if (query) {
      // Auto-expand branches that contain matches (merge with currently expanded)
      const merged = new Set(expanded.value)
      filtered.value.expandedIds.forEach(id => merged.add(id))
      expanded.value = merged
    } else {
      // Collapse when search is cleared to avoid unfolding everything
      expanded.value = new Set()
    }

    nextTick(() => {
      // Scroll to top of the list
      const list = document.querySelector('#planning-tree-container')
      if (list) list.scrollTop = 0
    })
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
  const dialog = dialogRef.value
  if (!dialog || !dialog.isConnected || dialog.open) return
  dialog.showModal()
  // Focus the search box after the dialog is visible to avoid replaying the opening keystroke
  requestAnimationFrame(() => searchInputRef.value?.focus())
  didAutoScrollForOpen.value = false
}

function close() {
  didAutoScrollForOpen.value = false
  dialogRef.value?.close()
}

// Expanded state setter
function setExpanded(id: string, isOpen: boolean) {
  const next = new Set(expanded.value)
  if (isOpen) next.add(id)
  else next.delete(id)
  expanded.value = next
}

function toggleRowExpand(id: string) {
  setExpanded(id, !expanded.value.has(id))
}

function onRowClick(row: PlanningRow) {
  if (row.isLeaf && isTrueLeaf(row.fullId)) {
    togglePlanning(row.fullId)
  } else {
    toggleRowExpand(row.fullId)
  }
}

defineExpose({ open, close })

/**
 * Flatten filtered+expanded tree to visible rows, grouped by group field
 */
type GroupedRows = { group: string, data: PlanningRow[] }[]

function flattenVisible(nodes: PlanningNode[], expandedSet: Set<string>, depth = 0, parentGroup?: string, out: PlanningRow[] = []): PlanningRow[] {
  for (const n of nodes) {
    const isLeaf = isTrueLeaf(n.fullId)
    // Children inherit parent's group so they stay together when expanded
    const effectiveGroup = depth === 0 ? n.group : parentGroup
    out.push({ fullId: n.fullId, title: n.title, group: effectiveGroup, depth, isLeaf })
    if (!isLeaf && expandedSet.has(n.fullId) && n.children && n.children.length > 0) {
      flattenVisible(n.children, expandedSet, depth + 1, effectiveGroup, out)
    }
  }
  return out
}

const groupedRows = computed<GroupedRows>(() => {
  const list = flattenVisible(filteredTree.value, expanded.value)
  const grouped = Object.groupBy(list, p => p.group || 'Autres')

  // Sort groups alphabetically, with "Autres" always last
  const collator = new Intl.Collator('fr', { sensitivity: 'base' })
  return Object.entries(grouped)
    .map(([group, data]) => ({
      group,
      data: data as PlanningRow[],
    }))
    .sort((a, b) => {
      if (a.group === 'Autres') return 1
      if (b.group === 'Autres') return -1
      return collator.compare(a.group, b.group)
    })
})

// Flatten grouped rows into a single list with group headers for virtual list
const virtualRows = computed<VirtualRow[]>(() => {
  const result: VirtualRow[] = []
  for (const { group, data } of groupedRows.value) {
    result.push({ type: 'group', group })
    for (const row of data) {
      result.push({ type: 'row', data: row })
    }
  }
  return result
})

// Selection helpers
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
  virtualRows,
  { itemHeight: ROW_HEIGHT },
)

function scrollToFirstSelectedGroup() {
  if (didAutoScrollForOpen.value) return
  if (selectionCount.value === 0) return
  if (debouncedSearchQuery.value.trim()) return

  const group = groupedRows.value.find(({ data }) => data.some(row => selectedCountFor(row.fullId) > 0))?.group
  if (!group) return

  const index = virtualRows.value.findIndex(row => row.type === 'group' && row.group === group)
  if (index < 0) return

  const containerEl = containerProps.ref.value
  if (!containerEl) return

  const PADDING_TOP_PX = 12
  containerEl.scrollTo({ top: Math.max(0, (index * ROW_HEIGHT) - PADDING_TOP_PX), behavior: 'smooth' })
  didAutoScrollForOpen.value = true
}

watch(
  [
    () => dialogRef.value?.open ?? false,
    () => loading.value,
    () => tree.value.length,
    () => virtualRows.value.length,
    () => selectionCount.value,
    () => debouncedSearchQuery.value,
  ],
  async ([isOpen, isLoading]) => {
    if (!isOpen) {
      didAutoScrollForOpen.value = false
      return
    }

    if (isLoading) return
    if (tree.value.length === 0) return
    if (virtualRows.value.length === 0) return

    await nextTick()
    requestAnimationFrame(() => scrollToFirstSelectedGroup())
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="sm:flex">
    <slot v-if="!props.standaloneTrigger" name="trigger" :open="open" />

    <dialog id="planning-picker-modal" ref="dialogRef" class="modal">
      <div class="modal-box max-w-[min(var(--container-xl),100svw)] flex flex-col p-0">
        <div class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-base-300 dark:border-base-200 bg-base-200 dark:bg-base-100">
          <div class="flex flex-col">
            <h3 id="planning-picker-title" class="font-bold text-xl">
              Sélectionner un planning
            </h3>
            <span class="text-xs opacity-70">
              {{ selectionCount }} sélectionné(s)
            </span>
          </div>
          <form method="dialog">
            <button
              id="planning-picker-close"
              aria-label="Fermer"
              class="btn btn-sm btn-circle btn-ghost"
              type="submit"
              @click="close"
            >
              <IconX class="size-5 text-base-content" />
            </button>
          </form>
        </div>

        <!-- Controls -->
        <div class="flex-1 px-6 pt-4 pb-2 space-y-2">
          <div class="flex items-center gap-2">
            <label class="input input-bordered w-full pe-0">
              <input
                id="planning-search-input"
                ref="searchInputRef"
                v-model="searchQuery"
                autocomplete="off"
                autocorrect="off"
                autofocus
                class="grow"
                enterkeyhint="search"
                placeholder="Rechercher un planning…"
                spellcheck="false"
                type="search"
              >
              <button v-if="searchQuery" id="planning-search-clear" class="btn btn-ghost btn-circle size-8" type="button" @click="searchQuery = ''">
                <IconX class="size-4 text-base-content" />
              </button>
            </label>
            <button
              id="planning-clear-selection"
              class="tooltip before:z-50 after:z-50 btn"
              data-tip="Effacer la sélection"
              :disabled="selectionCount === 0"
              type="button"
              @click="clearSelection()"
            >
              <IconRotateCcw class="size-4 text-base-content" />
            </button>
            <details ref="customGroupDetailsRef" class="dropdown dropdown-end" @toggle="onCustomGroupDetailsToggle">
              <summary
                id="planning-save-selection"
                class="tooltip tooltip-left before:z-50 after:z-50 btn z-5000"
                data-tip="Enregistrer la sélection"
              >
                <PinIcon class="size-4 text-base-content" />
              </summary>
              <form
                class="menu dropdown-content flex flex-row justify-end bg-base-200 mt-1 rounded-box z-1 w-72 py-2 px-4 shadow-xl"
                @submit.prevent="saveSelection()"
              >
                <fieldset class="fieldset">
                  <legend class="fieldset-legend text-sm">
                    Nom du groupe de favoris
                  </legend>
                  <label class="input">
                    <FolderPenIcon class="h-[1em] opacity-50" />
                    <input v-model="customGroupName" class="grow" placeholder="Fac de bio" type="text">
                  </label>
                  <p class="legend">
                    Créez un groupe pour retrouver plus facilement vos plannings.
                  </p>
                </fieldset>
                <button
                  class="btn btn-soft bg-secondary"
                  type="submit"
                >
                  <CheckIcon class="size-4 text-base-content me-2" />
                  Enregistrer
                </button>
              </form>
            </details>
          </div>

          <div v-if="customGroups.length > 0" class="collapse collapse-arrow">
            <input v-model="showCustomGroups" type="checkbox">
            <div class="collapse-title flex flex-col md:flex-row md:items-baseline-last justify-start md:gap-4 p-0 min-h-0 py-2">
              <h4 class="text-sm font-medium text-base-content/70">
                Groupes enregistrés
              </h4>
              <span class="text-xs text-base-content/50">
                Cliquer pour appliquer un groupe
              </span>
            </div>
            <div class="collapse-content px-0">
              <div class="flex flex-wrap gap-2 pt-2">
                <div
                  v-for="item in customGroups"
                  :id="`custom-group-${item.id}`"
                  :key="item.id"
                  class="group flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 hover:border-secondary/40 cursor-pointer transition-all"
                  @click="applyCustomGroup(item.id)"
                >
                  <FolderIcon class="size-4 text-secondary shrink-0" />
                  <span class="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap max-w-40">
                    {{ item.name }}
                  </span>
                  <span class="text-xs text-base-content/50">
                    ({{ item.plannings.length }})
                  </span>
                  <button
                    :id="`remove-custom-group-${item.name}`"
                    :aria-label="`Supprimer le groupe ${item.name}`"
                    class="btn btn-xs btn-circle btn-ghost grid place-items-center opacity-50 group-hover:opacity-100 shrink-0 ml-1"
                    type="button"
                    @click.stop="groupToDelete = { id: item.id, name: item.name }"
                  >
                    <IconX class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedItems.length > 0" class="collapse collapse-arrow">
            <input v-model="showSelectedItems" type="checkbox">
            <div class="collapse-title flex flex-col md:flex-row md:items-baseline-last justify-start md:gap-4 p-0 min-h-0 py-2">
              <h4 class="text-sm font-medium text-base-content/70">
                Plannings sélectionnés
              </h4>
              <span class="text-xs text-base-content/50">
                Cliquer un planning pour le retirer
              </span>
            </div>
            <div id="selected-plannings-list" class="collapse-content px-0">
              <div class="flex flex-wrap gap-2 pt-2 overflow-x-auto">
                <div
                  v-for="item in selectedItems"
                  :id="`selected-planning-${item.id}`"
                  :key="item.id"
                  class="tooltip tooltip-top w-fit before:z-50 after:z-50"
                  :data-tip="item.title"
                >
                  <div
                    class="badge badge-md gap-1 bg-base-200"
                    title="Cliquer pour retirer"
                  >
                    <div class="overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left flex-1 min-w-0 max-w-full">
                      {{ item.shortTitle }}
                    </div>
                    <button
                      :id="`remove-planning-${item.id}`"
                      :aria-label="`Retirer ${item.title}`"
                      class="btn btn-xs btn-circle btn-ghost shrink-0"
                      @click="togglePlanning(item.id)"
                    >
                      <IconX class="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="divider my-0 h-0.5" />

        <!-- Body -->
        <div id="planning-tree-container" class="h-[60vh] bg-base-100 dark:bg-base-200 pt-2 px-4 pb-4" v-bind="containerProps">
          <div v-if="loading" class="flex items-center justify-center h-full">
            <span class="loading loading-spinner loading-lg" />
          </div>
          <div v-else-if="error" class="flex items-center justify-center h-full text-error">
            {{ error }}
          </div>
          <div v-else-if="virtualRows.length === 0" class="flex items-center justify-center h-full opacity-50">
            Aucun planning trouvé
          </div>
          <div v-else v-bind="wrapperProps">
            <template v-for="{ data: item } in vlist" :key="item.type === 'group' ? `group-${item.group}` : item.data.fullId">
              <!-- Group header -->
              <div
                v-if="item.type === 'group'"
                class="mt-1 px-2 flex items-center font-bold"
                :style="{ height: `${ROW_HEIGHT}px` }"
              >
                {{ item.group }}
              </div>

              <!-- Planning row -->
              <div
                v-else
                :id="`planning-row-${item.data.fullId}`"
                class="flex items-center justify-between px-2 hover:bg-secondary/30 transition-all cursor-pointer"
                :class="{
                  'bg-secondary/40': !item.data.isLeaf && selectedCountFor(item.data.fullId) > 0,
                  'bg-secondary/80 font-bold': item.data.isLeaf && isSelected(item.data.fullId),
                }"
                :style="{
                  height: `${ROW_HEIGHT}px`,
                  paddingLeft: `${(item.data.depth * 16) + 8}px`,
                }"
                @click="onRowClick(item.data)"
              >
                <template v-if="!item.data.isLeaf">
                  <div class="flex items-center gap-2 min-w-0 w-full">
                    <span class="inline-flex items-center justify-center w-3 select-none">
                      {{ expanded.has(item.data.fullId) ? '▾' : '▸' }}
                    </span>
                    <span class="truncate text-left">
                      {{ item.data.title }}
                      <span class="opacity-50 text-xs ml-2">
                        ({{ selectedCountFor(item.data.fullId) }}/{{ totalLeavesFor(item.data.fullId) }})
                      </span>
                    </span>
                    <input
                      :id="`planning-group-checkbox-${item.data.fullId}`"
                      :checked="totalLeavesFor(item.data.fullId) > 0 && selectedCountFor(item.data.fullId) === totalLeavesFor(item.data.fullId)"
                      class="checkbox checkbox-sm checkbox-primary ml-auto"
                      :disabled="
                        totalLeavesFor(item.data.fullId) > 200
                          || (totalLeavesFor(item.data.fullId) - selectedCountFor(item.data.fullId)) > 10
                      "
                      :indeterminate="selectedCountFor(item.data.fullId) > 0 && selectedCountFor(item.data.fullId) < totalLeavesFor(item.data.fullId)"
                      title="Tout sélectionner/désélectionner dans ce groupe"
                      type="checkbox"
                      @click.stop="onGroupToggle(item.data.fullId)"
                    >
                  </div>
                </template>

                <template v-else>
                  <div class="flex items-center gap-2 min-w-0 w-full">
                    <span class="inline-flex items-center justify-center w-3 select-none" />
                    <span class="truncate text-left">{{ item.data.title }}</span>
                    <input
                      :id="`planning-leaf-checkbox-${item.data.fullId}`"
                      :checked="isSelected(item.data.fullId)"
                      class="checkbox checkbox-sm checkbox-primary ml-auto"
                      type="checkbox"
                      @change="togglePlanning(item.data.fullId)"
                      @click.stop
                    >
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>

      <form class="modal-backdrop" method="dialog">
        <button>close</button>
      </form>

      <!-- Delete group confirmation modal -->
      <dialog
        class="modal"
        :class="{ 'modal-open': groupToDelete !== null }"
        :open="groupToDelete !== null"
        @click.self="groupToDelete = null"
      >
        <div v-if="groupToDelete" class="modal-box">
          <h3 class="font-bold text-lg">
            Supprimer le groupe « {{ groupToDelete.name }} » ?
          </h3>
          <p class="py-4 text-sm text-base-content/70">
            Cette action est irréversible.
          </p>
          <div class="modal-action">
            <button
              class="btn btn-ghost"
              type="button"
              @click="groupToDelete = null"
            >
              Annuler
            </button>
            <button
              class="btn btn-error"
              type="button"
              @click="removeCustomGroup(groupToDelete.id); groupToDelete = null"
            >
              <Trash2Icon class="size-4 me-2" />
              Supprimer
            </button>
          </div>
        </div>
        <form class="modal-backdrop" method="dialog" @click="groupToDelete = null">
          <button>close</button>
        </form>
      </dialog>
    </dialog>
  </div>
</template>
