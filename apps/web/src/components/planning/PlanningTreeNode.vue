<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

interface PlanningNode {
  id: string
  title: string
  fullId: string
  children?: PlanningNode[]
}

defineOptions({ name: 'PlanningTreeNode' })

const props = defineProps<{
  node: PlanningNode
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  expanded: Set<string>
  setExpanded: (id: string, open: boolean) => void
}>()

const hasChildren = computed(
  () => Array.isArray(props.node.children) && props.node.children.length > 0,
)

// Collect descendant leaf ids for any node
function getLeafIds(node: PlanningNode): string[] {
  if (!node.children?.length) return [node.fullId]
  const out: string[] = []
  const visit = (n: PlanningNode) => {
    if (n.children?.length) {
      n.children.forEach(visit)
    } else {
      out.push(n.fullId)
    }
  }
  visit(node)
  return out
}

// Tri-state calculation for parent groups
const MAX_SUBTREE_LEAVES = 200
const leafIds = computed(() => getLeafIds(props.node))
const totalLeaves = computed(() => leafIds.value.length)
const selectedLeaves = computed(() => leafIds.value.filter(id => props.isSelected(id)).length)
const isHugeSubtree = computed(() => totalLeaves.value > MAX_SUBTREE_LEAVES)
const MAX_BULK_SELECT = 10
const unselectedLeaves = computed(() => leafIds.value.filter(id => !props.isSelected(id)).length)
const showParentCheckbox = computed(() => !isHugeSubtree.value && unselectedLeaves.value <= MAX_BULK_SELECT)

const isGroupChecked = computed(() => totalLeaves.value > 0 && selectedLeaves.value === totalLeaves.value)
const isGroupIndeterminate = computed(() => selectedLeaves.value > 0 && selectedLeaves.value < totalLeaves.value)

const parentCheckbox = ref<HTMLInputElement | null>(null)
// Keep visual indeterminate state in sync with computed value
watch([isGroupIndeterminate, isGroupChecked], () => {
  if (parentCheckbox.value) {
    parentCheckbox.value.indeterminate = isGroupIndeterminate.value
  }
})

// Toggle entire subtree selection from a parent checkbox
function onParentToggleClick(e: Event) {
  e.stopPropagation() // Avoid toggling <details> when clicking the checkbox
  const ids = leafIds.value
  if (ids.length > MAX_SUBTREE_LEAVES) {
    // Soft guard: avoid toggling huge subtrees which can be very slow
    console.warn('Subtree too large to toggle at once. Please refine your search.')
    return
  }
  if (isGroupChecked.value || isGroupIndeterminate.value) {
    // Deselect all selected in subtree
    for (const id of ids) {
      if (props.isSelected(id)) props.toggle(id)
    }
  } else {
    // Select all unselected in subtree
    for (const id of ids) {
      if (!props.isSelected(id)) props.toggle(id)
    }
  }
}

// Track expanded state via parent controlled Set
function onDetailsToggle(event: Event) {
  const el = event.target as HTMLDetailsElement
  props.setExpanded(props.node.fullId, el.open)
}
</script>

<template>
  <!-- Parent/group node -->
  <li v-if="hasChildren">
    <details
      :open="expanded.has(node.fullId)"
      @toggle="onDetailsToggle"
    >
      <summary class="font-medium">
        <div class="flex items-center justify-between gap-3 py-2 px-2 rounded hover:bg-base-100">
          <span class="truncate text-left">
            {{ node.title }}
            <span class="opacity-50 text-xs ml-2">({{ selectedLeaves }}/{{ totalLeaves }})</span>
          </span>
          <input
            v-if="showParentCheckbox"
            ref="parentCheckbox"
            :checked="isGroupChecked"
            class="checkbox checkbox-sm"
            :disabled="isHugeSubtree"

            type="checkbox"
            @click="onParentToggleClick"
          >
        </div>
      </summary>
      <ul v-if="expanded.has(node.fullId)">
        <PlanningTreeNode
          v-for="child in node.children"
          :key="child.fullId"
          :expanded="expanded"
          :is-selected="isSelected"
          :node="child"
          :set-expanded="setExpanded"
          :toggle="toggle"
        />
      </ul>
    </details>
  </li>

  <!-- Leaf node -->
  <li v-else>
    <label
      class="flex items-center justify-between gap-3 py-2 px-2 rounded hover:bg-base-100"
      :class="{ 'bg-base-200': isSelected(node.fullId) }"
    >
      <span class="truncate text-left">{{ node.title }}</span>
      <input
        :checked="isSelected(node.fullId)"
        class="checkbox checkbox-sm"
        type="checkbox"
        @change="toggle(node.fullId)"
        @click.stop
      >
    </label>
  </li>
</template>
