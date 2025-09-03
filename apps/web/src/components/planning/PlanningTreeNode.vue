<script lang="ts" setup>
import { computed } from 'vue'

interface PlanningNode {
  id: string
  title: string
  fullId: string
  children?: PlanningNode[]
}

defineOptions({ name: 'PlanningTreeNode' })

const props = defineProps<{
  node: PlanningNode
  isCurrent: (id: string) => boolean
}>()

const emit = defineEmits<{
  (e: 'select', node: PlanningNode): void
}>()

const hasChildren = computed(
  () => Array.isArray(props.node.children) && props.node.children.length > 0,
)

function selectLeaf() {
  emit('select', props.node)
}
</script>

<template>
  <li v-if="hasChildren">
    <details>
      <summary class="font-medium">
        {{ node.title }}
      </summary>
      <ul>
        <PlanningTreeNode
          v-for="child in node.children"
          :key="child.fullId"
          :is-current="isCurrent"
          :node="child"
          @select="$emit('select', $event)"
        />
      </ul>
    </details>
  </li>
  <li v-else>
    <button
      class="justify-between"
      :class="{ active: isCurrent(node.fullId) }"
      type="button"
      @click="selectLeaf"
    >
      <span class="truncate text-left">{{ node.title }}</span>
      <span v-if="isCurrent(node.fullId)" class="badge badge-primary badge-xs">current</span>
    </button>
  </li>
</template>
