<script lang="ts" setup>
import { client } from '@libs'
import PlanningTreeNode from '@web/components/planning/PlanningTreeNode.vue'
import { useCurrentPlanning } from '@web/composables/useCurrentPlanning'
import { computed, onMounted, ref } from 'vue'

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

const { fullId: currentFullId, setCurrentPlanning, isCurrent } = useCurrentPlanning()

function findTitleInTree(nodes: PlanningNode[] | undefined, targetFullId: string): string | null {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.fullId === targetFullId) return n.title
    const child = findTitleInTree(n.children, targetFullId)
    if (child) return child
  }
  return null
}

const currentTitle = computed(() => findTitleInTree(tree.value, currentFullId.value) ?? currentFullId.value)

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

function onSelect(node: PlanningNode) {
  setCurrentPlanning(node.fullId)
  close()
}

defineExpose({ open, close })

onMounted(() => {
  if (props.openOnMount) open()
})
</script>

<template>
  <div>
    <slot v-if="!props.standaloneTrigger" name="trigger" :open="open" />

    <dialog ref="dialogRef" class="modal">
      <div class="modal-box max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </form>
        <div class="mb-4">
          <h3 class="text-lg font-bold">
            Select a planning
          </h3>
          <p class="text-sm opacity-70">
            Current:
            <span class="font-mono">
              {{ currentTitle }}
            </span>
          </p>
        </div>

        <div v-if="loading" class="flex items-center gap-3">
          <span class="loading loading-spinner loading-md" />
          <span>Loading plannings...</span>
        </div>

        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
        </div>

        <div v-else class="h-[60vh] overflow-auto">
          <ul class="menu bg-base-200 rounded-box w-full">
            <li v-for="root in tree" :key="root.fullId">
              <template v-if="root.children && root.children.length">
                <details open>
                  <summary class="font-medium">
                    {{ root.title }}
                  </summary>
                  <ul>
                    <PlanningTreeNode
                      v-for="child in root.children"
                      :key="child.fullId"
                      :is-current="isCurrent"
                      :node="child"
                      @select="onSelect"
                    />
                  </ul>
                </details>
              </template>
              <template v-else>
                <button
                  class="justify-between"
                  :class="{ active: isCurrent(root.fullId) }"
                  type="button"
                  @click="onSelect(root)"
                >
                  <span class="truncate text-left">{{ root.title }}</span>
                  <span v-if="isCurrent(root.fullId)" class="badge badge-primary badge-xs">current</span>
                </button>
              </template>
            </li>
          </ul>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button>
          close
        </button>
      </form>
    </dialog>
  </div>
</template>
